import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

/**
 * Convierte cualquier HTML crudo del Markdown en texto literal: un
 * `<script>…</script>` se ve tal cual, escapado, y nunca se interpreta.
 */
function htmlAsText() {
  const walk = (node) => {
    if (node.type === 'html') node.type = 'text'
    if (node.children) node.children.forEach(walk)
  }
  return (tree) => walk(tree)
}

/**
 * Markdown sanitizado (RNF-SEC-03, CA-11): el HTML crudo se muestra como texto
 * (htmlAsText) y react-markdown neutraliza URLs `javascript:` con su
 * urlTransform por defecto.
 */
export function Markdown({ children }) {
  return (
    <div className="markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, htmlAsText]}
        components={{
          // `node` (AST) se separa para no pasarlo como atributo al DOM.
          // eslint-disable-next-line no-unused-vars
          a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer nofollow" />,
          // eslint-disable-next-line no-unused-vars
          img: ({ node: _node, alt, ...props }) => <img alt={alt || ''} loading="lazy" referrerPolicy="no-referrer" {...props} />,
        }}
      >
        {children || ''}
      </ReactMarkdown>
    </div>
  )
}
