export interface Tag {
    id: string;
    name: string;
    color: string;
    description: string;
    createdAt: number;
}

export interface Annotation {
    id: string;
    tagIds: string[];
    filePath: string;
    startLine: number;
    startChar: number;
    endLine: number;
    endChar: number;
    contentSnapshot: string;
    contextBefore: string;
    contextAfter: string;
    note: string;
    createdAt: number;
}

export interface TagmireState {
    version: number;
    tags: Tag[];
    annotations: Annotation[];
}

export interface ExportData {
    version: number;
    exportedAt: number;
    tags: Tag[];
    annotations: Annotation[];
}

export type TagTreeNodeType = 'tag' | 'file' | 'annotation';

export interface TagTreeNode {
    type: TagTreeNodeType;
    tag?: Tag;
    filePath?: string;
    annotation?: Annotation;
    children?: TagTreeNode[];
}
