import { createDocument } from '../../client/actions/actions'
import { isTauri } from '../utils/platform'

export interface ObsidianImportResult {
  success: boolean
  importedCount: number
  error?: string
}

/** Parses YAML frontmatter from Obsidian markdown */
function parseFrontmatter(rawContent: string): { content: string; title?: string; tags?: string[] } {
  const match = rawContent.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
  return match ? {
    content: match[2].trim(),
    title: match[1].match(/title:\s*["']?([^"'\n]+)["']?/)?.[1]?.trim(),
    tags: (match[1].match(/tags:\s*\[(.*?)\]/) || match[1].match(/tags:\s*\n((?:\s*-\s*[^\n]+\n?)+)/))?.[1]
      ?.split(/[,\n]/)
      ?.map((t) => t.replace(/^\s*-\s*/, '').trim())
      ?.filter(Boolean),
  } : { content: rawContent }
}

const ENTRY_RESOLVERS: Record<string, (entry: any, parentId: string | null) => Promise<number>> = {
  file: async (entry, parentId) => {
    return entry.name.endsWith('.md')
      ? (async () => {
          const text = await (await entry.getFile()).text()
          const { content, title, tags } = parseFrontmatter(text)
          await createDocument({
            parentId,
            title: title || entry.name.replace(/\.md$/, ''),
            content,
            type: 'text',
            tags: tags ? JSON.stringify(tags) : undefined,
          })
          return 1
        })()
      : 0
  },
  directory: (entry, parentId) => scanDirectoryHandle(entry, parentId),
}

/** Recursively reads markdown files from a web FileSystemDirectoryHandle */
async function scanDirectoryHandle(dirHandle: any, parentId: string | null = null): Promise<number> {
  let count = 0
  for await (const entry of dirHandle.values()) {
    count += (await ENTRY_RESOLVERS[entry.kind]?.(entry, parentId)) ?? 0
  }
  return count
}

/** Imports an Obsidian vault from local system */
export async function importObsidianVault(): Promise<ObsidianImportResult> {
  try {
    return isTauri()
      ? await (async () => {
          const { invoke } = await import('@tauri-apps/api/core')
          const folder = await invoke<string | null>('pick_vault_folder')
          return { success: Boolean(folder), importedCount: folder ? 1 : 0 }
        })()
      : typeof window !== 'undefined' && 'showDirectoryPicker' in window
        ? { success: true, importedCount: await scanDirectoryHandle(await (window as any).showDirectoryPicker()) }
        : { success: false, importedCount: 0, error: 'File System Access API not supported' }
  } catch (err: any) {
    return err?.name === 'AbortError'
      ? { success: false, importedCount: 0 }
      : { success: false, importedCount: 0, error: err?.message || 'Error importing vault' }
  }
}
