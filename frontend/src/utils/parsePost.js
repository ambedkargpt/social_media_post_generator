/**
 * Split a generated post into headline, body paragraphs, and hashtags.
 * Handles two LLM output formats:
 *   A) Hashtags in their own blank-line-separated block:
 *        Headline
 *        Body paragraph(s)
 *        #tag1 #tag2   ← or "Hashtags: #tag1 #tag2"
 *
 *   B) Hashtags appended inline at the end of the last paragraph:
 *        Headline
 *        Body paragraph ending with #tag1 #tag2
 */
export function parsePost(content) {
  if (!content?.trim()) return { headline: '', paragraphs: [], hashtags: [] };

  const blocks = content
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);

  if (!blocks.length) return { headline: '', paragraphs: [], hashtags: [] };

  // ── Format A: last block is a dedicated hashtag block ──────────────────────
  // Use [^\s#]+ so Unicode (Devanagari etc.) hashtag text is captured
  const last = blocks[blocks.length - 1];
  const hashtagTokens = (last.match(/#[^\s#]+/g) || []).length;
  const totalTokens   = last.split(/\s+/).length;
  const isDedicatedHashtagBlock =
    last.startsWith('#') ||
    /^hashtags?\s*:/i.test(last) ||
    (totalTokens > 0 && hashtagTokens / totalTokens > 0.5);

  if (isDedicatedHashtagBlock) {
    const hashtags   = last.match(/#[^\s#]+/g) || [];
    const mainBlocks = blocks.slice(0, -1);
    return {
      headline:   mainBlocks[0] ?? '',
      paragraphs: mainBlocks.slice(1),
      hashtags,
    };
  }

  // ── Format B: hashtags appended inline at end of last paragraph ────────────
  // Strip trailing hashtag run from the final block
  const inlineTagRe = /\s+((?:#[^\s#]+\s*)+)$/;
  const lastBlock   = blocks[blocks.length - 1];
  const inlineMatch = lastBlock.match(inlineTagRe);

  if (inlineMatch) {
    const inlineTags = inlineMatch[1].match(/#[^\s#]+/g) || [];
    if (inlineTags.length) {
      const stripped = lastBlock.slice(0, lastBlock.length - inlineMatch[0].length).trim();
      const mainBlocks = [...blocks.slice(0, -1), ...(stripped ? [stripped] : [])];
      return {
        headline:   mainBlocks[0] ?? '',
        paragraphs: mainBlocks.slice(1),
        hashtags:   inlineTags,
      };
    }
  }

  // ── No hashtags found ──────────────────────────────────────────────────────
  return {
    headline:   blocks[0] ?? '',
    paragraphs: blocks.slice(1),
    hashtags:   [],
  };
}

export function hashtagsText(hashtags) {
  return hashtags.join(' ');
}
