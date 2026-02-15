import * as vscode from 'vscode';
import { ExportService } from '../services/ExportService';
import { ExportData } from '../models/types';

export function registerExportCommands(context: vscode.ExtensionContext, exportService: ExportService): void {
    context.subscriptions.push(
        vscode.commands.registerCommand('tagmire.exportTags', () => exportTags(exportService)),
        vscode.commands.registerCommand('tagmire.importTags', () => importTags(exportService)),
    );
}

async function exportTags(exportService: ExportService): Promise<void> {
    const data = exportService.exportData();

    if (data.tags.length === 0) {
        vscode.window.showInformationMessage('No tags to export.');
        return;
    }

    const uri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file('tagmire-export.json'),
        filters: { 'JSON': ['json'] },
        title: 'Export Tagmire Data',
    });

    if (!uri) { return; }

    const content = JSON.stringify(data, null, 2);
    await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf-8'));
    vscode.window.showInformationMessage(
        `Exported ${data.tags.length} tag(s) and ${data.annotations.length} annotation(s).`
    );
}

async function importTags(exportService: ExportService): Promise<void> {
    const uris = await vscode.window.showOpenDialog({
        canSelectMany: false,
        filters: { 'JSON': ['json'] },
        title: 'Import Tagmire Data',
    });

    if (!uris || uris.length === 0) { return; }

    const content = await vscode.workspace.fs.readFile(uris[0]);
    let data: ExportData;
    try {
        data = JSON.parse(Buffer.from(content).toString('utf-8'));
    } catch {
        vscode.window.showErrorMessage('Invalid JSON file.');
        return;
    }

    if (!data.tags || !data.annotations) {
        vscode.window.showErrorMessage('Invalid Tagmire export file.');
        return;
    }

    // Pick strategy
    const strategy = await vscode.window.showQuickPick(
        [
            { label: 'Merge', description: 'Add imported data alongside existing tags', value: 'merge' as const },
            { label: 'Replace', description: 'Replace all existing data with imported data', value: 'replace' as const },
        ],
        { placeHolder: 'How should imported data be handled?' },
    );

    if (!strategy) { return; }

    if (strategy.value === 'replace') {
        const confirm = await vscode.window.showWarningMessage(
            'This will replace ALL existing tags and annotations. Continue?',
            { modal: true },
            'Replace',
        );
        if (confirm !== 'Replace') { return; }
    }

    const result = await exportService.importData(data, strategy.value);
    vscode.window.showInformationMessage(
        `Imported ${result.tagsAdded} tag(s) and ${result.annotationsAdded} annotation(s).`
    );
}
