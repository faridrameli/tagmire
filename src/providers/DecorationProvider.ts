import * as vscode from 'vscode';
import { TagService } from '../services/TagService';
import { Tag, Annotation } from '../models/types';
import { hexToRgba } from '../utils/colors';

export class DecorationProvider {
    private decorationTypes = new Map<string, vscode.TextEditorDecorationType>();
    private disposables: vscode.Disposable[] = [];

    constructor(private tagService: TagService) {
        this.disposables.push(
            tagService.onDidChangeTags(() => this.refreshAll()),
            tagService.onDidChangeAnnotations(() => this.refreshAll()),
            vscode.window.onDidChangeActiveTextEditor(() => this.refreshActiveEditor()),
            vscode.window.onDidChangeVisibleTextEditors(() => this.refreshAll()),
        );
        this.refreshAll();
    }

    dispose(): void {
        for (const dt of this.decorationTypes.values()) {
            dt.dispose();
        }
        this.decorationTypes.clear();
        for (const d of this.disposables) {
            d.dispose();
        }
    }

    refreshAll(): void {
        for (const editor of vscode.window.visibleTextEditors) {
            this.refreshEditor(editor);
        }
    }

    private refreshActiveEditor(): void {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            this.refreshEditor(editor);
        }
    }

    private getOrCreateDecorationType(tag: Tag): vscode.TextEditorDecorationType {
        const existing = this.decorationTypes.get(tag.id);
        if (existing) { return existing; }

        const gutterSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle cx="8" cy="8" r="5" fill="${tag.color}"/></svg>`;
        const gutterIconUri = vscode.Uri.parse(
            `data:image/svg+xml;utf8,${encodeURIComponent(gutterSvg)}`
        );

        const dt = vscode.window.createTextEditorDecorationType({
            backgroundColor: hexToRgba(tag.color, 0.2),
            borderWidth: '0 0 2px 0',
            borderStyle: 'solid',
            borderColor: tag.color,
            gutterIconPath: gutterIconUri,
            gutterIconSize: '80%',
            overviewRulerColor: tag.color,
            overviewRulerLane: vscode.OverviewRulerLane.Center,
        });

        this.decorationTypes.set(tag.id, dt);
        return dt;
    }

    private refreshEditor(editor: vscode.TextEditor): void {
        const filePath = vscode.workspace.asRelativePath(editor.document.uri, false);
        const annotations = this.tagService.getAnnotationsForFile(filePath);
        const tags = this.tagService.getTags();
        const tagMap = new Map(tags.map(t => [t.id, t]));

        // Group annotations by their last tag (for decoration purposes)
        // Each tag gets its own decoration type with ranges
        const tagRanges = new Map<string, { ranges: vscode.DecorationOptions[], tag: Tag }>();

        for (const annotation of annotations) {
            // Use the last tag in the list for decoration color
            const primaryTagId = annotation.tagIds[annotation.tagIds.length - 1];
            const primaryTag = tagMap.get(primaryTagId);
            if (!primaryTag) { continue; }

            // Build hover message showing all tags
            const allTagNames = annotation.tagIds
                .map(id => tagMap.get(id)?.name)
                .filter(Boolean)
                .join(', ');

            const hover = new vscode.MarkdownString();
            hover.appendMarkdown(`**Tags:** ${allTagNames}\n\n`);
            if (annotation.note) {
                hover.appendMarkdown(`**Note:** ${annotation.note}\n\n`);
            }

            const range = new vscode.Range(
                annotation.startLine, annotation.startChar,
                annotation.endLine, annotation.endChar,
            );

            const option: vscode.DecorationOptions = {
                range,
                hoverMessage: hover,
            };

            if (!tagRanges.has(primaryTagId)) {
                tagRanges.set(primaryTagId, { ranges: [], tag: primaryTag });
            }
            tagRanges.get(primaryTagId)!.ranges.push(option);
        }

        // Apply decorations for tags that have annotations in this file
        const activeTagIds = new Set(tagRanges.keys());
        for (const [tagId, dt] of this.decorationTypes) {
            if (!activeTagIds.has(tagId)) {
                editor.setDecorations(dt, []);
            }
        }

        for (const [tagId, { ranges, tag }] of tagRanges) {
            const dt = this.getOrCreateDecorationType(tag);
            editor.setDecorations(dt, ranges);
        }
    }

    rebuildDecorationTypes(): void {
        // Called when tag colors change - dispose old types and rebuild
        for (const dt of this.decorationTypes.values()) {
            dt.dispose();
        }
        this.decorationTypes.clear();
        this.refreshAll();
    }
}
