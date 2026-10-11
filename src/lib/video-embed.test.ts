// src/lib/video-embed.test.ts

import { describe, it, expect } from 'vitest'
import { parseVideoUrl } from './video-embed'

const YT = 'dQw4w9WgXcQ'

describe('parseVideoUrl — YouTube', () => {
  it('accepts every common shape of a YouTube link', () => {
    for (const input of [
      `https://www.youtube.com/watch?v=${YT}`,
      `https://youtube.com/watch?v=${YT}&t=42s`,
      `https://m.youtube.com/watch?v=${YT}`,
      `https://youtu.be/${YT}`,
      `https://youtu.be/${YT}?si=abc123`,
      `https://www.youtube.com/embed/${YT}`,
      `https://www.youtube.com/shorts/${YT}`,
      `https://www.youtube.com/live/${YT}`,
      `https://www.youtube-nocookie.com/embed/${YT}`,
    ]) {
      expect(parseVideoUrl(input), input).toEqual({
        kind: 'iframe',
        provider: 'youtube',
        src: `https://www.youtube-nocookie.com/embed/${YT}?rel=0`,
      })
    }
  })

  it('ignores whitespace around the pasted link', () => {
    expect(parseVideoUrl(`  https://youtu.be/${YT}  `).kind).toBe('iframe')
  })

  it('rejects a YouTube link whose id is the wrong length', () => {
    expect(parseVideoUrl('https://www.youtube.com/watch?v=short').kind).toBe('none')
    expect(parseVideoUrl('https://youtu.be/').kind).toBe('none')
  })

  it('rejects a YouTube page that is not a video', () => {
    expect(parseVideoUrl('https://www.youtube.com/@somechannel').kind).toBe('none')
    expect(parseVideoUrl('https://www.youtube.com/').kind).toBe('none')
  })

  it('does not trust a lookalike host', () => {
    expect(parseVideoUrl(`https://youtube.com.evil.example/watch?v=${YT}`).kind).toBe('none')
    expect(parseVideoUrl(`https://notyoutube.com/watch?v=${YT}`).kind).toBe('none')
  })
})

describe('parseVideoUrl — Vimeo', () => {
  it('accepts a normal and a player link', () => {
    const expected = {
      kind: 'iframe',
      provider: 'vimeo',
      src: 'https://player.vimeo.com/video/123456789?dnt=1',
    }
    expect(parseVideoUrl('https://vimeo.com/123456789')).toEqual(expected)
    expect(parseVideoUrl('https://www.vimeo.com/123456789')).toEqual(expected)
    expect(parseVideoUrl('https://player.vimeo.com/video/123456789')).toEqual(expected)
    expect(parseVideoUrl('https://vimeo.com/channels/staffpicks/123456789')).toEqual(expected)
  })

  it('rejects a Vimeo page with no video id', () => {
    expect(parseVideoUrl('https://vimeo.com/').kind).toBe('none')
    expect(parseVideoUrl('https://vimeo.com/someuser').kind).toBe('none')
  })
})

describe('parseVideoUrl — Instagram Reels and posts', () => {
  const REEL = 'C8xYzAbCdEf'

  it('accepts every common shape of a Reel link and embeds it as a reel', () => {
    for (const input of [
      `https://www.instagram.com/reel/${REEL}/`,
      `https://instagram.com/reel/${REEL}`,
      `https://www.instagram.com/reel/${REEL}/?igsh=MWQxZG5ibjA1`,
      `https://www.instagram.com/reels/${REEL}/`,
      `https://www.instagram.com/some.creator_1/reel/${REEL}/`,
      `https://www.instagram.com/reel/${REEL}/embed`,
    ]) {
      expect(parseVideoUrl(input), input).toEqual({
        kind: 'iframe',
        provider: 'instagram',
        src: `https://www.instagram.com/reel/${REEL}/embed`,
      })
    }
  })

  it('embeds a regular video post as a post', () => {
    expect(parseVideoUrl(`https://www.instagram.com/p/${REEL}/`)).toEqual({
      kind: 'iframe',
      provider: 'instagram',
      src: `https://www.instagram.com/p/${REEL}/embed`,
    })
  })

  it('rejects Instagram pages that are not a single reel or post', () => {
    expect(parseVideoUrl('https://www.instagram.com/some.creator/').kind).toBe('none')
    expect(parseVideoUrl('https://www.instagram.com/reels/').kind).toBe('none')
    expect(parseVideoUrl('https://www.instagram.com/explore/').kind).toBe('none')
    expect(parseVideoUrl('https://www.instagram.com/').kind).toBe('none')
  })

  it('does not trust a lookalike host or a smuggled id', () => {
    expect(parseVideoUrl(`https://instagram.com.evil.example/reel/${REEL}/`).kind).toBe('none')
    expect(parseVideoUrl(`https://notinstagram.com/reel/${REEL}/`).kind).toBe('none')
    expect(parseVideoUrl(`https://evil.example/instagram.com/reel/${REEL}/`).kind).toBe('none')
    expect(parseVideoUrl('https://www.instagram.com/reel/..%2F..%2Fx/').kind).toBe('none')
    expect(parseVideoUrl('https://www.instagram.com/reel/ab/').kind).toBe('none')
  })
})

describe('parseVideoUrl — direct files', () => {
  it('accepts https links to real video files', () => {
    for (const input of [
      'https://cdn.example.com/demo.mp4',
      'https://cdn.example.com/a/b/demo.WEBM',
      'https://cdn.example.com/demo.mov?token=abc',
      'https://cdn.example.com/demo.m4v',
    ]) {
      const result = parseVideoUrl(input)
      expect(result.kind, input).toBe('file')
    }
  })

  it('rejects a page that is not a video file', () => {
    expect(parseVideoUrl('https://example.com/pricing').kind).toBe('none')
    expect(parseVideoUrl('https://example.com/demo.html').kind).toBe('none')
  })
})

describe('parseVideoUrl — safety and empties', () => {
  it('returns none for empty input', () => {
    expect(parseVideoUrl('')).toEqual({ kind: 'none' })
    expect(parseVideoUrl('   ')).toEqual({ kind: 'none' })
    expect(parseVideoUrl(undefined)).toEqual({ kind: 'none' })
    expect(parseVideoUrl(null)).toEqual({ kind: 'none' })
  })

  it('refuses anything that is not https', () => {
    expect(parseVideoUrl(`http://youtu.be/${YT}`).kind).toBe('none')
    expect(parseVideoUrl('http://cdn.example.com/demo.mp4').kind).toBe('none')
    expect(parseVideoUrl('javascript:alert(1)').kind).toBe('none')
    expect(parseVideoUrl('data:video/mp4;base64,AAAA').kind).toBe('none')
    expect(parseVideoUrl('//cdn.example.com/demo.mp4').kind).toBe('none')
  })

  it('returns none for text that is not a URL at all', () => {
    expect(parseVideoUrl('not a url')).toEqual({ kind: 'none' })
  })
})
