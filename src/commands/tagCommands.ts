import * as vscode from 'vscode';
import { TagService } from '../services/TagService';
import { TAG_COLORS } from '../utils/colors';
import { Tag } from '../models/types';

export function registerTagCommands(context: vscode.ExtensionContext, tagService: TagService): void {
    context.subscriptions.push(
        vscode.commands.registerCommand('tagmire.createTag', () => createTag(tagService)),
        vscode.commands.registerCommand('tagmire.editTag', (item?: { tag?: Tag }) => editTag(tagService, item?.tag)),
        vscode.commands.registerCommand('tagmire.deleteTag', (item?: { tag?: Tag }) => deleteTag(tagService, item?.tag)),
    );
}

async function createTag(tagService: TagService): Promise<void> {
    const name = await vscode.window.showInputBox({
        prompt: 'Enter tag name',
        placeHolder: 'e.g. TODO, Bug, Review',
        validateInput: (v) => v.trim() ? null : 'Tag name cannot be empty',
    });
    if (!name) { return; }

    const color = await pickColor();
    if (!color) { return; }

    const description = await vscode.window.showInputBox({
        prompt: 'Enter tag description (optional)',
        placeHolder: 'What is this tag for?',
    });

    await tagService.createTag(name.trim(), color, description || '');
    vscode.window.showInformationMessage(`Tag "${name.trim()}" created.`);
}

async function editTag(tagService: TagService, tag?: Tag): Promise<void> {
    if (!tag) {
        tag = await pickTag(tagService, 'Select tag to edit');
    }
    if (!tag) { return; }

    const name = await vscode.window.showInputBox({
        prompt: 'Edit tag name',
        value: tag.name,
        validateInput: (v) => v.trim() ? null : 'Tag name cannot be empty',
    });
    if (!name) { return; }

    const color = await pickColor(tag.color);
    if (!color) { return; }

    const description = await vscode.window.showInputBox({
        prompt: 'Edit tag description',
        value: tag.description,
    });
    if (description === undefined) { return; }

    await tagService.updateTag(tag.id, { name: name.trim(), color, description });
    vscode.window.showInformationMessage(`Tag "${name.trim()}" updated.`);
}

async function deleteTag(tagService: TagService, tag?: Tag): Promise<void> {
    if (!tag) {
        tag = await pickTag(tagService, 'Select tag to delete');
    }
    if (!tag) { return; }

    const annotationCount = tagService.getAnnotationsForTag(tag.id).length;
    const detail = annotationCount > 0
        ? `This will also remove ${annotationCount} annotation(s) using only this tag.`
        : undefined;

    const confirm = await vscode.window.showWarningMessage(
        `Delete tag "${tag.name}"?`,
        { detail, modal: true },
        'Delete',
    );
    if (confirm !== 'Delete') { return; }

    await tagService.deleteTag(tag.id);
    vscode.window.showInformationMessage(`Tag "${tag.name}" deleted.`);
}

async function pickColor(currentColor?: string): Promise<string | undefined> {
    const items = TAG_COLORS.map(c => ({
        label: `$(circle-filled) ${c}`,
        description: c === currentColor ? '(current)' : '',
        color: c,
    }));

    const picked = await vscode.window.showQuickPick(items, {
        placeHolder: 'Pick a color',
    });

    return picked?.color;
}

async function pickTag(tagService: TagService, placeholder: string): Promise<Tag | undefined> {
    const tags = tagService.getTags();
    if (tags.length === 0) {
        vscode.window.showInformationMessage('No tags exist. Create one first.');
        return undefined;
    }

    const items = tags.map(t => ({
        label: `$(circle-filled) ${t.name}`,
        description: t.description,
        tag: t,
    }));

    const picked = await vscode.window.showQuickPick(items, { placeHolder: placeholder });
    return picked?.tag;
}
