import * as vscode from 'vscode';
import { TagService } from '../services/TagService';
import { Tag, Annotation } from '../models/types';
import * as path from 'path';

export function registerAnnotationCommands(context: vscode.ExtensionContext, tagService: TagService): void {
    context.subscriptions.push(
        vscode.commands.registerCommand('tagmire.tagSelection', () => tagSelection(tagService)),
        vscode.commands.registerCommand('tagmire.removeAnnotation', (item?: { annotation?: Annotation }) =>
            removeAnnotation(tagService, item?.annotation)),
    );
}

async function tagSelection(tagService: TagService): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showWarningMessage('No active editor.');
        return;
    }

    const selection = editor.selection;
    if (selection.isEmpty) {
        vscode.window.showWarningMessage('Select some text first.');
        return;
    }

    const tags = tagService.getTags();
    if (tags.length === 0) {
        const create = await vscode.window.showInformationMessage(
            'No tags exist yet. Create one?',
            'Create Tag',
        );
        if (create === 'Create Tag') {
            await vscode.commands.executeCommand('tagmire.createTag');
        }
        return;
    }

    // Multi-select tags
    const items = tags.map(t => ({
        label: `$(circle-filled) ${t.name}`,
        description: t.description,
        tag: t,
        picked: false,
    }));

    const picked = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select tag(s) for this selection',
        canPickMany: true,
    });

    if (!picked || picked.length === 0) { return; }

    const tagIds = picked.map(p => p.tag.id);

    // Capture snapshot and context
    const doc = editor.document;
    const contentSnapshot = doc.getText(selection);

    const contextBeforeStart = Math.max(0, selection.start.line - 2);
    const contextBefore = doc.getText(new vscode.Range(
        contextBeforeStart, 0,
        selection.start.line, selection.start.character,
    ));

    const contextAfterEnd = Math.min(doc.lineCount - 1, selection.end.line + 2);
    const contextAfter = doc.getText(new vscode.Range(
        selection.end.line, selection.end.character,
        contextAfterEnd, doc.lineAt(contextAfterEnd).text.length,
    ));

    // Optional note
    const note = await vscode.window.showInputBox({
        prompt: 'Add a note (optional)',
        placeHolder: 'Why is this tagged?',
    }) || '';

    const filePath = vscode.workspace.asRelativePath(doc.uri, false);

    await tagService.createAnnotation(
        tagIds,
        filePath,
        selection.start.line,
        selection.start.character,
        selection.end.line,
        selection.end.character,
        contentSnapshot,
        contextBefore,
        contextAfter,
        note,
    );

    const tagNames = picked.map(p => p.tag.name).join(', ');
    vscode.window.showInformationMessage(`Tagged with: ${tagNames}`);
}

async function removeAnnotation(tagService: TagService, annotation?: Annotation): Promise<void> {
    if (annotation) {
        await tagService.deleteAnnotation(annotation.id);
        vscode.window.showInformationMessage('Annotation removed.');
        return;
    }

    // Find annotations at current cursor position
    const editor = vscode.window.activeTextEditor;
    if (!editor) { return; }

    const filePath = vscode.workspace.asRelativePath(editor.document.uri, false);
    const pos = editor.selection.active;
    const annotations = tagService.getAnnotationsForFile(filePath).filter(a =>
        pos.line >= a.startLine && pos.line <= a.endLine &&
        (pos.line > a.startLine || pos.character >= a.startChar) &&
        (pos.line < a.endLine || pos.character <= a.endChar),
    );

    if (annotations.length === 0) {
        vscode.window.showInformationMessage('No annotation at cursor position.');
        return;
    }

    if (annotations.length === 1) {
        await tagService.deleteAnnotation(annotations[0].id);
        vscode.window.showInformationMessage('Annotation removed.');
        return;
    }

    // Multiple annotations at cursor - let user pick
    const tags = tagService.getTags();
    const items = annotations.map(a => {
        const tagNames = a.tagIds
            .map(id => tags.find(t => t.id === id)?.name || 'unknown')
            .join(', ');
        const preview = a.contentSnapshot.substring(0, 50).replace(/\n/g, ' ');
        return {
            label: tagNames,
            description: preview,
            annotation: a,
        };
    });

    const picked = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select annotation to remove',
    });

    if (picked) {
        await tagService.deleteAnnotation(picked.annotation.id);
        vscode.window.showInformationMessage('Annotation removed.');
    }
}
