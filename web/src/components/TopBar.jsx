// Top bar (DESIGN §4.4): 56 px + safe area. Non-root screens show "← Back",
// because the iPhone Home Screen app has no browser Back button.
import { ArrowLeft } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { t } from '../i18n/strings.en.js';

// back: true (go back, or Home if this was the first screen) or a path to fall back to.
export default function TopBar({ title, back = false, actions = null }) {
  const navigate = useNavigate();
  const location = useLocation();
  // "default" = the first screen opened in this app (e.g. a link from WhatsApp):
  // going back would leave the app, so go to the parent screen instead.
  const goBack = () => (location.key !== 'default' ? navigate(-1) : navigate(typeof back === 'string' ? back : '/'));
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-bg pt-safe">
      <div className="flex min-h-14 items-center gap-1 px-safe">
        {back && (
          <button
            type="button"
            onClick={goBack}
            className="tap -ml-3 inline-flex items-center gap-1 rounded-md px-3 text-primary"
          >
            <ArrowLeft aria-hidden="true" size={24} strokeWidth={2} />
            <span>{t('back')}</span>
          </button>
        )}
        <h1 className="min-w-0 flex-1 truncate text-xl font-bold">{title}</h1>
        {actions}
      </div>
    </header>
  );
}
