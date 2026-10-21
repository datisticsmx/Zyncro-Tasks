/**
 * Avatares diseñados con DiceBear, estilo "Micah".
 * Diseño: Micah Lanier, CC BY 4.0 (requiere atribución, ver AvatarEditor).
 *
 * En la BD se guarda solo la receta (avatar_config); aquí se convierte en SVG.
 * Las listas de valores deben coincidir con RJBackend/src/zyncro/services/avatar.js.
 */
import { createAvatar } from '@dicebear/core'
import * as micah from '@dicebear/micah'

const COLORS = ['f9c9b6', 'd2eff3', '000000', 'e0ddff', 'f4d150', 'ac6651', '9287ff', 'ffeba4', 'fc909f', 'ffedef', '6bd9e9', '77311d', 'ffffff']

export const AVATAR_OPTIONS = {
  baseColor: ['f9c9b6', 'ac6651', '77311d'],
  hair: ['none', 'fonze', 'mrT', 'dougFunny', 'mrClean', 'dannyPhantom', 'full', 'turban', 'pixie'],
  hairColor: COLORS,
  eyebrows: ['up', 'down', 'eyelashesUp', 'eyelashesDown'],
  eyes: ['eyes', 'round', 'eyesShadow', 'smiling', 'smilingShadow'],
  mouth: ['surprised', 'laughing', 'nervous', 'smile', 'sad', 'pucker', 'frown', 'smirk'],
  nose: ['curve', 'pointed', 'tound'],
  ears: ['attached', 'detached'],
  facialHair: ['none', 'beard', 'scruff'],
  glasses: ['none', 'round', 'square'],
  glassesColor: COLORS,
  earrings: ['none', 'hoop', 'stud'],
  earringColor: COLORS,
  shirt: ['open', 'crew', 'collared'],
  shirtColor: COLORS,
  backgroundColor: ['f7f38a', 'c9a5f7', 'ff8b7b', '7fe3f0', '9ef0a0', 'f7a8cf', 'e6e7eb'],
}

const pick = (list) => list[Math.floor(Math.random() * list.length)]

/** Receta aleatoria (botón "Aleatorio" y punto de partida del editor). */
export function randomAvatar() {
  const cfg = { style: 'micah' }
  for (const [k, list] of Object.entries(AVATAR_OPTIONS)) cfg[k] = pick(list)
  // Accesorios menos frecuentes, como en DiceBear.
  if (Math.random() < 0.7) cfg.glasses = 'none'
  if (Math.random() < 0.7) cfg.earrings = 'none'
  if (Math.random() < 0.85) cfg.facialHair = 'none'
  if (Math.random() < 0.9 && cfg.hair === 'none') cfg.hair = 'full'
  return cfg
}

/** Receta → opciones de DiceBear (cada parte fija, sin azar). */
function toOptions(cfg) {
  const fixed = (name) => (cfg[name] === 'none' ? { [`${name}Probability`]: 0 } : { [name]: [cfg[name]], [`${name}Probability`]: 100 })
  return {
    seed: 'zyncro',
    base: ['standard'],
    baseColor: [cfg.baseColor],
    ...fixed('hair'),
    hairColor: [cfg.hairColor],
    eyebrows: [cfg.eyebrows],
    eyebrowsColor: ['000000'],
    eyes: [cfg.eyes],
    eyesColor: ['000000'],
    eyeShadowColor: ['d2eff3'],
    mouth: [cfg.mouth],
    mouthColor: ['000000'],
    nose: [cfg.nose],
    ears: [cfg.ears],
    ...fixed('facialHair'),
    facialHairColor: ['000000'],
    ...fixed('glasses'),
    glassesColor: [cfg.glassesColor],
    ...fixed('earrings'),
    earringColor: [cfg.earringColor],
    shirt: [cfg.shirt],
    shirtColor: [cfg.shirtColor],
    backgroundColor: [cfg.backgroundColor],
  }
}

// Caché por receta: el mismo avatar aparece muchas veces (tablero, listas).
const cache = new Map()

/** Receta → data URI SVG listo para <img src>. */
export function avatarDataUri(cfg) {
  const key = JSON.stringify(cfg)
  let uri = cache.get(key)
  if (!uri) {
    uri = createAvatar(micah, toOptions(cfg)).toDataUri()
    if (cache.size > 500) cache.clear()
    cache.set(key, uri)
  }
  return uri
}
