import Card, { CardTitle } from './Card';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../../i18n/index.jsx';

// Map backend question IDs → friendly display labels
const DISPLAY_MAP = {
  profile_user_role:               'Role',
  profile_tone:                    'Tone',
  profile_target_audience:         'Target Audience',
  profile_language:                'Language',
  profile_target_platform:         'Platform',
  profile_ambedkarite_perspective: 'Ideological Lens',
  profile_content_length:          'Content Length',
  profile_formality_level:         'Writing Style',
};

const DISPLAY_ORDER = Object.keys(DISPLAY_MAP);

const TINTS = [
  'bg-[#12224d]/80 text-[#6aa8ff] border-[#2a4a8a]/60',
  'bg-[#0f2a3d]/80 text-[#6ad6ff] border-[#1d4a66]/60',
  'bg-[#231738]/80 text-[#b18aff] border-[#4a3375]/60',
  'bg-[#0e2e2d]/80 text-[#5bdbc4] border-[#1c4a48]/60',
  'bg-[#2e2614]/80 text-[#ffc94a] border-[#5a4a1a]/60',
  'bg-[#3a1a2a]/80 text-[#ff80b5] border-[#6a2a46]/60',
];

export default function PreferencesCard({ answers = [] }) {
  const { t } = useI18n();
  const navigate = useNavigate();

  // Build a lookup map from answers array
  const answerMap = {};
  for (const a of answers) answerMap[a.question_id] = a.answer;

  // Rows: only keys we have answers for, in display order
  const rows = DISPLAY_ORDER
    .filter((k) => answerMap[k])
    .map((k) => [DISPLAY_MAP[k], answerMap[k]]);

  // Tags: all answered values
  const tags = answers.map((a) => a.answer).filter(Boolean).slice(0, 10);

  if (!answers.length) {
    return (
      <Card className="h-full flex flex-col justify-between">
        <CardTitle>{t('prefcard.title')}</CardTitle>
        <div className="flex flex-1 flex-col items-center justify-center py-10 text-center">
          <p className="text-[13px] text-[#6b78a0]">{t('prefcard.none')}</p>
          <button
            type="button"
            onClick={() => navigate('/preferences')}
            className="mt-4 rounded-xl btn-gradient px-6 py-2.5 text-[13px] font-semibold text-white"
          >
            {t('prefcard.setUp')}
          </button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardTitle>Your Preferences</CardTitle>

      <dl className="mt-5 space-y-4">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between gap-4">
            <dt className="text-[13px] text-[#8b94b8]">{k}</dt>
            <dd className="text-right text-[13px] font-medium text-white">{v}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-6 h-px w-full bg-gradient-to-r from-transparent via-[#2a3566]/60 to-transparent" />

      <div className="mt-5">
        <div className="text-[13px] text-[#8b94b8]">{t('prefcard.allValues')}</div>
        <div className="mt-3 flex flex-wrap gap-2">
          {tags.map((tag, i) => (
            <span
              key={tag + i}
              className={`rounded-lg border px-2.5 py-1 text-[11.5px] font-medium ${TINTS[i % TINTS.length]}`}
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </Card>
  );
}
