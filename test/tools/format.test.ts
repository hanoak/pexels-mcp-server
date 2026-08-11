import { describe, expect, it } from 'vitest'

import type { Photo } from '../../src/schemas/photo.js'
import type { Video } from '../../src/schemas/video.js'
import {
  buildCredit,
  toCompactCollection,
  toCompactPhoto,
  toCompactVideo,
} from '../../src/tools/format.js'

const photo: Photo = {
  id: 123,
  width: 4000,
  height: 3000,
  url: 'https://www.pexels.com/photo/123',
  photographer: 'Jane Doe',
  photographer_url: 'https://www.pexels.com/@janedoe',
  photographer_id: 42,
  avg_color: '#0c0c0c',
  src: {
    original: 'https://images.pexels.com/photos/123/original.jpg',
    large2x: 'https://images.pexels.com/photos/123/large2x.jpg',
    large: 'https://images.pexels.com/photos/123/large.jpg',
    medium: 'https://images.pexels.com/photos/123/medium.jpg',
    small: 'https://images.pexels.com/photos/123/small.jpg',
    portrait: 'https://images.pexels.com/photos/123/portrait.jpg',
    landscape: 'https://images.pexels.com/photos/123/landscape.jpg',
    tiny: 'https://images.pexels.com/photos/123/tiny.jpg',
  },
  alt: 'A cat on a sofa',
}

describe('buildCredit', () => {
  it('builds a named-photographer credit with a link', () => {
    const credit = buildCredit(photo)
    expect(credit.text).toBe('Photo by Jane Doe on Pexels')
    expect(credit.html).toContain('href="https://www.pexels.com/@janedoe"')
    expect(credit.html).toContain('Jane Doe')
    expect(credit.html).toContain('href="https://www.pexels.com"')
  })

  it('falls back gracefully when the photographer name is missing', () => {
    const credit = buildCredit({ id: 1 })
    expect(credit.text).toBe('Photo on Pexels')
    expect(credit.html).toContain('a Pexels photographer')
  })

  it('escapes HTML-significant characters in the photographer name', () => {
    const credit = buildCredit({
      id: 1,
      photographer: 'Bob "The <Builder>" & Co',
      photographer_url: 'https://www.pexels.com/@bob',
    })
    expect(credit.html).not.toContain('<Builder>')
    expect(credit.html).toContain('&lt;Builder&gt;')
  })
})

describe('toCompactPhoto', () => {
  it('projects every field the tool output relies on', () => {
    const compact = toCompactPhoto(photo)
    expect(compact.id).toBe(123)
    expect(compact.alt).toBe('A cat on a sofa')
    expect(compact.src.original).toContain('original.jpg')
    expect(compact.photographer).toEqual({
      name: 'Jane Doe',
      url: 'https://www.pexels.com/@janedoe',
      id: 42,
    })
    expect(compact.credit.text).toBe('Photo by Jane Doe on Pexels')
  })

  it('nulls out missing nullable fields rather than leaving them undefined', () => {
    const compact = toCompactPhoto({ id: 1 })
    expect(compact.alt).toBeNull()
    expect(compact.avg_color).toBeNull()
  })
})

function makeVideoFile(height: number, quality: string): Video['video_files'][number] {
  return {
    id: height,
    quality,
    file_type: 'video/mp4',
    width: Math.round((height * 16) / 9),
    height,
    fps: 25,
    link: `https://videos.pexels.com/${height}.mp4`,
  }
}

const video: Video = {
  id: 456,
  width: 3840,
  height: 2160,
  url: 'https://www.pexels.com/video/456',
  image: 'https://images.pexels.com/videos/456/preview.jpg',
  duration: 30,
  user: { id: 7, name: 'Jane Doe', url: 'https://www.pexels.com/@janedoe' },
  video_files: [
    makeVideoFile(2160, 'hd'),
    makeVideoFile(1080, 'hd'),
    makeVideoFile(720, 'hd'),
    makeVideoFile(480, 'sd'),
    makeVideoFile(360, 'sd'),
    makeVideoFile(240, 'sd'),
    makeVideoFile(144, 'sd'),
  ],
  video_pictures: [
    { id: 1, picture: 'https://images.pexels.com/videos/456/pic1.jpg', nr: 0 },
    { id: 2, picture: 'https://images.pexels.com/videos/456/pic2.jpg', nr: 1 },
  ],
}

describe('toCompactVideo', () => {
  it('trims video_files to the top 5 by height, sorted descending, with a full count', () => {
    const compact = toCompactVideo(video)
    expect(compact.video_files).toHaveLength(5)
    expect(compact.video_files.map((f) => f.height)).toEqual([2160, 1080, 720, 480, 360])
    expect(compact.video_files_count).toBe(7)
  })

  it('returns every rendition when fullFiles is requested', () => {
    const compact = toCompactVideo(video, { fullFiles: true })
    expect(compact.video_files).toHaveLength(7)
    expect(compact.video_files_count).toBe(7)
  })

  it('projects only the first preview picture, with a full count', () => {
    const compact = toCompactVideo(video)
    expect(compact.preview_picture).toContain('pic1.jpg')
    expect(compact.video_pictures_count).toBe(2)
  })

  it('nulls out missing quality/dimensions on a video file', () => {
    const compact = toCompactVideo({
      id: 1,
      video_files: [{ id: 1, link: 'https://videos.pexels.com/1.mp4' }],
      video_pictures: [],
    })
    expect(compact.video_files[0]).toMatchObject({ quality: null, width: null, height: null })
    expect(compact.preview_picture).toBeUndefined()
  })

  it('handles a video with no files or pictures', () => {
    const compact = toCompactVideo({ id: 1, video_files: [], video_pictures: [] })
    expect(compact.video_files).toEqual([])
    expect(compact.video_files_count).toBe(0)
    expect(compact.preview_picture).toBeUndefined()
    expect(compact.video_pictures_count).toBe(0)
  })
})

describe('toCompactCollection', () => {
  it('projects a full collection', () => {
    const compact = toCompactCollection({
      id: 'abc123',
      title: 'Nature',
      description: 'Nature photos and videos',
      private: false,
      media_count: 10,
      photos_count: 8,
      videos_count: 2,
    })
    expect(compact).toEqual({
      id: 'abc123',
      title: 'Nature',
      description: 'Nature photos and videos',
      private: false,
      media_count: 10,
      photos_count: 8,
      videos_count: 2,
    })
  })

  it('nulls out missing title/description', () => {
    const compact = toCompactCollection({ id: 'x' })
    expect(compact.title).toBeNull()
    expect(compact.description).toBeNull()
  })
})
