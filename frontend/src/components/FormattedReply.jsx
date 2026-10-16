/**
 * Renders a BheemBot reply.
 *
 * The backend (backend/semrag/presentation.py) guarantees replies use only this markup:
 *   **Heading**  on its own line   -> a short heading
 *   **phrase**   inside a sentence -> bold
 *   - point                        -> a bullet
 *   > "quotation"                  -> a highlighted quotation of Dr. Ambedkar's words
 * Everything else is plain paragraphs. The reply is turned into React elements, never into
 * raw HTML, so nothing in a reply can inject markup into the page.
 */
import { Quote } from 'lucide-react';

const HEADING = /^\*\*([^*]+?)\*\*:?$/;

/** Split a reply into blocks: paragraphs, headings, bullet lists and quotations. */
export function parseReply(text) {
  const blocks = [];
  let para = [];
  const flush = () => {
    if (para.length) blocks.push({ type: 'p', text: para.join(' ') });
    para = [];
  };
  for (const raw of (text || '').split('\n')) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    const prev = blocks[blocks.length - 1];
    if (line.startsWith('- ') || line.startsWith('• ')) {
      flush();
      const item = line.slice(2).trim();
      if (prev && prev.type === 'ul' && !para.length) prev.items.push(item);
      else blocks.push({ type: 'ul', items: [item] });
    } else if (line.startsWith('>')) {
      flush();
      const quote = line.replace(/^>\s?/, '');
      if (prev && prev.type === 'quote') prev.text += ` ${quote}`;
      else blocks.push({ type: 'quote', text: quote });
    } else if (HEADING.test(line)) {
      flush();
      blocks.push({ type: 'h', text: line.match(HEADING)[1].trim() });
    } else {
      para.push(line);
    }
  }
  flush();
  return blocks;
}

const blockLength = (b) => (b.type === 'ul' ? b.items.join(' ').length : b.text.length);

/**
 * How many leading blocks to show. Replies are asked to stay under ~200 words, so most are
 * shown whole; only one longer than `threshold` characters is collapsed, to as many blocks as
 * fit `budget` - at least one, and never ending on a heading (a heading followed by
 * "Show more" reads as a broken answer).
 */
export function visibleBlockCount(blocks, budget = 700, threshold = 1200) {
  if (blocks.reduce((n, b) => n + blockLength(b), 0) <= threshold) return blocks.length;
  let used = 0;
  let count = blocks.length;
  for (let i = 0; i < blocks.length; i += 1) {
    const b = blocks[i];
    used += blockLength(b);
    if (used > budget) {
      count = Math.max(1, i);
      break;
    }
  }
  while (count > 1 && count < blocks.length && blocks[count - 1].type === 'h') count -= 1;
  return count;
}

/** Inline **bold** inside a line of text. */
function Inline({ text }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith('**') && part.endsWith('**') && part.length > 4 ? (
      <strong key={i} className="font-semibold text-white">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

export default function FormattedReply({ blocks, maxBlocks }) {
  const shown = typeof maxBlocks === 'number' ? blocks.slice(0, maxBlocks) : blocks;
  return (
    <div className="space-y-2.5">
      {shown.map((block, i) => {
        if (block.type === 'h') {
          return (
            <p key={i} className="pt-1 text-[13px] font-semibold tracking-[0.01em] text-[#e6eefb]">
              <Inline text={block.text} />
            </p>
          );
        }
        if (block.type === 'ul') {
          return (
            <ul key={i} className="space-y-1.5">
              {block.items.map((item, j) => (
                <li key={j} className="flex gap-2.5">
                  <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#4d94ff]" aria-hidden="true" />
                  <span>
                    <Inline text={item} />
                  </span>
                </li>
              ))}
            </ul>
          );
        }
        if (block.type === 'quote') {
          return (
            <blockquote
              key={i}
              className="flex gap-2 rounded-lg border-l-2 border-[#4d94ff] bg-[#0b1733] px-3 py-2 italic text-[#e6eefb]"
            >
              <Quote size={12} strokeWidth={2} className="mt-1 shrink-0 text-[#4d94ff]" aria-hidden="true" />
              <span>
                <Inline text={block.text} />
              </span>
            </blockquote>
          );
        }
        return (
          <p key={i}>
            <Inline text={block.text} />
          </p>
        );
      })}
    </div>
  );
}
