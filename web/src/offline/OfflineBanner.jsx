// "No internet · from Tue 13 Oct, 9:40 PM" (PWA.md §5.1 "Shown age", §5.4). Shown whenever
// a screen is showing the phone's copy, or the phone has no internet at all. Never a
// saved value without its age.
import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';
import { useOfflineState } from './state.js';
import { formatDate, formatTime } from '../format/ist.js';
import { t } from '../i18n/strings.en.js';

export function fromLabel(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${formatDate(iso).replace(',', '')}, ${formatTime(iso)}`; // "Tue 13 Oct 2026, 9:40 PM"
}

export default function OfflineBanner() {
  const { offline, from } = useOfflineState();
  const [noNet, setNoNet] = useState(typeof navigator !== 'undefined' && navigator.onLine === false);
  useEffect(() => {
    const on = () => setNoNet(false);
    const off = () => setNoNet(true);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  if (!offline && !noNet) return null;
  return (
    <p role="status" className="sticky top-0 z-30 flex items-center gap-2 bg-warning-soft px-4 py-2 font-bold">
      <WifiOff aria-hidden="true" size={18} className="shrink-0" />
      {from ? t('offline.banner', { when: fromLabel(from) }) : t('offline.bannerNoData')}
    </p>
  );
}
