import { useCallback, useEffect, useMemo, useState } from 'react';

import { getNews, getTenants } from '../api/news';
import { adaptNews, resolveTenantForUser } from '../utils/newsTenants';
import { getSiteLanguage } from '../utils/siteLanguage';

/**
 * The day's stories, once, for the whole dashboard.
 *
 * Phase 5 of docs/redesign/neela-press.md. The top story and the wire are two
 * views of the same feed, and the carousel used to fetch it for itself - so
 * putting a list beside it would have meant asking the API for the same
 * hundred rows twice on every visit.
 *
 * `status` is derived rather than set: the result carries the request it
 * answers, and anything whose answer has not arrived yet is loading. Setting
 * it at the top of the effect instead would be a second render between the
 * request going out and the screen admitting it, which React now warns about
 * and which was never worth the extra pass.
 */
export default function useDashboardNews(party, lang) {
  const [nonce, setNonce] = useState(0);
  const [result, setResult] = useState(null);

  // Everything that decides which stories come back. A change to any of them
  // is a different question, so the old answer stops counting immediately.
  const key = `${party || ''}|${lang}|${nonce}`;

  const retry = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // A tenant lookup that fails is not a failed feed: without it the query
      // falls back to general news, which is still something to read.
      const tenants = await getTenants().catch(() => []);
      const resolved = resolveTenantForUser(party, tenants ?? []);
      const scope = resolved
        ? { tenant: resolved.slug, includeGeneral: true, includeOpposition: true }
        : {};
      try {
        // Asked for in the reader's language first. A feed with nothing in
        // that language is still a feed in the other one, which beats an
        // empty page.
        let rows = await getNews({ limit: 100, language: getSiteLanguage() ?? 'hi', ...scope });
        if (!rows?.length) rows = await getNews({ limit: 100, ...scope });
        if (cancelled) return;
        setResult({
          key,
          partySlug: resolved?.slug ?? '',
          articles: (rows ?? []).map(adaptNews),
          error: false,
        });
      } catch {
        if (cancelled) return;
        setResult({ key, partySlug: '', articles: [], error: true });
      }
    })();
    return () => { cancelled = true; };
  }, [key, party]);

  const fresh = result?.key === key ? result : null;

  // Newest first, and tagged by whose news each one is. 'bjp' stands in for
  // the opposition because it is the only opposition tenant the feed carries.
  const stories = useMemo(() => {
    if (!fresh) return [];
    const { articles, partySlug } = fresh;
    const kindOf = (a) => {
      if (partySlug && a.tenantSlug === partySlug) return 'party';
      if (a.tenantSlug === 'bjp') return 'opposition';
      return 'general';
    };
    return articles
      .map((a) => ({ ...a, kind: kindOf(a) }))
      .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  }, [fresh]);

  const status = !fresh ? 'loading' : fresh.error ? 'error' : 'ready';

  return { stories, partySlug: fresh?.partySlug ?? '', status, retry };
}
