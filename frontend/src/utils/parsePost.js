/**
 * Split a generated post into headline, body paragraphs, and hashtags.
 * The LLM always produces:
 *   Line 1  → headline
 *   blank line
 *   Paragraph(s)
 *   blank line
 *   #tag1 #tag2 …
 */
export function parsePost(content) {
  if (!content?.trim()) return { headline: '', paragraphs: [], hashtags: [] };

  const blocks = content
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);

  if (!blocks.length) return { headline: '', paragraphs: [], hashtags: [] };

  // Last block is hashtags if it starts with # or is mostly hashtag tokens
  const last = blocks[blocks.length - 1];
  const hashtagTokens = (last.match(/#\w+/g) || []).length;
  const totalTokens = last.split(/\s+/).length;
  const isHashtagBlock = last.startsWith('#') || (totalTokens > 0 && hashtagTokens / totalTokens > 0.5);

  const hashtags = isHashtagBlock ? (last.match(/#\w+/g) || []) : [];
  const mainBlocks = isHashtagBlock ? blocks.slice(0, -1) : blocks;

  const headline = mainBlocks[0] ?? '';
  const paragraphs = mainBlocks.slice(1);

  return { headline, paragraphs, hashtags };
}

export function hashtagsText(hashtags) {
  return hashtags.join(' ');
}
