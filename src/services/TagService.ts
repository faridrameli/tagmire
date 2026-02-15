import * as vscode from 'vscode';
import { Tag, Annotation } from '../models/types';
import { StorageService } from './StorageService';
import { generateId } from '../utils/ids';
import { getNextColor, resetColorIndex } from '../utils/colors';

export class TagService {
    private readonly _onDidChangeTags = new vscode.EventEmitter<void>();
    readonly onDidChangeTags = this._onDidChangeTags.event;

    private readonly _onDidChangeAnnotations = new vscode.EventEmitter<void>();
    readonly onDidChangeAnnotations = this._onDidChangeAnnotations.event;

    constructor(private storage: StorageService) {
        resetColorIndex(this.storage.getTags().length);
    }

    dispose(): void {
        this._onDidChangeTags.dispose();
        this._onDidChangeAnnotations.dispose();
    }

    // Tag CRUD
    getTags(): Tag[] {
        return this.storage.getTags();
    }

    getTag(id: string): Tag | undefined {
        return this.storage.getTag(id);
    }

    async createTag(name: string, color?: string, description?: string): Promise<Tag> {
        const tag: Tag = {
            id: generateId(),
            name,
            color: color || getNextColor(),
            description: description || '',
            createdAt: Date.now(),
        };
        await this.storage.addTag(tag);
        this._onDidChangeTags.fire();
        return tag;
    }

    async updateTag(id: string, updates: Partial<Pick<Tag, 'name' | 'color' | 'description'>>): Promise<void> {
        const tag = this.storage.getTag(id);
        if (!tag) { return; }
        if (updates.name !== undefined) { tag.name = updates.name; }
        if (updates.color !== undefined) { tag.color = updates.color; }
        if (updates.description !== undefined) { tag.description = updates.description; }
        await this.storage.updateTag(tag);
        this._onDidChangeTags.fire();
        this._onDidChangeAnnotations.fire(); // color may have changed
    }

    async deleteTag(id: string): Promise<void> {
        await this.storage.deleteTag(id);
        this._onDidChangeTags.fire();
        this._onDidChangeAnnotations.fire();
    }

    // Annotation CRUD
    getAnnotations(): Annotation[] {
        return this.storage.getAnnotations();
    }

    getAnnotationsForFile(filePath: string): Annotation[] {
        return this.storage.getAnnotationsForFile(filePath);
    }

    getAnnotationsForTag(tagId: string): Annotation[] {
        return this.storage.getAnnotationsForTag(tagId);
    }

    async createAnnotation(
        tagIds: string[],
        filePath: string,
        startLine: number,
        startChar: number,
        endLine: number,
        endChar: number,
        contentSnapshot: string,
        contextBefore: string,
        contextAfter: string,
        note: string,
    ): Promise<Annotation> {
        const annotation: Annotation = {
            id: generateId(),
            tagIds,
            filePath,
            startLine,
            startChar,
            endLine,
            endChar,
            contentSnapshot,
            contextBefore,
            contextAfter,
            note,
            createdAt: Date.now(),
        };
        await this.storage.addAnnotation(annotation);
        this._onDidChangeAnnotations.fire();
        return annotation;
    }

    async updateAnnotation(annotation: Annotation): Promise<void> {
        await this.storage.updateAnnotation(annotation);
        this._onDidChangeAnnotations.fire();
    }

    async deleteAnnotation(id: string): Promise<void> {
        await this.storage.deleteAnnotation(id);
        this._onDidChangeAnnotations.fire();
    }

    async updateAnnotationFilePath(oldPath: string, newPath: string): Promise<void> {
        await this.storage.updateAnnotationFilePath(oldPath, newPath);
        this._onDidChangeAnnotations.fire();
    }
}
