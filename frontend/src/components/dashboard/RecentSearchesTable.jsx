import Card, { CardTitle } from './Card';
import { ChevronRight, Clock, FileText } from 'lucide-react';
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

function StatusChip({ status, label }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-0.5 text-[11px] font-medium capitalize ${STATUS_STYLE[status] ?? STATUS_STYLE.draft}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

export default function RecentSearchesTable({ posts = [], loading = false }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const recent = posts.slice(0, 8);

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <CardTitle>{t('card.recentPosts')}</CardTitle>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/posts')}
            className="inline-flex min-h-9 items-center text-[12px] text-[#6aa8ff] underline underline-offset-2 transition-opacity hover:opacity-80"
          >
            {t('saved.viewAll')}
          </button>
          <button
            type="button"
            onClick={() => navigate('/generate')}
            className="inline-flex min-h-9 items-center text-[12px] text-[#6aa8ff] underline underline-offset-2 transition-opacity hover:opacity-80"
          >
            {t('card.generateNew')}
          </button>
        </div>
      </div>

      {loading ? (
        <p className="py-8 text-center text-[13px] text-[#6b78a0]">{t('common.loading')}</p>
      ) : recent.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <FileText size={30} strokeWidth={1.4} className="mb-3 text-[#2a3566]" />
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
        <>
          {/* Phones read this as a feed. The table was 640px wide inside a
              scroller, so on a phone it was a column of posts you had to drag
              sideways to see the date of. */}
          <ul className="mt-3 divide-y divide-[#1a254a]/45 md:hidden">
            {recent.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => navigate('/posts')}
                  className="flex w-full items-start gap-3 py-3 text-left transition-colors hover:bg-[#0e1736]/50"
                >
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 text-[13px] font-medium leading-snug text-white">{p.content}</span>
                    <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                      <span className="inline-flex items-center gap-1.5 text-[11.5px] text-[#8b94b8]">
                        <Clock size={11} strokeWidth={1.8} />
                        {formatDate(p.created_at)}
                      </span>
                      <StatusChip status={p.status} label={t(`status.${p.status}`)} />
                    </span>
                  </span>
                  <ChevronRight size={15} strokeWidth={2} className="mt-1 shrink-0 text-[#3f6aaa]" />
                </button>
              </li>
            ))}
          </ul>

          <div className="mt-3 hidden w-full overflow-x-auto md:block">
            <table className="w-full min-w-[620px] text-left">
              <thead>
                <tr className="text-[11px] uppercase tracking-wider text-[#6b78a0]">
                  <th className="py-2.5 pr-4 font-medium">{t('card.contentPreview')}</th>
                  <th className="py-2.5 pr-4 font-medium">{t('card.date')}</th>
                  <th className="py-2.5 pr-4 font-medium">{t('card.hashtags')}</th>
                  <th className="py-2.5 font-medium">{t('card.status')}</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((p) => (
                  <tr
                    key={p.id}
                    className="border-t border-[#1a254a]/45 text-[13px] text-[#c3ccea] transition-colors hover:bg-[#0e1736]/60"
                  >
                    <td className="max-w-[320px] py-3 pr-4 font-medium text-white">
                      <span className="line-clamp-1">{p.content}</span>
                    </td>
                    <td className="whitespace-nowrap py-3 pr-4 text-[#8b94b8]">
                      <span className="inline-flex items-center gap-1.5">
                        <Clock size={12} strokeWidth={1.8} />
                        {formatDate(p.created_at)}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-[#8b94b8]">
                      {p.hashtags?.length ? (
                        <span className="line-clamp-1 text-[12px]">
                          {p.hashtags.slice(0, 3).map((h) => `#${h}`).join(' ')}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="py-3">
                      <StatusChip status={p.status} label={t(`status.${p.status}`)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Card>
  );
}
