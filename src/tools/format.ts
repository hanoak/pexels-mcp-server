import type { Photo } from '../schemas/photo.js'

const PEXELS_BASE = 'https://www.pexels.com'

/** Non-mandatory courtesy credit for a photo — Pexels' license doesn't require attribution. */
export interface Credit {
  /** Plain-text credit, e.g. `Photo by Jane Doe on Pexels`. */
  readonly text: string
  /** HTML credit with links to the photographer and Pexels. */
  readonly html: string
}

/** Token-efficient projection of a photo for tool output. */
export interface CompactPhoto {
  readonly id: number
  readonly alt: string | null
  readonly width: number | undefined
  readonly height: number | undefined
  readonly avg_color: string | null
  readonly url: string | undefined
  readonly src: {
    readonly original: string | undefined
    readonly large: string | undefined
    readonly medium: string | undefined
    readonly small: string | undefined
    readonly portrait: string | undefined
    readonly landscape: string | undefined
    readonly tiny: string | undefined
  }
  readonly photographer: {
    readonly name: string | undefined
    readonly url: string | undefined
    readonly id: number | undefined
  }
  readonly credit: Credit
}

/**
 * Reminds the model that Pexels returns several fixed pre-sized URLs rather
 * than Unsplash-style dynamic imgix params — pick the closest fit instead of
 * always defaulting to `original`.
 */
export const IMAGE_URL_HINT =
  ' Each photo includes several pre-sized URLs in `src` (original/large2x/large/medium/small/' +
  'portrait/landscape/tiny) — pick the closest fit rather than always using `original`.'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Build a non-mandatory courtesy credit for a photo. */
export function buildCredit(photo: Photo): Credit {
  const name = photo.photographer
  const url = photo.photographer_url

  const text = name ? `Photo by ${name} on Pexels` : 'Photo on Pexels'
  const namePart =
    name && url ? `<a href="${url}">${escapeHtml(name)}</a>` : (name ?? 'a Pexels photographer')
  const html = `Photo by ${namePart} on <a href="${PEXELS_BASE}">Pexels</a>`

  return { text, html }
}

/** Project a full photo into the compact shape returned by tools. */
export function toCompactPhoto(photo: Photo): CompactPhoto {
  return {
    id: photo.id,
    alt: photo.alt ?? null,
    width: photo.width,
    height: photo.height,
    avg_color: photo.avg_color ?? null,
    url: photo.url,
    src: {
      original: photo.src?.original,
      large: photo.src?.large,
      medium: photo.src?.medium,
      small: photo.src?.small,
      portrait: photo.src?.portrait,
      landscape: photo.src?.landscape,
      tiny: photo.src?.tiny,
    },
    photographer: {
      name: photo.photographer,
      url: photo.photographer_url,
      id: photo.photographer_id,
    },
    credit: buildCredit(photo),
  }
}
