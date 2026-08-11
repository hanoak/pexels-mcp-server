import { describe, expect, it } from 'vitest'

import type { Photo } from '../../src/schemas/photo.js'
import { buildCredit, toCompactPhoto } from '../../src/tools/format.js'

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
  liked: false,
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
