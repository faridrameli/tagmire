import * as vscode from 'vscode';
import { StorageService } from './services/StorageService';
import { TagService } from './services/TagService';
import { RangeTracker } from './services/RangeTracker';
import { ExportService } from './services/ExportService';
import { DecorationProvider } from './providers/DecorationProvider';
import { TagTreeProvider } from './providers/TagTreeProvider';
import { registerTagCommands } from './commands/tagCommands';
import { registerAnnotationCommands } from './commands/annotationCommands';
import { registerNavigationCommands } from './commands/navigationCommands';
import { registerExportCommands } from './commands/exportCommands';

export function activate(context: vscode.ExtensionContext): void {
    console.log('Tagmire is now active');

    // Services
    const storageService = new StorageService(context);
    const tagService = new TagService(storageService);
    const rangeTracker = new RangeTracker(tagService);
    const exportService = new ExportService(tagService, storageService);

    // Providers
    const decorationProvider = new DecorationProvider(tagService);
    const treeProvider = new TagTreeProvider(tagService);

    // Sidebar TreeView
    const treeView = vscode.window.createTreeView('tagmireTagsView', {
        treeDataProvider: treeProvider,
        showCollapseAll: true,
    });

    // Refresh tree command
    context.subscriptions.push(
        vscode.commands.registerCommand('tagmire.refreshTree', () => treeProvider.refresh()),
    );

    // Rebuild decorations when tags change (colors may have changed)
    context.subscriptions.push(
        tagService.onDidChangeTags(() => decorationProvider.rebuildDecorationTypes()),
    );

    // Register all commands
    registerTagCommands(context, tagService);
    registerAnnotationCommands(context, tagService);
    registerNavigationCommands(context, tagService);
    registerExportCommands(context, exportService);

    // Disposables
    context.subscriptions.push(
        treeView,
        { dispose: () => tagService.dispose() },
        { dispose: () => rangeTracker.dispose() },
        { dispose: () => decorationProvider.dispose() },
        { dispose: () => treeProvider.dispose() },
    );
}

export function deactivate(): void {
    // Cleanup handled by disposables
}
