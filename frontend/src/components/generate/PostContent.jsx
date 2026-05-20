import { parsePost } from '../../utils/parsePost';

export default function PostContent({ content, className = '' }) {
  if (!content?.trim()) return null;

  const { headline, paragraphs, hashtags } = parsePost(content);

  // If parsing produced nothing meaningful, render the raw content as plain text
  // so the post is never invisible to the user.
  const hasStructure = headline || paragraphs.length > 0;
  if (!hasStructure) {
    return (
      <div className={`space-y-3 ${className}`}>
        <p className="whitespace-pre-wrap text-[13.5px] leading-[1.8] text-[#c7d1eb]">
          {content.trim()}
        </p>
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {headline && (
        <p className="font-display text-[15px] font-bold leading-snug text-white">
          {headline}
        </p>
      )}

      {paragraphs.map((para, i) => (
        <p key={i} className="text-[13.5px] leading-[1.8] text-[#c7d1eb]">
          {para}
        </p>
      ))}

      {hashtags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {hashtags.map((tag) => (
            <span
              key={tag}
              className="rounded-full px-2.5 py-0.5 text-[12px] font-medium"
              style={{
                backgroundColor: 'rgba(63,159,255,0.1)',
                border: '1px solid rgba(63,159,255,0.25)',
                color: '#5fa5ff',
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
