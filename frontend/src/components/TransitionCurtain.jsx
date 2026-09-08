import logoSrc from '../assets/images/logo-animation.png';
import { useCurtain } from '../context/CurtainContext';
import { useI18n } from '../i18n/index.jsx';

export default function TransitionCurtain() {
  const { t } = useI18n();
  const { active } = useCurtain();

  if (!active) return null;

  return (
    <div
      className="curtain-enter fixed inset-0 z-[150] flex flex-col items-center justify-center"
      style={{ background: 'radial-gradient(ellipse at 50% 40%, #0e1d4a 0%, #080e22 50%, #04080f 100%)' }}
    >
      {/* curtain fades out */}
      <div className="curtain-reveal absolute inset-0 bg-[#04080f]" />

      {/* logo + wordmark sit above the curtain */}
      <div className="relative z-10 flex flex-col items-center gap-4">
        <img
          src={logoSrc}
          alt=""
          className="h-14 w-14 object-contain drop-shadow-[0_0_24px_rgba(63,159,255,0.65)]"
          style={{ animation: 'splashLogoSpin 1.8s linear infinite' }}
        />
        <span
          className="font-serif text-[32px] font-bold uppercase tracking-[0.08em]"
          style={{
            background: 'linear-gradient(180deg,#c8deff 0%,#6aaaff 35%,#2a6fd4 70%,#0d3a8a 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            filter: 'drop-shadow(0 0 18px rgba(50,120,255,0.4))',
          }}
        >
          {t('brand.wordmark')}
        </span>
      </div>
    </div>
  );
}
