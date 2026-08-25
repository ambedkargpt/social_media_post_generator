import { Sparkles, Loader2 } from 'lucide-react';

/**
 * The primary action button for the auth screens.
 *
 * `disabled` used to be accepted by callers and dropped here, so the button
 * stayed clickable through a submit and a second click sent the request twice.
 * `loading` shows a spinner in place of the sparkle, because a request that
 * takes a couple of seconds with no moving pixels reads as a broken button
 * rather than a working one.
 */
export default function PrimaryButton({
  children,
  onClick,
  type = 'button',
  disabled = false,
  loading = false,
}) {
  const isDisabled = disabled || loading;
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className="btn-gradient w-full py-3.5 rounded-xl font-semibold text-white flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed disabled:opacity-70"
    >
      {children}
      {loading ? (
        <Loader2 size={17} strokeWidth={2} className="animate-spin" />
      ) : (
        <Sparkles size={17} strokeWidth={2} />
      )}
    </button>
  );
}
