import { describe, expect, it } from 'vitest';
import { extractYoutubeVideoId, moveItem } from './youtube';

describe('extractYoutubeVideoId', () => {
  it('accepts a bare 11-char video id', () => {
    expect(extractYoutubeVideoId('dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('accepts a watch URL', () => {
    expect(extractYoutubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('accepts a youtu.be short URL', () => {
    expect(extractYoutubeVideoId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('accepts a live URL (YouTube LIVE mode)', () => {
    expect(extractYoutubeVideoId('https://www.youtube.com/live/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('accepts an embed URL', () => {
    expect(extractYoutubeVideoId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('accepts a shorts URL', () => {
    expect(extractYoutubeVideoId('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('rejects garbage input', () => {
    expect(extractYoutubeVideoId('not a url or id')).toBeNull();
  });

  it('rejects an unrelated URL', () => {
    expect(extractYoutubeVideoId('https://example.com/video')).toBeNull();
  });

  it('rejects a too-short id', () => {
    expect(extractYoutubeVideoId('short')).toBeNull();
  });
});

describe('moveItem', () => {
  const ids = ['a', 'b', 'c'];

  it('moves an item up', () => {
    expect(moveItem(ids, 1, 'up')).toEqual(['b', 'a', 'c']);
  });

  it('moves an item down', () => {
    expect(moveItem(ids, 1, 'down')).toEqual(['a', 'c', 'b']);
  });

  it('is a no-op moving the first item up', () => {
    expect(moveItem(ids, 0, 'up')).toEqual(['a', 'b', 'c']);
  });

  it('is a no-op moving the last item down', () => {
    expect(moveItem(ids, 2, 'down')).toEqual(['a', 'b', 'c']);
  });
});
