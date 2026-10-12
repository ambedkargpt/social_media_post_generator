import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, BarChart3, Bell, Check, Edit3, Film, Headphones,
  Image as ImageIcon, Mic, Music, Newspaper, Tv, Vote,
} from 'lucide-react';

import { Button, Card, PageHeader, SectionHeader } from '../components/np';
import { useI18n } from '../i18n/index.jsx';

/**
 * Create.
 *
 * Phase 6 of docs/redesign/neela-press.md.
 *
 * Two things work. The page used to present thirteen, nine of them disabled,
 * behind a search box, five category tabs and a sort dropdown - a catalogue
 * for a shop with two items on the shelf. The two that exist are now the page,
 * and the rest is a list underneath of what is coming, each with a way to be
 * told when it does.
 */

// The two that are built. Everything else is in COMING.
const LIVE = [
  { id: 'social', icon: Edit3, route: '/generate/social-media', primary: true },
  { id: 'music', icon: Music, route: '/generate/music' },
];

const COMING = [
  { id: 'podcast', icon: Headphones },
  { id: 'speech', icon: Mic },
  { id: 'video', icon: Film },
  { id: 'shorts', icon: Tv },
  { id: 'editorial', icon: Newspaper },
  { id: 'debate-analysis', icon: BarChart3 },
  { id: 'election', icon: Vote },
  { id: 'image', icon: ImageIcon },
];

// There is no API behind "notify me" yet, so the choice lives in the browser.
// TODO(api): move to the backend once there is somewhere to send it.
const NOTIFY_KEY = 'ambedkargpt_notify_services';

function readNotify() {
  try {
    return new Set(JSON.parse(localStorage.getItem(NOTIFY_KEY)) || []);
  } catch {
    return new Set();
  }
}

export default function ServiceSelection() {
  const { t } = useI18n();
  const [notify, setNotify] = useState(readNotify);

  function toggleNotify(id) {
    setNotify((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      try { localStorage.setItem(NOTIFY_KEY, JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
  }

  return (
    <div className="np-page">
      <PageHeader title={t('np.services.title')} />

      <div className="np-create">
        {LIVE.map(({ id, icon: Icon, route, primary }) => (
          <Card
            key={id}
            as={Link}
            to={route}
            interactive
            className={`np-create-tile ${primary ? 'is-primary' : ''}`}
          >
            <span className="np-create-icon" aria-hidden="true">
              <Icon size={28} strokeWidth={1.9} />
            </span>
            <h2 className="np-display np-create-title">{t(`sel.${id}.title`)}</h2>
            <p className="np-create-sub">{t(`sel.${id}.desc`)}</p>
            <span className="np-create-go" aria-hidden="true">
              <ArrowRight size={20} strokeWidth={2.2} />
            </span>
          </Card>
        ))}
      </div>

      <section className="np-block">
        <SectionHeader>{t('np.services.onTheWay')}</SectionHeader>
        <ul className="np-soon">
          {COMING.map(({ id, icon: Icon }) => {
            const on = notify.has(id);
            return (
              <li key={id} className="np-soon-row">
                <span className="np-soon-icon" aria-hidden="true">
                  <Icon size={20} strokeWidth={1.9} />
                </span>
                <span className="np-soon-text">
                  <span className="np-soon-name">{t(`sel.${id}.title`)}</span>
                  <span className="np-soon-desc">{t(`sel.${id}.desc`)}</span>
                </span>
                <Button
                  size="sm"
                  variant={on ? 'ghost' : 'secondary'}
                  onClick={() => toggleNotify(id)}
                  iconLeft={on ? Check : Bell}
                  className={on ? 'np-soon-on' : ''}
                  aria-pressed={on}
                >
                  {t(on ? 'np.services.notified' : 'np.services.notify')}
                </Button>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
