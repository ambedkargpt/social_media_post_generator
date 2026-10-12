import { useState } from 'react';
import { ArrowRight, Plus, Trash2 } from 'lucide-react';

import {
  Button, Card, Chakra, Chip, ChipRow, EmptyState, Field, Input, Paper,
  PartyLogo, PartySymbol, SectionHeader, Segmented, Select, Skeleton, Stamp,
  Tabs, Tag, Textarea,
} from '../components/np';

/**
 * Every Neela Press primitive on one page, in both scripts.
 *
 * Development only - it is wired behind import.meta.env.DEV in App.jsx and
 * is not in the production bundle. It exists because the primitives are
 * built before the screens that use them, and a primitive nobody has looked
 * at in Hindi is a primitive that breaks in Hindi.
 *
 * The language toggle sets the real `lang` attribute on <html>, which is what
 * every Hindi rule in index.css keys off, so what is on screen here is what
 * the app will do.
 */

const PARTY = 'Indian National Congress (INC)';

const CHIP_HI = {
  all: 'सभी',
  party: 'पार्टी',
  opposition: 'विपक्ष',
  general: 'सामान्य',
  drafts: 'ड्राफ़्ट',
  published: 'प्रकाशित',
};

function Row({ title, children }) {
  return (
    <section style={{ display: 'grid', gap: 14 }}>
      <h3 style={{
        margin: 0, fontSize: 14, fontWeight: 600,
        color: 'var(--color-np-faint)', letterSpacing: '0.04em',
      }}>
        {title}
      </h3>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center' }}>
        {children}
      </div>
    </section>
  );
}

