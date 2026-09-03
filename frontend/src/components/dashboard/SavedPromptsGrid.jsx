import Card, { CardTitle } from './Card';
import { Send } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../../i18n/index.jsx';

function PostCard({ post }) {
  const preview = post.content?.slice(0, 120) + (post.content?.length > 120 ? '…' : '');
  const date = new Date(post.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div
      className="group relative flex flex-col justify-between rounded-xl border p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-[#3f9fff]/40"
      style={{
        background: 'linear-gradient(180deg, rgba(14,23,55,0.85) 0%, rgba(9,14,33,0.85) 100%)',
        borderColor: 'rgba(60,85,155,0.22)',
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] leading-snug text-[#c3ccea] line-clamp-3">{preview}</p>
        <Send size={14} strokeWidth={1.8} className="shrink-0 text-[#6aa8ff]" />
      </div>

      <div className="mt-4 flex items-center justify-between">
        <span className="text-[11px] text-[#6b78a0]">{date}</span>
        {post.hashtags?.length > 0 && (
          <span className="text-[11.5px] text-[#6aa8ff]">
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
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {posts.slice(0, 4).map((p) => (
            <PostCard key={p.id} post={p} />
          ))}
        </div>
      )}
    </Card>
  );
}
