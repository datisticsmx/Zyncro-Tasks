import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { htmlAsText, softBreaks } from '../lib/markdown'

/**
 * Markdown sanitizado (RNF-SEC-03, CA-11): el HTML crudo se muestra como texto
 * (htmlAsText) y react-markdown neutraliza URLs `javascript:` con su
 * urlTransform por defecto. softBreaks va al final —después de htmlAsText—
 * para que un salto de línea simple se vea como salto, igual que se escribió.
 */
export function Markdown({ children }) {
  return (
    <div className="markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, htmlAsText, softBreaks]}
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
