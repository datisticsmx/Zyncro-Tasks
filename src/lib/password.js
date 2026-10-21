/** Puntaje 0–4: largo mínimo de la API (10) + variedad de caracteres. */
export function scorePassword(pw = '') {
  if (pw.length < 10) return pw.length === 0 ? 0 : 1
  let score = 1
  const variety = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(pw)).length
  if (variety >= 2) score += 1
  if (variety >= 3) score += 1
  if (pw.length >= 14 && variety >= 3) score += 1
  return Math.min(score, 4)
}
