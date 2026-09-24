import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AlertTriangle, Check, ExternalLink, Loader2, Unplug } from 'lucide-react';

import {
  disconnectReddit,
  getRedditAuthorizeUrl,
  getRedditStatus,
} from '../../api/integrations';
import { useI18n } from '../../i18n/index.jsx';

/**
 * The accounts this user has connected elsewhere, and where they land after
 * approving one.
 *
 * Reddit's OAuth is a full page round trip, so the app is reloaded when the
 * user comes back. The `?reddit=` parameter on the return URL is the only
 * thing that survives it, and it is what turns a silent reload into "connected
 * as u/…". It is cleared from the address bar afterwards so a refresh does not
 * replay the message.
 */
export default function ConnectedAccounts() {
  const { t } = useI18n();
  const location = useLocation();
  const navigate = useNavigate();

  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);   // { kind, text }

  const load = useCallback(async () => {
    setLoading(true);
    const data = await getRedditStatus().catch(() => null);
    setStatus(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const result = params.get('reddit');
    if (!result) return;

    if (result === 'connected') {
      setNotice({ kind: 'ok', text: t('pub.connected', { user: params.get('account') || '' }) });
      load();
    } else if (result === 'declined') {
      setNotice({ kind: 'warn', text: t('pub.declined') });
    } else {
      setNotice({ kind: 'warn', text: t('pub.connectError') });
    }
    // Same route, no parameters: a refresh should not show the message again.
    navigate(location.pathname, { replace: true });
  }, [location.search, location.pathname, navigate, load, t]);

  async function connect() {
    setBusy(true);
    try {
      window.location.href = await getRedditAuthorizeUrl();
    } catch {
      setNotice({ kind: 'warn', text: t('pub.connectFailed') });
      setBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    try {
      await disconnectReddit();
      await load();
    } finally {
      setBusy(false);
    }
  }

  // Nothing to offer when the server has no Reddit credentials at all.
  if (!loading && status?.configured === false) return null;

  const connected = Boolean(status?.connected);
  const handle = status?.account?.account_handle;
  const subreddit = status?.subreddit || 'ambedkargpt';

  return (
    <div className="dash-panel mt-10 p-4 sm:p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-[15px] font-semibold text-white">{t('acct.title')}</h2>
        <span className="dash-eyebrow">{t('acct.eyebrow')}</span>
      </div>
      <p className="mt-1.5 text-[12.5px] leading-relaxed text-[#8b94b8]">
        {t('acct.sub', { sub: subreddit })}
      </p>

      {notice && (
        <p
          className={`mt-3 flex items-start gap-2 rounded-xl border px-3.5 py-2.5 text-[12.5px] leading-relaxed ${
            notice.kind === 'ok'
              ? 'border-[#1c4a33]/70 bg-[#0e2a1d]/60 text-[#5bdb90]'
              : 'border-[#3a2a1a]/70 bg-[#261a0e]/60 text-[#c5935b]'
          }`}
        >
          {notice.kind === 'ok'
            ? <Check size={14} strokeWidth={2.4} className="mt-0.5 shrink-0" />
            : <AlertTriangle size={14} strokeWidth={2} className="mt-0.5 shrink-0" />}
          {notice.text}
        </p>
      )}

      <div className="dash-inset mt-4 flex flex-wrap items-center gap-3 p-3.5">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-display text-[15px] font-bold text-white"
          style={{ background: 'linear-gradient(140deg,#ff4500,#ff7a3d)' }}
        >
          r/
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-semibold text-white">{t('pub.reddit')}</p>
          <p className="mt-0.5 truncate text-[12px] text-[#8b94b8]">
            {loading
              ? t('common.loading')
              : connected
                ? t('acct.connectedAs', { user: handle || '' })
                : t('acct.notConnected')}
          </p>
        </div>

        {loading ? (
          <Loader2 size={16} className="animate-spin text-[#5a6e9a]" />
        ) : connected ? (
          <button
            type="button"
            onClick={disconnect}
            disabled={busy}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#2a4375]/70 bg-[#0d1531]/70 px-4 text-[12.5px] font-medium text-[#a3b0d4] transition hover:border-red-500/50 hover:text-red-300 disabled:opacity-60"
          >
            <Unplug size={14} strokeWidth={2} />
            {t('acct.disconnect')}
          </button>
        ) : (
          <button
            type="button"
            onClick={connect}
            disabled={busy}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl px-4 text-[12.5px] font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
            style={{ background: 'linear-gradient(90deg,#ff4500,#ff6a33)' }}
          >
            {t('acct.connect')}
            <ExternalLink size={13} strokeWidth={2.2} />
          </button>
        )}
      </div>

      {connected && (
        <p className="mt-2.5 text-[11.5px] leading-relaxed text-[#5a6e9a]">
          {t('acct.disconnectNote')}
        </p>
      )}
    </div>
  );
}
