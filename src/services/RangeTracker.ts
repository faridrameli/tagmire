import * as vscode from 'vscode';
import { TagService } from './TagService';
import { Annotation } from '../models/types';

export class RangeTracker {
    private disposables: vscode.Disposable[] = [];

    constructor(private tagService: TagService) {
        this.disposables.push(
            vscode.workspace.onDidChangeTextDocument(e => this.onDocumentChange(e)),
            vscode.workspace.onDidOpenTextDocument(doc => this.onDocumentOpen(doc)),
        );

        // File rename tracking
        this.disposables.push(
            vscode.workspace.onDidRenameFiles(e => this.onRenameFiles(e)),
        );
    }

    dispose(): void {
        for (const d of this.disposables) {
            d.dispose();
        }
    }

    private async onDocumentChange(e: vscode.TextDocumentChangeEvent): Promise<void> {
        if (e.contentChanges.length === 0) { return; }

        const filePath = vscode.workspace.asRelativePath(e.document.uri, false);
        const annotations = this.tagService.getAnnotationsForFile(filePath);
        if (annotations.length === 0) { return; }

        let needsUpdate = false;

        for (const change of e.contentChanges) {
            const changeStartLine = change.range.start.line;
            const changeEndLine = change.range.end.line;
            const newLineCount = change.text.split('\n').length - 1;
            const oldLineCount = changeEndLine - changeStartLine;
            const lineDelta = newLineCount - oldLineCount;

            if (lineDelta === 0) { continue; }

            for (const annotation of annotations) {
                if (changeEndLine < annotation.startLine) {
                    // Edit is entirely above the annotation - shift it
                    annotation.startLine += lineDelta;
                    annotation.endLine += lineDelta;
                    needsUpdate = true;
                } else if (changeStartLine > annotation.endLine) {
                    // Edit is entirely below - no change needed
                } else {
                    // Edit overlaps with annotation - try to re-anchor
                    const reanchored = this.reanchor(annotation, e.document);
                    if (reanchored) {
                        needsUpdate = true;
                    }
                }
            }
        }

        if (needsUpdate) {
            for (const annotation of annotations) {
                await this.tagService.updateAnnotation(annotation);
            }
        }
    }

    private async onDocumentOpen(doc: vscode.TextDocument): Promise<void> {
        const filePath = vscode.workspace.asRelativePath(doc.uri, false);
        const annotations = this.tagService.getAnnotationsForFile(filePath);
        if (annotations.length === 0) { return; }

        let needsUpdate = false;

        for (const annotation of annotations) {
            // Check if the stored range still matches the snapshot
            const range = new vscode.Range(
                annotation.startLine, annotation.startChar,
                annotation.endLine, annotation.endChar,
            );

            // Ensure range is valid for this document
            if (annotation.endLine >= doc.lineCount) {
                const reanchored = this.reanchor(annotation, doc);
                if (reanchored) { needsUpdate = true; }
                continue;
            }

            const currentText = doc.getText(range);
            if (currentText !== annotation.contentSnapshot) {
                const reanchored = this.reanchor(annotation, doc);
                if (reanchored) { needsUpdate = true; }
            }
        }

        if (needsUpdate) {
            for (const annotation of annotations) {
                await this.tagService.updateAnnotation(annotation);
            }
        }
    }

    private reanchor(annotation: Annotation, doc: vscode.TextDocument): boolean {
        const fullText = doc.getText();
        const snapshot = annotation.contentSnapshot;
        if (!snapshot) { return false; }

        // Find all occurrences of the snapshot
        const matches: number[] = [];
        let searchFrom = 0;
        while (true) {
            const idx = fullText.indexOf(snapshot, searchFrom);
            if (idx === -1) { break; }
            matches.push(idx);
            searchFrom = idx + 1;
        }

        if (matches.length === 0) {
            // Content was deleted entirely - keep last known position
            return false;
        }

        if (matches.length === 1) {
            // Unique match - use it
            return this.applyMatch(annotation, doc, matches[0]);
        }

        // Multiple matches - disambiguate with context
        let bestIdx = matches[0];
        let bestScore = -1;

        for (const matchIdx of matches) {
            const pos = doc.positionAt(matchIdx);
            let score = 0;

            // Check context before
            if (annotation.contextBefore) {
                const ctxStart = Math.max(0, matchIdx - annotation.contextBefore.length);
                const actualBefore = fullText.substring(ctxStart, matchIdx);
                if (actualBefore.includes(annotation.contextBefore.trim())) {
                    score += 2;
                } else {
                    // Partial match on last line
                    const lastLineBefore = annotation.contextBefore.split('\n').pop() || '';
                    if (lastLineBefore && actualBefore.includes(lastLineBefore.trim())) {
                        score += 1;
                    }
                }
            }

            // Check context after
            if (annotation.contextAfter) {
                const ctxEnd = Math.min(fullText.length, matchIdx + snapshot.length + annotation.contextAfter.length);
                const actualAfter = fullText.substring(matchIdx + snapshot.length, ctxEnd);
                if (actualAfter.includes(annotation.contextAfter.trim())) {
                    score += 2;
                } else {
                    const firstLineAfter = annotation.contextAfter.split('\n')[0] || '';
                    if (firstLineAfter && actualAfter.includes(firstLineAfter.trim())) {
                        score += 1;
                    }
                }
            }

            if (score > bestScore) {
                bestScore = score;
                bestIdx = matchIdx;
            }
        }

        return this.applyMatch(annotation, doc, bestIdx);
    }

    private applyMatch(annotation: Annotation, doc: vscode.TextDocument, offset: number): boolean {
        const startPos = doc.positionAt(offset);
        const endPos = doc.positionAt(offset + annotation.contentSnapshot.length);

        const changed = (
            annotation.startLine !== startPos.line ||
            annotation.startChar !== startPos.character ||
            annotation.endLine !== endPos.line ||
            annotation.endChar !== endPos.character
        );

        if (changed) {
            annotation.startLine = startPos.line;
            annotation.startChar = startPos.character;
            annotation.endLine = endPos.line;
            annotation.endChar = endPos.character;
        }

        return changed;
    }

    private async onRenameFiles(e: vscode.FileRenameEvent): Promise<void> {
        for (const { oldUri, newUri } of e.files) {
            const oldPath = vscode.workspace.asRelativePath(oldUri, false);
            const newPath = vscode.workspace.asRelativePath(newUri, false);
            await this.tagService.updateAnnotationFilePath(oldPath, newPath);
        }
    }
}
