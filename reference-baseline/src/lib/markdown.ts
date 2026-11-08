import { createMarkdownProcessor } from '@astrojs/markdown-remark';

const inlineMarkdownProcessor = createMarkdownProcessor({ syntaxHighlight: false });

export async function renderInlineMarkdown(value: string): Promise<string> {
  const { code } = await (await inlineMarkdownProcessor).render(value);
  const paragraph = code.match(/^<p>([\s\S]*)<\/p>$/);

  if (!paragraph) throw new Error('Inline Markdown must render as a single paragraph.');
  return paragraph[1];
}

export function plainInlineMarkdown(value: string): string {
  return value
    .replace(/<br\s*\/?\s*>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/([*_~`])+/g, '')
    .replace(/\\([\\`*_[\]{}()#+\-.!>])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}
