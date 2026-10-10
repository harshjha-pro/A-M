// Settings › This phone (PWA.md §5.6, §6.4, §10): what this phone is, the app version,
// installed or not, offline files on/off, whether the phone keeps our data, space used,
// "Please update" for old phones, and Fix the app. Also what Ayush reads out when
// helping family by phone.
import { useEffect, useState, useSyncExternalStore } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Wrench } from 'lucide-react';
import Screen from '../../components/Screen.jsx';
import Button from '../../components/Button.jsx';
import OldPhoneNotice from '../../pwa/OldPhoneNotice.jsx';
import { deviceLabel, isIOS, isStandalone } from '../../pwa/platform.js';
import { getSwState, subscribeSw } from '../../pwa/swClient.js';
import { storageInfo, askToKeepData } from '../../pwa/persist.js';
import { formatBytes } from '../../data/documents.js';
import { cacheSummary } from '../../offline/cache.js';
import { fromLabel } from '../../offline/OfflineBanner.jsx';
import { useOutbox, refreshOutbox } from '../../offline/outbox.js';
import { t } from '../../i18n/strings.en.js';

const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0';
const BUILT_AT = typeof __BUILT_AT__ !== 'undefined' ? __BUILT_AT__ : '';

export default function ThisPhone() {
  const sw = useSyncExternalStore(subscribeSw, getSwState, getSwState);
  const [store, setStore] = useState(null);
  const [copy, setCopy] = useState(null);
  const outbox = useOutbox();
  useEffect(() => { storageInfo().then(setStore); cacheSummary().then(setCopy); refreshOutbox(); }, []);

  const offline = !('serviceWorker' in navigator) ? t('phone.offlineNo') : sw.failed ? t('phone.offlineFailed') : sw.registered ? t('phone.offlineOn') : t('phone.offlineOff');
  const rows = [
    [t('phone.device'), deviceLabel()],
    [t('phone.version'), BUILT_AT ? t('phone.versionLine', { version: APP_VERSION, date: BUILT_AT.slice(0, 10) }) : APP_VERSION],
    [t('phone.installed'), isStandalone() ? t('yes') : t('no')],
    [t('phone.offline'), offline],
    [t('phone.kept'), store === null ? '…' : store.persisted ? t('phone.keptYes') : t('phone.keptNo')],
    [t('phone.space'), store?.usage != null ? formatBytes(store.usage) : '—'],
    [t('offline.data'), copy ? t('offline.dataLine', { families: copy.households, tasks: copy.tasks, events: copy.events, vendors: copy.vendors, documents: copy.documents }) : '…'],
    [t('offline.lastSync'), copy?.lastSyncedAt ? fromLabel(copy.lastSyncedAt) : t('offline.never')],
    [t('outbox.phoneWaiting'), outbox.mine.length ? <Link to="/settings/waiting" className="text-primary underline">{outbox.mine.length}</Link> : t('outbox.phoneNone')],
  ];
  return (
    <Screen title={t('phone.title')} back="/settings">
      <OldPhoneNotice dismissible={false} />
      {outbox.others.map((o) => <p key={o.name} className="rounded-md bg-info-soft p-3">{t('outbox.othersLine', { n: o.count, name: o.name })}</p>)}
      <dl className="overflow-hidden rounded-md bg-surface shadow-card">
        {rows.map(([k, v]) => (
          <div key={k} className="flex min-h-14 items-center justify-between gap-4 border-b border-border px-4 py-2 last:border-b-0">
            <dt className="text-text-muted">{k}</dt>
            <dd className="text-right font-bold">{v}</dd>
          </div>
        ))}
      </dl>
      {store && store.supported && !store.persisted && (
        <Button variant="secondary" onClick={async () => { await askToKeepData(); setStore(await storageInfo()); }}>
          <ShieldCheck aria-hidden="true" size={20} />{t('phone.keep')}
        </Button>
      )}
      {isIOS && <p className="rounded-md bg-info-soft p-3">{t('phone.iconWarning')}</p>}
      {!isStandalone() && <Link to="/install" className="tap inline-flex items-center justify-center font-bold text-primary">{t('settings.install')}</Link>}
      <section className="flex flex-col gap-2">
        <p className="text-text-muted">{t('install.stuckText')}</p>
        <a href="/reset.html" className="tap inline-flex items-center justify-center gap-2 rounded-md border-[1.5px] border-border-strong bg-surface px-5 text-text">
          <Wrench aria-hidden="true" size={20} />{t('phone.fix')}
        </a>
      </section>
    </Screen>
  );
}
