import type { Photo } from '../schemas/photo.js'
import type { Video } from '../schemas/video.js'

const PEXELS_BASE = 'https://www.pexels.com'
// A video can carry 10+ renditions; dumping them all across a page of search
// results is a token blowout, so list contexts keep only the
// highest-resolution few (plus the full count) by default.
const MAX_VIDEO_FILES = 5

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

/** Token-efficient projection of one video rendition for tool output. */
export interface CompactVideoFile {
  readonly quality: string | null
  readonly file_type: string | undefined
  readonly width: number | null
  readonly height: number | null
  readonly fps: number | undefined
  readonly link: string | undefined
}

/** Token-efficient projection of a video for tool output. */
export interface CompactVideo {
  readonly id: number
  readonly url: string | undefined
  readonly image: string | undefined
  readonly width: number | undefined
  readonly height: number | undefined
  readonly duration: number | undefined
  readonly user: {
    readonly name: string | undefined
    readonly url: string | undefined
    readonly id: number | undefined
  }
  readonly video_files: readonly CompactVideoFile[]
  readonly video_files_count: number
  readonly preview_picture: string | undefined
  readonly video_pictures_count: number
}

/**
 * Explains the video_files trimming behaviour so the model knows how to get
 * the complete rendition list when the top few aren't the right fit.
 */
export const VIDEO_FILES_HINT =
  ' `video_files` is trimmed to the highest-resolution renditions (see `video_files_count` for ' +
  'the full count) — call pexels_get_video for the complete rendition list on one video.'

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

function toCompactVideoFile(file: Video['video_files'][number]): CompactVideoFile {
  return {
    quality: file.quality ?? null,
    file_type: file.file_type,
    width: file.width ?? null,
    height: file.height ?? null,
    fps: file.fps,
    link: file.link,
  }
}

/**
 * Project a full video into the compact shape returned by tools. By default
 * `video_files` is trimmed to the highest-resolution few (see
 * {@link MAX_VIDEO_FILES}) since a page of search results can carry 10+
 * renditions per video; pass `fullFiles: true` (used by the single-item
 * `pexels_get_video` lookup) to return every rendition instead.
 */
export function toCompactVideo(video: Video, options: { fullFiles?: boolean } = {}): CompactVideo {
  const sortedFiles = [...video.video_files].sort((a, b) => (b.height ?? 0) - (a.height ?? 0))
  const files = options.fullFiles ? sortedFiles : sortedFiles.slice(0, MAX_VIDEO_FILES)

  return {
    id: video.id,
    url: video.url,
    image: video.image,
    width: video.width,
    height: video.height,
    duration: video.duration,
    user: { name: video.user?.name, url: video.user?.url, id: video.user?.id },
    video_files: files.map(toCompactVideoFile),
    video_files_count: video.video_files.length,
    preview_picture: video.video_pictures[0]?.picture,
    video_pictures_count: video.video_pictures.length,
  }
}
