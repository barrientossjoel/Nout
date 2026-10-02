export const FIGMA_PALETTE = [
    '#0D99FF', // Figma Blue
    '#9747FF', // Figma Purple
    '#14AE5C', // Figma Green
    '#F24822', // Figma Orange
    '#FF7262', // Figma Coral
    '#FFA629', // Figma Amber
    '#00B6D3', // Figma Cyan
    '#E056FD', // Neon Purple
    '#2BCB77', // Emerald
    '#F75590', // Pink
] as const

/**
 * Deterministically computes a vibrant collaborator color from an identifier.
 */
export const getCollaboratorColor = (id?: string | number | null): string => {
    if (!id) return FIGMA_PALETTE[0]
    const key = String(id)
    const hash = Array.from(key).reduce((acc, ch) => ((acc << 5) - acc + ch.charCodeAt(0)) | 0, 0)
    return FIGMA_PALETTE[Math.abs(hash) % FIGMA_PALETTE.length]
}
