import Card, { CardTitle } from './Card';
import { Clock, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../../i18n/index.jsx';

const STATUS_STYLE = {
  published: 'border-[#1c4a33]/70 bg-[#0e2a1d]/80 text-[#5bdb90]',
  draft:     'border-[#2a3a1a]/70 bg-[#1a2510]/80 text-[#a3c55b]',
  archived:  'border-[#3a2a1a]/70 bg-[#261a0e]/80 text-[#c5935b]',
};

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function RecentSearchesTable({ posts = [], loading = false }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const recent = posts.slice(0, 8);

  return (
    <Card>
      <div className="flex items-center justify-between">
        <CardTitle>{t('card.recentPosts')}</CardTitle>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/posts')}
            className="text-[12px] text-[#6aa8ff] underline underline-offset-2 hover:opacity-80 transition-opacity"
          >
            {t('saved.viewAll')}
          </button>
          <button
            type="button"
            onClick={() => navigate('/generate')}
            className="text-[12px] text-[#6aa8ff] underline underline-offset-2 hover:opacity-80 transition-opacity"
          >
            {t('card.generateNew')}
          </button>
        </div>
      </div>

      <div className="mt-5 w-full overflow-x-auto">
        {loading ? (
          <p className="py-8 text-center text-[13px] text-[#6b78a0]">Loading…</p>
        ) : recent.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <FileText size={32} strokeWidth={1.4} className="text-[#2a3566] mb-3" />
            <p className="text-[13px] text-[#6b78a0]">{t('card.noPostsYet')}</p>
            <button
              type="button"
              onClick={() => navigate('/generate')}
              className="mt-4 rounded-xl btn-gradient px-6 py-2.5 text-[13px] font-semibold text-white"
            >
              {t('card.generateFirst')}
            </button>
          </div>
        ) : (
          <table className="w-full min-w-[640px] text-left">
            <thead>
              <tr className="text-[11.5px] uppercase tracking-wider text-[#6b78a0]">
                <th className="py-3 pr-4 font-medium">{t('card.contentPreview')}</th>
                <th className="py-3 pr-4 font-medium">{t('card.date')}</th>
                <th className="py-3 pr-4 font-medium">{t('card.hashtags')}</th>
                <th className="py-3 pr-4 font-medium">{t('card.status')}</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((p) => (
                <tr
                  key={p.id}
                  className="border-t border-[#1a254a]/40 text-[13px] text-[#c3ccea] transition-colors hover:bg-[#0e1736]/60"
                >
                  <td className="py-3.5 pr-4 font-medium text-white max-w-[300px]">
                    <span className="line-clamp-1">{p.content}</span>
                  </td>
                  <td className="py-3.5 pr-4 text-[#8b94b8] whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5">
                      <Clock size={12} strokeWidth={1.8} />
                      {formatDate(p.created_at)}
                    </span>
                  </td>
                  <td className="py-3.5 pr-4 text-[#8b94b8]">
                    {p.hashtags?.length ? (
                      <span className="line-clamp-1 text-[12px]">
                        {p.hashtags.slice(0, 3).map((h) => `#${h}`).join(' ')}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="py-3.5 pr-4">
                    <span className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11.5px] font-medium capitalize ${STATUS_STYLE[p.status] ?? STATUS_STYLE.draft}`}>
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                      {t(`status.${p.status}`)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Card>
  );
}
