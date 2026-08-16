import { parsePost } from '../../utils/parsePost';

export default function PostContent({ content, className = '' }) {
  if (!content?.trim()) return null;

  const { headline, paragraphs, hashtags } = parsePost(content);

  // If parsing produced nothing meaningful, render the raw content as plain text
  // so the post is never invisible to the user.
  const hasStructure = headline || paragraphs.length > 0;
  if (!hasStructure) {
    return (
      <div className={`space-y-3 ${className}`} style={{ fontFamily: "'Mangal', 'Noto Sans Devanagari', serif" }}>
        <p className="whitespace-pre-wrap text-[18px] leading-[1.95] text-[#dbe6f7] md:text-[19px]">
          {content.trim()}
        </p>
      </div>
    );
  }

  return (
    <div className={`space-y-5 ${className}`} style={{ fontFamily: "'Mangal', 'Noto Sans Devanagari', serif" }}>
      {headline && (
        <p className="text-[24px] font-bold leading-[1.45] text-white md:text-[27px]">
          {headline}
        </p>
      )}

      {paragraphs.map((para, i) => (
        <p key={i} className="text-[18px] leading-[1.95] text-[#dbe6f7] md:text-[19px]">
          {para}
        </p>
      ))}

      {hashtags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {hashtags.map((tag) => (
            <span
              key={tag}
              className="rounded-full px-3 py-1 text-[14.5px] font-medium"
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
