import { TagService } from './TagService';
import { StorageService } from './StorageService';
import { ExportData, Tag, Annotation, TagmireState } from '../models/types';
import { generateId } from '../utils/ids';

export class ExportService {
    constructor(
        private tagService: TagService,
        private storageService: StorageService,
    ) {}

    exportData(): ExportData {
        const state = this.storageService.getState();
        return {
            version: state.version,
            exportedAt: Date.now(),
            tags: state.tags,
            annotations: state.annotations,
        };
    }

    async importData(data: ExportData, strategy: 'merge' | 'replace'): Promise<{ tagsAdded: number; annotationsAdded: number }> {
        if (strategy === 'replace') {
            const newState: TagmireState = {
                version: data.version,
                tags: data.tags,
                annotations: data.annotations,
            };
            await this.storageService.setState(newState);
            return { tagsAdded: data.tags.length, annotationsAdded: data.annotations.length };
        }

        // Merge strategy
        const currentState = this.storageService.getState();
        const tagIdMap = new Map<string, string>(); // old ID → new ID
        let tagsAdded = 0;
        let annotationsAdded = 0;

        // Merge tags - deduplicate by name
        for (const importedTag of data.tags) {
            const existing = currentState.tags.find(t => t.name === importedTag.name);
            if (existing) {
                tagIdMap.set(importedTag.id, existing.id);
            } else {
                const newId = generateId();
                tagIdMap.set(importedTag.id, newId);
                currentState.tags.push({
                    ...importedTag,
                    id: newId,
                });
                tagsAdded++;
            }
        }

        // Merge annotations - remap tag IDs, skip exact duplicates
        for (const importedAnnotation of data.annotations) {
            const remappedTagIds = importedAnnotation.tagIds
                .map(id => tagIdMap.get(id))
                .filter((id): id is string => id !== undefined);

            if (remappedTagIds.length === 0) { continue; }

            // Check for duplicate by file + range + snapshot
            const isDuplicate = currentState.annotations.some(a =>
                a.filePath === importedAnnotation.filePath &&
                a.startLine === importedAnnotation.startLine &&
                a.startChar === importedAnnotation.startChar &&
                a.endLine === importedAnnotation.endLine &&
                a.endChar === importedAnnotation.endChar &&
                a.contentSnapshot === importedAnnotation.contentSnapshot
            );

            if (!isDuplicate) {
                currentState.annotations.push({
                    ...importedAnnotation,
                    id: generateId(),
                    tagIds: remappedTagIds,
                });
                annotationsAdded++;
            }
        }

        await this.storageService.setState(currentState);
        return { tagsAdded, annotationsAdded };
    }
}