export default function NpKit() {
  const [lang, setLang] = useState(() => document.documentElement.lang || 'en');
  const [seg, setSeg] = useState('today');
  const [tab, setTab] = useState('profile');
  const [chip, setChip] = useState('all');
  const [loading, setLoading] = useState(false);

  const hi = lang === 'hi';
  const setLanguage = (next) => {
    document.documentElement.lang = next;
    setLang(next);
  };

  const t = (en, h) => (hi ? h : en);

  return (
    <div className="np np-bg" style={{ minHeight: '100svh' }}>
      <div style={{
        position: 'relative', zIndex: 1,
        maxWidth: 1080, margin: '0 auto', padding: '40px 24px 96px',
        display: 'grid', gap: 40,
      }}>

        <header style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 20, flexWrap: 'wrap',
        }}>
          <div>
            <h1 className="np-display" style={{ margin: 0, fontSize: 40 }}>
              {t('Neela Press kit', 'नीला प्रेस किट')}
            </h1>
            <p style={{ margin: '6px 0 0', color: 'var(--color-np-muted)' }}>
              {t('Every primitive, both scripts. Development only.',
                'हर प्रिमिटिव, दोनों लिपियों में। सिर्फ़ डेवलपमेंट के लिए।')}
            </p>
          </div>
          <Segmented
            ariaLabel="Language"
            value={lang}
            onChange={setLanguage}
            options={[{ value: 'en', label: 'English' }, { value: 'hi', label: 'हिन्दी' }]}
          />
        </header>

        <SectionHeader
          right={<Button variant="ghost" size="sm" iconRight={ArrowRight}>{t('All', 'सभी')}</Button>}
        >
          {t('Buttons', 'बटन')}
        </SectionHeader>

        <Row title="primary / secondary / ghost / danger">
          <Button variant="primary" size="lg" iconRight={ArrowRight}>
            {t('Create a post', 'पोस्ट बनाएँ')}
          </Button>
          <Button variant="secondary" iconLeft={Plus}>{t('Add source', 'स्रोत जोड़ें')}</Button>
          <Button variant="ghost">{t('Cancel', 'रद्द करें')}</Button>
          <Button variant="danger" iconLeft={Trash2}>{t('Archive', 'संग्रह करें')}</Button>
        </Row>

        <Row title="sizes, loading, disabled">
          <Button size="sm">{t('Small', 'छोटा')}</Button>
          <Button size="md">{t('Medium', 'मध्यम')}</Button>
          <Button size="lg">{t('Large', 'बड़ा')}</Button>
          <Button
            loading={loading}
            onClick={() => { setLoading(true); setTimeout(() => setLoading(false), 2200); }}
          >
            {t('Press me', 'दबाइए')}
          </Button>
          <Button disabled>{t('Disabled', 'निष्क्रिय')}</Button>
        </Row>

        <SectionHeader>{t('Chakra', 'चक्र')}</SectionHeader>
        <Row title="spin / progress / static">
          <Chakra size={28} mode="spin" />
          <Chakra size={28} mode="spin" decorative />
          <Chakra size={40} mode="progress" value={0.35} className="np-kit-neela" />
          <Chakra size={40} mode="progress" value={0.8} className="np-kit-brass" />
          <Chakra size={40} mode="static" />
        </Row>

        <SectionHeader>{t('Form', 'फ़ॉर्म')}</SectionHeader>
        <div style={{ display: 'grid', gap: 18, maxWidth: 460 }}>
          <Field
            label={t('Full name', 'पूरा नाम')}
            hint={t('As it should appear on posts', 'जैसा पोस्ट पर दिखना चाहिए')}
          >
            <Input placeholder={t('Your name', 'आपका नाम')} />
          </Field>
          <Field label={t('Phone', 'फ़ोन')}>
            <Input prefix="+91" placeholder="98765 43210" inputMode="numeric" />
          </Field>
          <Field label={t('Party', 'पार्टी')}>
            <Select defaultValue="">
              <option value="" disabled>{t('Choose a party', 'पार्टी चुनें')}</option>
              <option>{t('Indian National Congress', 'इंडियन नेशनल कांग्रेस')}</option>
              <option>{t('Samajwadi Party', 'समाजवादी पार्टी')}</option>
            </Select>
          </Field>
          <Field
            label={t('Note', 'टिप्पणी')}
            error={t('This cannot be empty', 'यह ख़ाली नहीं रह सकता')}
            counter="0 / 280"
          >
            <Textarea error placeholder={t('Say something', 'कुछ लिखिए')} />
          </Field>
        </div>

        <SectionHeader>{t('Selection', 'चयन')}</SectionHeader>
        <Row title="segmented / tabs">
          <Segmented
            ariaLabel="Range"
            value={seg}
            onChange={setSeg}
            options={[
              { value: 'today', label: t('Today', 'आज') },
              { value: 'week', label: t('This week', 'इस हफ़्ते') },
              { value: 'all', label: t('Everything', 'सब कुछ') },
            ]}
          />
          <Tabs
            ariaLabel="Settings"
            value={tab}
            onChange={setTab}
            options={[
              { value: 'profile', label: t('Profile', 'प्रोफ़ाइल') },
              { value: 'party', label: t('Party', 'पार्टी') },
              { value: 'account', label: t('Account', 'खाता') },
            ]}
          />
        </Row>
        <Row title="chips (scroll on a phone)">
          <ChipRow style={{ maxWidth: 420 }}>
            {['all', 'party', 'opposition', 'general', 'drafts', 'published'].map((c) => (
              <Chip key={c} selected={chip === c} onClick={() => setChip(c)}>
                {t(c, CHIP_HI[c])}
              </Chip>
            ))}
          </ChipRow>
        </Row>

        <SectionHeader>{t('Surfaces', 'सतहें')}</SectionHeader>
        <div style={{
          display: 'grid', gap: 18,
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        }}>
          <Card>
            <h4 className="np-display" style={{ margin: '0 0 8px', fontSize: 22 }}>
              {t('Card', 'कार्ड')}
            </h4>
            <p style={{ margin: 0, color: 'var(--color-np-muted)', fontSize: 15 }}>
              {t('Tone and a hairline. No shadow.', 'रंग और एक पतली रेखा। कोई छाया नहीं।')}
            </p>
          </Card>
          <Card interactive>
            <h4 className="np-display" style={{ margin: '0 0 8px', fontSize: 22 }}>
              {t('Interactive', 'क्लिक करने योग्य')}
            </h4>
            <p style={{ margin: 0, color: 'var(--color-np-muted)', fontSize: 15 }}>
              {t('Lifts one pixel on hover.', 'होवर पर एक पिक्सल ऊपर उठता है।')}
            </p>
          </Card>
          <Paper tilt={-1}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 10,
            }}>
              <Tag tone="party" symbol="/party-symbols/congress.png">
                {t('Congress', 'कांग्रेस')}
              </Tag>
              <Stamp variant="draft" animate>{t('Draft', 'ड्राफ़्ट')}</Stamp>
            </div>
            <p style={{ margin: 0, fontSize: 17, lineHeight: 1.6 }}>
              {t('Paper is where anything written or read at length goes.',
                'जो कुछ लिखा या लंबा पढ़ा जाता है, वह काग़ज़ पर जाता है।')}
            </p>
          </Paper>
        </div>

        <SectionHeader>{t('Marks and state', 'चिह्न और स्थिति')}</SectionHeader>
        <Row title="party marks">
          <PartyLogo
            party={PARTY}
            size={40}
            alt={t('Indian National Congress', 'इंडियन नेशनल कांग्रेस')}
          />
          <PartySymbol party={PARTY} size={24} />
          <PartySymbol party="Samajwadi Party (SP)" size={24} />
          <Tag tone="opposition">{t('Opposition', 'विपक्ष')}</Tag>
          <Tag tone="top">{t('Top story', 'मुख्य ख़बर')}</Tag>
        </Row>
        <Row title="stamps">
          <Stamp variant="draft">{t('Draft', 'ड्राफ़्ट')}</Stamp>
          <Stamp variant="published">{t('Published', 'प्रकाशित')}</Stamp>
          <Stamp variant="saved">{t('Saved', 'सहेजा गया')}</Stamp>
        </Row>
        <Row title="skeleton">
          <div style={{ display: 'grid', gap: 8, width: 280 }}>
            <Skeleton height={22} width="70%" />
            <Skeleton height={14} />
            <Skeleton height={14} width="85%" />
          </div>
        </Row>

        <SectionHeader>{t('Empty', 'ख़ाली')}</SectionHeader>
        <Card style={{ padding: 0 }}>
          <EmptyState
            title={t('Nothing here yet', 'अभी यहाँ कुछ नहीं है')}
            action={(
              <Button iconRight={ArrowRight}>
                {t('Write the first one', 'पहली पोस्ट लिखें')}
              </Button>
            )}
          >
            {t('Posts you write will show up here, newest first.',
              'आपकी लिखी पोस्ट यहाँ दिखेंगी, सबसे नई पहले।')}
          </EmptyState>
        </Card>
      </div>
    </div>
  );
}
