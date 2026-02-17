interface TocLink {
  id: string
  text: string
  depth: number
  children?: TocLink[]
}

export function useMarkdownToc(content: string): TocLink[] {
  const headingRegex = /^(#{2,3})\s+(.+)$/gm
  const links: TocLink[] = []
  let match

  while ((match = headingRegex.exec(content)) !== null) {
    const depth = match[1].length
    const text = match[2].trim()
    const id = text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')

    const link: TocLink = { id, depth, text }

    if (depth === 2) {
      links.push({ ...link, children: [] })
    } else if (depth === 3 && links.length > 0) {
      links[links.length - 1].children!.push(link)
    }
  }

  return links
}
