import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Components } from 'react-markdown'

/** Pre-process GitHub markdown: admonitions, badge images, cleanup */
function preprocessMarkdown(md: string): string {
  // Remove shield badge images (download counters, etc.)
  md = md.replace(/!\[.*?\]\(https:\/\/img\.shields\.io\/[^)]*\)/g, '')

  // Convert GitHub admonitions to bold title inside blockquote
  md = md.replace(/^(>\s*)\[!CAUTION\]\s*$/gm, '$1**Внимание**')
  md = md.replace(/^(>\s*)\[!WARNING\]\s*$/gm, '$1**Предупреждение**')
  md = md.replace(/^(>\s*)\[!NOTE\]\s*$/gm, '$1**Примечание**')
  md = md.replace(/^(>\s*)\[!TIP\]\s*$/gm, '$1**Совет**')
  md = md.replace(/^(>\s*)\[!IMPORTANT\]\s*$/gm, '$1**Важно**')

  // Clean up excessive blank lines
  md = md.replace(/\n{3,}/g, '\n\n')

  return md.trim()
}

const markdownComponents: Components = {
  h1: ({ children, ...props }) => (
    <h1 className="text-xl font-bold mb-3 mt-4 text-foreground" {...props}>{children}</h1>
  ),
  h2: ({ children, ...props }) => (
    <h2 className="text-lg font-semibold mb-2 mt-3 text-foreground" {...props}>{children}</h2>
  ),
  h3: ({ children, ...props }) => (
    <h3 className="text-base font-medium mb-1.5 mt-2 text-foreground" {...props}>{children}</h3>
  ),
  p: ({ children, ...props }) => (
    <p className="mb-2 text-sm text-muted-foreground leading-relaxed" {...props}>{children}</p>
  ),
  ul: ({ children, ...props }) => (
    <ul className="mb-2 ml-4 list-disc text-sm text-muted-foreground space-y-0.5" {...props}>{children}</ul>
  ),
  ol: ({ children, ...props }) => (
    <ol className="mb-2 ml-4 list-decimal text-sm text-muted-foreground space-y-0.5" {...props}>{children}</ol>
  ),
  li: ({ children, ...props }) => (
    <li className="text-sm" {...props}>{children}</li>
  ),
  code: ({ children, ...props }) => (
    <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono" {...props}>{children}</code>
  ),
  pre: ({ children, ...props }) => (
    <pre className="bg-muted rounded-md p-3 overflow-x-auto text-xs mb-2" {...props}>{children}</pre>
  ),
  a: ({ children, ...props }) => (
    <a className="text-primary underline underline-offset-2" target="_blank" rel="noopener noreferrer" {...props}>{children}</a>
  ),
  img: ({ src, alt, ...props }) => {
    // Filter out shield badge images
    if (src?.includes('img.shields.io')) return null
    return <img src={src} alt={alt} className="max-w-full rounded" {...props} />
  },
  table: ({ children, ...props }) => (
    <div className="overflow-x-auto mb-2">
      <table className="w-full text-sm border-collapse" {...props}>{children}</table>
    </div>
  ),
  th: ({ children, ...props }) => (
    <th className="border border-border px-2 py-1 text-left font-medium bg-muted" {...props}>{children}</th>
  ),
  td: ({ children, ...props }) => (
    <td className="border border-border px-2 py-1" {...props}>{children}</td>
  ),
  input: ({ ...props }) => (
    <input className="mr-1.5 accent-primary" disabled {...props} />
  ),
  hr: (props) => (
    <hr className="my-3 border-border" {...props} />
  ),
  blockquote: ({ children, ...props }) => (
    <blockquote className="border-l-2 border-yellow-500/40 bg-yellow-500/5 rounded-r-md pl-3 pr-2 py-2 my-2 text-sm text-muted-foreground" {...props}>{children}</blockquote>
  ),
}

export function UpdateChangelog({ releaseNotes }: { releaseNotes: string }) {
  return (
    <div className="space-y-1">
      <Markdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {preprocessMarkdown(releaseNotes)}
      </Markdown>
    </div>
  )
}
