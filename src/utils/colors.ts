export const TAG_COLORS = [
    '#e06c75', // red
    '#e5c07b', // yellow
    '#98c379', // green
    '#56b6c2', // cyan
    '#61afef', // blue
    '#c678dd', // purple
    '#d19a66', // orange
    '#be5046', // dark red
    '#7ec699', // mint
    '#e06cb8', // pink
];

let colorIndex = 0;

export function getNextColor(): string {
    const color = TAG_COLORS[colorIndex % TAG_COLORS.length];
    colorIndex++;
    return color;
}

export function resetColorIndex(usedCount: number): void {
    colorIndex = usedCount;
}

export function hexToRgba(hex: string, alpha: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
