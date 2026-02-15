# Tagmire

A VS Code extension that lets you tag code ranges with personal, color-coded labels — stored outside your source files. Keep your code clean while annotating, navigating, and tracing logic across files.

Tags and annotations are saved in VS Code's `workspaceState`, so they never touch your source code. Share them with teammates via JSON export/import.

## Features

- **Color-coded highlights** — each tag gets a background color, bottom border, and gutter dot
- **Multiple tags per range** — attach several tags to the same selection
- **Hover tooltips** — see tag names and notes by hovering over highlighted code
- **Sidebar panel** — browse all tags and annotations in a tree view (Tag → File → Annotation)
- **Click-to-navigate** — jump to any annotation from the sidebar or search command
- **Content-anchored tracking** — annotations follow your code through edits, not just line numbers
- **File rename tracking** — annotations update when you rename or move files
- **Export/Import** — share tags as JSON files, merge or replace when importing

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [VS Code](https://code.visualstudio.com/) (v1.85+)

### Install and Run

```bash
git clone https://github.com/your-username/tagmire.git
cd tagmire
npm install
npm run compile
```

Then press **F5** in VS Code to launch the Extension Development Host with Tagmire loaded.

### Basic Workflow

1. **Create a tag** — Command Palette → `Tagmire: Create Tag` → pick a name, color, and optional description
2. **Tag some code** — select text in the editor → right-click → `Tagmire: Tag Selection` (or `Ctrl+Shift+T`) → pick one or more tags → add an optional note
3. **Browse tags** — open the Tagmire panel in the activity bar (tag icon on the left sidebar)
4. **Navigate** — click any annotation in the sidebar to jump to it, or use `Tagmire: Search By Tag` (`Ctrl+Shift+F6`)
5. **Remove** — right-click an annotation in the sidebar → `Remove Annotation`, or place your cursor on highlighted code → right-click → `Tagmire: Remove Annotation`
6. **Share** — `Tagmire: Export Tags` to save a JSON file, `Tagmire: Import Tags` to load one (merge or replace)

## Commands

| Command | Keybinding | Description |
|---------|-----------|-------------|
| `Tagmire: Create Tag` | | Create a new tag with name, color, and description |
| `Tagmire: Edit Tag` | | Edit an existing tag's name, color, or description |
| `Tagmire: Delete Tag` | | Delete a tag and its orphaned annotations |
| `Tagmire: Tag Selection` | `Ctrl+Shift+T` | Tag the current selection with one or more tags |
| `Tagmire: Remove Annotation` | | Remove an annotation at the cursor or from the sidebar |
| `Tagmire: Search By Tag` | `Ctrl+Shift+F6` | Pick a tag, then pick an annotation to jump to |
| `Tagmire: Export Tags` | | Export all tags and annotations to a JSON file |
| `Tagmire: Import Tags` | | Import tags from a JSON file (merge or replace) |

## How It Works

Annotations store a **content snapshot** (the exact tagged text) plus a few lines of surrounding context. When you edit a file:

- **Edits above** the annotation shift its line numbers automatically
- **Edits overlapping** the annotation trigger a re-anchor — Tagmire searches for the snapshot text in the file and uses surrounding context to disambiguate duplicate matches
- **File renames** update the stored path automatically

This means annotations survive refactors, reformats, and general editing far better than line-number-only bookmarks.

## Project Structure

```
src/
├── extension.ts              Entry point
├── models/types.ts           Tag, Annotation, and state interfaces
├── services/
│   ├── StorageService.ts     workspaceState persistence
│   ├── TagService.ts         CRUD + change events
│   ├── RangeTracker.ts       Content-anchored position tracking
│   └── ExportService.ts      JSON export/import
├── providers/
│   ├── DecorationProvider.ts Inline highlights, gutter dots, tooltips
│   └── TagTreeProvider.ts    Sidebar tree view
├── commands/
│   ├── tagCommands.ts        Create/edit/delete tags
│   ├── annotationCommands.ts Tag selection, remove annotation
│   ├── navigationCommands.ts Go to annotation, search by tag
│   └── exportCommands.ts     Export/import dialogs
└── utils/
    ├── colors.ts             10-color palette, hex→rgba
    └── ids.ts                UUID generation
```

## License

MIT
