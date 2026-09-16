import Card, { CardTitle } from './Card';
import { Send } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../../i18n/index.jsx';

// Inside a panel already, so this draws no border of its own — just a slightly
// lifted ground. Clamped to three lines: a published Hindi post is long enough
// to make one of these cards twice the height of its neighbour.
function PostCard({ post }) {
  const date = new Date(post.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div className="dash-inset dash-hover group flex flex-col justify-between p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="line-clamp-3 text-[13px] leading-relaxed text-[#c3ccea]">{post.content}</p>
        <Send size={14} strokeWidth={1.8} className="mt-0.5 shrink-0 text-[#6aa8ff]" />
      </div>

      <div className="mt-3.5 flex items-center justify-between gap-3">
        <span className="text-[11px] text-[#6b78a0]">{date}</span>
        {post.hashtags?.length > 0 && (
          <span className="truncate text-[11.5px] text-[#6aa8ff]">
            {post.hashtags.slice(0, 2).map((h) => `#${h}`).join(' ')}
          </span>
        )}
      </div>
    </div>
  );
}

export default function SavedPromptsGrid({ posts = [] }) {
  const { t } = useI18n();
  const navigate = useNavigate();

  return (
    <Card>
      <div className="flex items-center justify-between">
        <CardTitle>{t('saved.title')}</CardTitle>
        {posts.length > 0 && (
          <span className="text-[12px] text-[#6b78a0]">{posts.length} post{posts.length !== 1 ? 's' : ''}</span>
        )}
      </div>

      {posts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <Send size={32} strokeWidth={1.4} className="text-[#2a3566] mb-3" />
          <p className="text-[13px] text-[#6b78a0]">{t('saved.none')}</p>
          <button
            type="button"
            onClick={() => navigate('/generate')}
            className="mt-4 rounded-xl btn-gradient px-6 py-2.5 text-[13px] font-semibold text-white"
          >
            {t('saved.create')}
          </button>
        </div>
      ) : (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {posts.slice(0, 4).map((p) => (
            <PostCard key={p.id} post={p} />
          ))}
        </div>
      )}
    </Card>
  );
}
