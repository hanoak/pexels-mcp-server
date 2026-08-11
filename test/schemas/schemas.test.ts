import { describe, expect, it } from 'vitest'

import {
  CollectionMediaItemSchema,
  CollectionMediaResponseSchema,
  CollectionSchema,
  FeaturedCollectionsResponseSchema,
} from '../../src/schemas/collection.js'
import { PaginationSchema } from '../../src/schemas/pagination.js'
import { parseResponse, SchemaValidationError } from '../../src/schemas/parse.js'
import { CuratedPhotosResponseSchema, PhotoSchema } from '../../src/schemas/photo.js'
import { SearchVideosResponseSchema, VideoSchema } from '../../src/schemas/video.js'

const photoFixture = {
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
  // Fields we do not model (Pexels returns `liked`, but nothing consumes it) —
  // must be tolerated and stripped, not rejected.
  liked: false,
  sponsorship: { tagline: 'sponsored' },
}

const videoFixture = {
  id: 456,
  width: 1920,
  height: 1080,
  url: 'https://www.pexels.com/video/456',
  image: 'https://images.pexels.com/videos/456/preview.jpg',
  duration: 30,
  user: { id: 7, name: 'Jane Doe', url: 'https://www.pexels.com/@janedoe' },
  video_files: [
    {
      id: 1,
      quality: 'hd',
      file_type: 'video/mp4',
      width: 1920,
      height: 1080,
      fps: 25,
      link: 'https://videos.pexels.com/1.mp4',
    },
    {
      id: 2,
      quality: 'sd',
      file_type: 'video/mp4',
      width: 640,
      height: 360,
      fps: 25,
      link: 'https://videos.pexels.com/2.mp4',
    },
  ],
  video_pictures: [{ id: 1, picture: 'https://images.pexels.com/videos/456/pic1.jpg', nr: 0 }],
}

describe('PhotoSchema', () => {
  it('parses a realistic photo and strips unknown fields', () => {
    const photo = PhotoSchema.parse(photoFixture)
    expect(photo.id).toBe(123)
    expect(photo.photographer).toBe('Jane Doe')
    expect(photo.src?.original).toContain('original.jpg')
    expect('sponsorship' in photo).toBe(false)
  })

  it('tolerates null values on nullable fields', () => {
    const photo = PhotoSchema.parse({ id: 1, avg_color: null, alt: null })
    expect(photo.avg_color).toBeNull()
    expect(photo.alt).toBeNull()
  })

  it('requires only id (missing optional nested objects are undefined)', () => {
    const photo = PhotoSchema.parse({ id: 1 })
    expect(photo.src).toBeUndefined()
    expect(photo.photographer).toBeUndefined()
  })

  it('rejects a photo without an id', () => {
    expect(() => PhotoSchema.parse({ photographer: 'no id here' })).toThrow()
  })

  it('rejects a photo with a string id (Pexels IDs are integers, unlike Unsplash)', () => {
    expect(() => PhotoSchema.parse({ id: 'abc123' })).toThrow()
  })
})

describe('CuratedPhotosResponseSchema', () => {
  it('parses a curated response envelope', () => {
    const res = CuratedPhotosResponseSchema.parse({
      page: 1,
      per_page: 15,
      total_results: 8000,
      next_page: 'https://api.pexels.com/v1/curated?page=2',
      photos: [photoFixture],
    })
    expect(res.total_results).toBe(8000)
    expect(res.photos).toHaveLength(1)
    expect(res.photos[0]!.id).toBe(123)
  })

  it('defaults photos to an empty array when missing', () => {
    const res = CuratedPhotosResponseSchema.parse({ page: 1 })
    expect(res.photos).toEqual([])
  })
})

describe('VideoSchema', () => {
  it('parses a realistic video with nested video_files/video_pictures', () => {
    const video = VideoSchema.parse(videoFixture)
    expect(video.id).toBe(456)
    expect(video.video_files).toHaveLength(2)
    expect(video.video_files[0]!.quality).toBe('hd')
    expect(video.video_pictures[0]!.picture).toContain('pic1.jpg')
  })

  it('defaults video_files/video_pictures to empty arrays when missing', () => {
    const video = VideoSchema.parse({ id: 1 })
    expect(video.video_files).toEqual([])
    expect(video.video_pictures).toEqual([])
  })

  it('rejects a video without an id', () => {
    expect(() => VideoSchema.parse({ duration: 30 })).toThrow()
  })
})

describe('SearchVideosResponseSchema', () => {
  it('parses a search-videos response envelope', () => {
    const res = SearchVideosResponseSchema.parse({
      page: 1,
      per_page: 15,
      total_results: 1000,
      videos: [videoFixture],
    })
    expect(res.videos).toHaveLength(1)
    expect(res.videos[0]!.id).toBe(456)
  })
})

describe('CollectionSchema', () => {
  it('parses a realistic collection (string id, unlike photo/video ids)', () => {
    const collection = CollectionSchema.parse({
      id: 'abc123xyz',
      title: 'Nature',
      description: 'Nature photos and videos',
      private: false,
      media_count: 10,
      photos_count: 8,
      videos_count: 2,
    })
    expect(collection.id).toBe('abc123xyz')
    expect(collection.media_count).toBe(10)
  })

  it('rejects a collection without an id', () => {
    expect(() => CollectionSchema.parse({ title: 'no id here' })).toThrow()
  })
})

describe('CollectionMediaItemSchema', () => {
  it('parses a photo-shaped media item regardless of the type field casing', () => {
    const item = CollectionMediaItemSchema.parse({ ...photoFixture, type: 'Photo' })
    expect(item.type).toBe('Photo')
    expect(item.photographer).toBe('Jane Doe')
  })

  it('parses a video-shaped media item', () => {
    const item = CollectionMediaItemSchema.parse({ ...videoFixture, type: 'Video' })
    expect(item.type).toBe('Video')
    expect(item.video_files).toHaveLength(2)
  })

  it('tolerates a missing type field', () => {
    const item = CollectionMediaItemSchema.parse({ id: 1 })
    expect(item.type).toBeUndefined()
  })
})

describe('FeaturedCollectionsResponseSchema / CollectionMediaResponseSchema', () => {
  it('parses a featured-collections envelope', () => {
    const res = FeaturedCollectionsResponseSchema.parse({
      page: 1,
      per_page: 15,
      total_results: 50,
      collections: [{ id: 'abc123', title: 'Nature' }],
    })
    expect(res.collections).toHaveLength(1)
  })

  it('parses a mixed-media collection-media envelope', () => {
    const res = CollectionMediaResponseSchema.parse({
      page: 1,
      media: [
        { ...photoFixture, type: 'Photo' },
        { ...videoFixture, type: 'Video' },
      ],
    })
    expect(res.media).toHaveLength(2)
  })

  it('defaults arrays to empty when missing', () => {
    expect(FeaturedCollectionsResponseSchema.parse({}).collections).toEqual([])
    expect(CollectionMediaResponseSchema.parse({}).media).toEqual([])
  })
})

describe('PaginationSchema', () => {
  it('is fully optional', () => {
    expect(PaginationSchema.parse({})).toEqual({})
  })
})

describe('parseResponse', () => {
  it('returns validated data on success', () => {
    const photo = parseResponse(PhotoSchema, { id: 1 }, 'get photo')
    expect(photo.id).toBe(1)
  })

  it('throws SchemaValidationError on a genuine shape mismatch', () => {
    expect(() => parseResponse(PhotoSchema, { not: 'a photo' }, 'get photo')).toThrow(
      SchemaValidationError,
    )
  })
})
