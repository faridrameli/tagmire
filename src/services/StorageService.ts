import * as vscode from 'vscode';
import { Tag, Annotation, TagmireState } from '../models/types';

const STORAGE_KEY = 'tagmire.state';
const CURRENT_VERSION = 1;

export class StorageService {
    private state: TagmireState;

    constructor(private context: vscode.ExtensionContext) {
        this.state = this.load();
    }

    private load(): TagmireState {
        const raw = this.context.workspaceState.get<TagmireState>(STORAGE_KEY);
        if (raw && raw.version === CURRENT_VERSION) {
            return raw;
        }
        return { version: CURRENT_VERSION, tags: [], annotations: [] };
    }

    private async save(): Promise<void> {
        await this.context.workspaceState.update(STORAGE_KEY, this.state);
    }

    // Tags
    getTags(): Tag[] {
        return [...this.state.tags];
    }

    getTag(id: string): Tag | undefined {
        return this.state.tags.find(t => t.id === id);
    }

    async addTag(tag: Tag): Promise<void> {
        this.state.tags.push(tag);
        await this.save();
    }

    async updateTag(tag: Tag): Promise<void> {
        const idx = this.state.tags.findIndex(t => t.id === tag.id);
        if (idx !== -1) {
            this.state.tags[idx] = tag;
            await this.save();
        }
    }

    async deleteTag(id: string): Promise<void> {
        this.state.tags = this.state.tags.filter(t => t.id !== id);
        // Remove tag from annotations, delete annotations with no tags left
        this.state.annotations = this.state.annotations
            .map(a => ({ ...a, tagIds: a.tagIds.filter(tid => tid !== id) }))
            .filter(a => a.tagIds.length > 0);
        await this.save();
    }

    // Annotations
    getAnnotations(): Annotation[] {
        return [...this.state.annotations];
    }

    getAnnotationsForFile(filePath: string): Annotation[] {
        return this.state.annotations.filter(a => a.filePath === filePath);
    }

    getAnnotationsForTag(tagId: string): Annotation[] {
        return this.state.annotations.filter(a => a.tagIds.includes(tagId));
    }

    async addAnnotation(annotation: Annotation): Promise<void> {
        this.state.annotations.push(annotation);
        await this.save();
    }

    async updateAnnotation(annotation: Annotation): Promise<void> {
        const idx = this.state.annotations.findIndex(a => a.id === annotation.id);
        if (idx !== -1) {
            this.state.annotations[idx] = annotation;
            await this.save();
        }
    }

    async deleteAnnotation(id: string): Promise<void> {
        this.state.annotations = this.state.annotations.filter(a => a.id !== id);
        await this.save();
    }

    async updateAnnotationFilePath(oldPath: string, newPath: string): Promise<void> {
        let changed = false;
        for (const a of this.state.annotations) {
            if (a.filePath === oldPath) {
                a.filePath = newPath;
                changed = true;
            }
        }
        if (changed) {
            await this.save();
        }
    }

    // Bulk operations for import
    getState(): TagmireState {
        return {
            version: this.state.version,
            tags: [...this.state.tags],
            annotations: [...this.state.annotations],
        };
    }

    async setState(state: TagmireState): Promise<void> {
        this.state = state;
        await this.save();
    }
}
