// Button (DESIGN §7): primary, secondary, text, danger. ≥ 48 px, verb labels.
// needsInternet: an action that can't wait on the phone (delete, Undo, money, uploads…,
// PWA §5.2). With no internet it stays visible, greyed out, with "Needs internet" under it.
import { useOnline } from '../offline/useOnline.js';
import { t } from '../i18n/strings.en.js';

const VARIANTS = {
  primary: 'bg-primary text-on-primary font-bold',
  secondary: 'bg-surface text-text border-[1.5px] border-border-strong',
  text: 'bg-transparent text-primary underline-offset-4 focus-visible:underline',
  danger: 'bg-surface text-danger border-[1.5px] border-danger',
};

export default function Button({ needsInternet = false, ...props }) {
  return needsInternet ? <OnlineButton {...props} /> : <PlainButton {...props} />;
}

function OnlineButton(props) {
  const online = useOnline();
  if (online) return <PlainButton {...props} />;
  return (
    <span className="flex flex-col items-stretch gap-1">
      <PlainButton {...props} disabled />
      <span className="text-center text-sm text-text-muted">{t('offline.needsInternetShort')}</span>
    </span>
  );
}

function PlainButton({ variant = 'primary', loading = false, loadingLabel = 'Saving…', disabled, className = '', children, type = 'button', ...rest }) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`tap inline-flex items-center justify-center gap-2 rounded-md px-5 text-base transition-transform active:scale-[.98] disabled:opacity-40 ${VARIANTS[variant] ?? VARIANTS.primary} ${className}`}
      {...rest}
    >
      {loading ? loadingLabel : children}
    </button>
  );
}
