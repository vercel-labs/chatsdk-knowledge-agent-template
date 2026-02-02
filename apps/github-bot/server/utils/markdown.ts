import type { Root } from 'mdast'
import { fromMarkdown } from 'mdast-util-from-markdown'
import { gfmFromMarkdown, gfmToMarkdown } from 'mdast-util-gfm'
import { toMarkdown } from 'mdast-util-to-markdown'
import { gfm } from 'micromark-extension-gfm'

export class GitHubFormatConverter {

  toAst(text: string): Root {
    return fromMarkdown(text, {
      extensions: [gfm()],
      mdastExtensions: [gfmFromMarkdown()],
    })
  }

  fromAst(ast: Root): string {
    return toMarkdown(ast, {
      extensions: [gfmToMarkdown()],
    })
  }

}
