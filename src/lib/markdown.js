/**
 * Plugins de remark que usa <Markdown>. Viven aquí (y no en el componente)
 * porque son lógica pura sobre el AST, sin React.
 */

/**
 * Convierte cualquier HTML crudo del Markdown en texto literal: un
 * `<script>…</script>` se ve tal cual, escapado, y nunca se interpreta
 * (RNF-SEC-03, CA-11).
 */
export function htmlAsText() {
  const walk = (node) => {
    if (node.type === 'html') node.type = 'text'
    if (node.children) node.children.forEach(walk)
  }
  return (tree) => walk(tree)
}

/**
 * Un Enter en el campo de texto se ve como un salto de línea al mostrarlo.
 *
 * En Markdown estándar un `\n` dentro de un párrafo es solo un espacio (haría
 * falta terminar la línea con dos espacios o dejar una línea en blanco), y
 * nadie escribe así en un formulario: aquí cada `\n` se convierte en un nodo
 * `break` (<br>), que es lo que hace remark-breaks, sin sumar dependencias.
 *
 * Solo toca nodos de texto, así que el contenido de un bloque de código o de
 * `inlineCode` —que en el AST son hojas con su propio `value`— queda intacto.
 */
export function softBreaks() {
  const walk = (node) => {
    if (!node.children) return
    const out = []
    for (const child of node.children) {
      if (child.type === 'text' && child.value.includes('\n')) {
        const partes = child.value.split('\n')
        partes.forEach((parte, i) => {
          if (i > 0) out.push({ type: 'break' })
          if (parte) out.push({ type: 'text', value: parte })
        })
      } else {
        out.push(child)
        walk(child)
      }
    }
    node.children = out
  }
  return (tree) => walk(tree)
}
