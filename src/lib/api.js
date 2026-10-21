/**
 * Cliente de la API de Zyncro (/api/zyncro, mismo origen).
 * Envía siempre la cabecera anti-CSRF que exige el backend y traduce el
 * formato de error { error: { code, message, fields } } a ApiError.
 */

const BASE = '/api/zyncro'

export class ApiError extends Error {
  constructor(status, { code, message, fields } = {}) {
    super(message || 'Error inesperado')
    this.status = status
    this.code = code || 'unknown'
    this.fields = fields || null
  }
}

async function request(method, path, { body, signal } = {}) {
  const headers = { 'X-Requested-With': 'zyncro' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  let res
  try {
    res = await fetch(BASE + path, {
      method,
      headers,
      credentials: 'same-origin',
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    })
  } catch (err) {
    if (err.name === 'AbortError') throw err
    throw new ApiError(0, { code: 'network', message: 'No hay conexión con el servidor' })
  }

  if (res.status === 204) return null
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    if (data?.error) throw new ApiError(res.status, data.error)
    // Respuesta sin el formato de la API: el backend no está corriendo o un
    // proxy respondió por él (en local, el proxy de Vite da 500 vacío).
    throw new ApiError(res.status, {
      code: 'unavailable',
      message:
        res.status >= 500
          ? 'No se pudo conectar con el servidor. Verifica que el backend esté corriendo.'
          : `Error inesperado (${res.status})`,
    })
  }
  return data
}

export const api = {
  get: (path, opts) => request('GET', path, opts),
  post: (path, body, opts) => request('POST', path, { ...opts, body: body ?? {} }),
  patch: (path, body, opts) => request('PATCH', path, { ...opts, body: body ?? {} }),
  put: (path, body, opts) => request('PUT', path, { ...opts, body: body ?? {} }),
  del: (path, opts) => request('DELETE', path, opts),
}

/**
 * Sube un archivo (multipart, campo "file") con progreso. Se usa XHR porque
 * fetch no informa el avance de la subida.
 */
export function uploadFile(path, file, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', BASE + path)
    xhr.withCredentials = true
    xhr.setRequestHeader('X-Requested-With', 'zyncro')
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total)
    xhr.onload = () => {
      let data
      try {
        data = JSON.parse(xhr.responseText)
      } catch {
        data = null
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(data)
      else if (data?.error) reject(new ApiError(xhr.status, data.error))
      else reject(new ApiError(xhr.status, { code: 'unavailable', message: `Error al subir (${xhr.status})` }))
    }
    xhr.onerror = () => reject(new ApiError(0, { code: 'network', message: 'No hay conexión con el servidor' }))
    const form = new FormData()
    form.append('file', file)
    xhr.send(form)
  })
}

/** Arma ?a=1&b=2 omitiendo vacíos. */
export function qs(params) {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') p.set(k, v)
  }
  const s = p.toString()
  return s ? `?${s}` : ''
}
