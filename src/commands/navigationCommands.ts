import * as vscode from 'vscode';
import { TagService } from '../services/TagService';
import { Annotation } from '../models/types';
import * as path from 'path';

export function registerNavigationCommands(context: vscode.ExtensionContext, tagService: TagService): void {
    context.subscriptions.push(
        vscode.commands.registerCommand('tagmire.goToAnnotation', (annotation: Annotation) =>
            goToAnnotation(annotation)),
        vscode.commands.registerCommand('tagmire.searchByTag', () => searchByTag(tagService)),
    );
}

async function goToAnnotation(annotation: Annotation): Promise<void> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) { return; }

    const fileUri = vscode.Uri.file(path.join(workspaceFolder.uri.fsPath, annotation.filePath));

    try {
        const doc = await vscode.workspace.openTextDocument(fileUri);
        const editor = await vscode.window.showTextDocument(doc);

        const range = new vscode.Range(
            annotation.startLine, annotation.startChar,
            annotation.endLine, annotation.endChar,
        );

        editor.selection = new vscode.Selection(range.start, range.end);
        editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
    } catch {
        vscode.window.showWarningMessage(`Could not open file: ${annotation.filePath}`);
    }
}

async function searchByTag(tagService: TagService): Promise<void> {
    const tags = tagService.getTags();
    if (tags.length === 0) {
        vscode.window.showInformationMessage('No tags exist.');
        return;
    }

    // Step 1: Pick a tag
    const tagItems = tags.map(t => ({
        label: `$(circle-filled) ${t.name}`,
        description: `${tagService.getAnnotationsForTag(t.id).length} annotation(s)`,
        tag: t,
    }));

    const pickedTag = await vscode.window.showQuickPick(tagItems, {
        placeHolder: 'Select a tag to search',
    });
    if (!pickedTag) { return; }

    // Step 2: Pick an annotation
    const annotations = tagService.getAnnotationsForTag(pickedTag.tag.id);
    if (annotations.length === 0) {
        vscode.window.showInformationMessage(`No annotations for tag "${pickedTag.tag.name}".`);
        return;
    }

    const annotationItems = annotations.map(a => {
        const preview = a.contentSnapshot.substring(0, 80).replace(/\n/g, ' ').trim();
        return {
            label: preview || '(empty)',
            description: `${a.filePath}:${a.startLine + 1}`,
            detail: a.note || undefined,
            annotation: a,
        };
    });

    const pickedAnnotation = await vscode.window.showQuickPick(annotationItems, {
        placeHolder: 'Select an annotation to navigate to',
    });
    if (!pickedAnnotation) { return; }

    await goToAnnotation(pickedAnnotation.annotation);
}
