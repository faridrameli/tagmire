import * as vscode from 'vscode';
import { TagService } from '../services/TagService';
import { Tag, Annotation } from '../models/types';
import * as path from 'path';

type TreeItem = TagItem | FileItem | AnnotationItem;

class TagItem extends vscode.TreeItem {
    constructor(public readonly tag: Tag, annotationCount: number) {
        super(tag.name, vscode.TreeItemCollapsibleState.Expanded);
        this.description = `(${annotationCount})`;
        this.contextValue = 'tag';
        this.iconPath = makeColorIcon(tag.color);
    }
}

class FileItem extends vscode.TreeItem {
    constructor(public readonly filePath: string, annotationCount: number) {
        super(path.basename(filePath), vscode.TreeItemCollapsibleState.Expanded);
        this.description = filePath;
        this.contextValue = 'file';
        this.resourceUri = vscode.Uri.file(
            vscode.workspace.workspaceFolders?.[0]
                ? path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, filePath)
                : filePath
        );
        this.iconPath = vscode.ThemeIcon.File;
    }
}

class AnnotationItem extends vscode.TreeItem {
    constructor(public readonly annotation: Annotation, tags: Tag[]) {
        const preview = annotation.contentSnapshot
            .substring(0, 60)
            .replace(/\n/g, ' ')
            .trim();
        super(preview || '(empty)', vscode.TreeItemCollapsibleState.None);

        this.description = `L${annotation.startLine + 1}`;
        this.contextValue = 'annotation';

        const tooltip = new vscode.MarkdownString();
        const tagNames = annotation.tagIds
            .map(id => tags.find(t => t.id === id)?.name || 'unknown')
            .join(', ');
        tooltip.appendMarkdown(`**Tags:** ${tagNames}\n\n`);
        if (annotation.note) {
            tooltip.appendMarkdown(`**Note:** ${annotation.note}\n\n`);
        }
        tooltip.appendCodeblock(annotation.contentSnapshot.substring(0, 200));
        this.tooltip = tooltip;

        this.command = {
            command: 'tagmire.goToAnnotation',
            title: 'Go to Annotation',
            arguments: [annotation],
        };
    }
}

function makeColorIcon(color: string): vscode.Uri {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" fill="${color}"/></svg>`;
    return vscode.Uri.parse(`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`);
}

export class TagTreeProvider implements vscode.TreeDataProvider<TreeItem> {
    private readonly _onDidChangeTreeData = new vscode.EventEmitter<void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    private disposables: vscode.Disposable[] = [];

    constructor(private tagService: TagService) {
        this.disposables.push(
            tagService.onDidChangeTags(() => this._onDidChangeTreeData.fire()),
            tagService.onDidChangeAnnotations(() => this._onDidChangeTreeData.fire()),
        );
    }

    dispose(): void {
        this._onDidChangeTreeData.dispose();
        for (const d of this.disposables) {
            d.dispose();
        }
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: TreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: TreeItem): TreeItem[] {
        if (!element) {
            return this.getRootChildren();
        }
        if (element instanceof TagItem) {
            return this.getFileChildren(element.tag);
        }
        if (element instanceof FileItem) {
            // Need tag context - stored on FileItem won't work directly
            // We'll handle this via a different approach
            return [];
        }
        return [];
    }

    private getRootChildren(): TagItem[] {
        const tags = this.tagService.getTags();
        return tags.map(tag => {
            const count = this.tagService.getAnnotationsForTag(tag.id).length;
            return new TagItem(tag, count);
        });
    }

    private getFileChildren(tag: Tag): (FileItem | AnnotationItem)[] {
        const annotations = this.tagService.getAnnotationsForTag(tag.id);
        const tags = this.tagService.getTags();

        // Group by file
        const byFile = new Map<string, Annotation[]>();
        for (const a of annotations) {
            if (!byFile.has(a.filePath)) {
                byFile.set(a.filePath, []);
            }
            byFile.get(a.filePath)!.push(a);
        }

        // If only one file, skip file level and show annotations directly
        if (byFile.size === 1) {
            const [, fileAnnotations] = [...byFile.entries()][0];
            return fileAnnotations
                .sort((a, b) => a.startLine - b.startLine)
                .map(a => new AnnotationItem(a, tags));
        }

        // Multiple files - return FileItems that contain AnnotationItems
        const result: (FileItem | AnnotationItem)[] = [];
        for (const [filePath, fileAnnotations] of byFile) {
            // Since TreeView doesn't support mixed hierarchies easily,
            // we flatten: show file as a label, then annotations
            result.push(new FileItem(filePath, fileAnnotations.length));
            for (const a of fileAnnotations.sort((a, b) => a.startLine - b.startLine)) {
                result.push(new AnnotationItem(a, tags));
            }
        }
        return result;
    }
}
