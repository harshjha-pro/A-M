// Layout (DESIGN §4.1): screen content scrolls; bottom nav fixed; padding so
// the nav (and the + button) never covers the last row. Above the content, after
// login: our Android install banner and the "please update" note for old phones
// (PWA §0.1, §3.2). The iPhone Add to Home Screen guide opens by itself once, in
// Safari only (PWA §3.3). After login we also ask the phone to keep our data (§5.6),
// keep its offline copy fresh (§5.1), say so when a screen shows that copy, and send
// the changes waiting on the phone (§5.2) with a bar while there are any (§5.4).
import { useEffect, useState, useRef } from 'react';
import { Outlet, useLocation, useSearchParams } from 'react-router-dom';
import BottomNav from './BottomNav.jsx';
import UndoSnackbar from './UndoSnackbar.jsx';
import AndroidInstallBanner from '../pwa/AndroidInstallBanner.jsx';
import OldPhoneNotice from '../pwa/OldPhoneNotice.jsx';
import IosInstallGuide, { shouldAutoOpenIosGuide } from '../pwa/IosInstallGuide.jsx';
import { askToKeepData } from '../pwa/persist.js';
import OfflineBanner from '../offline/OfflineBanner.jsx';
import { startSyncLoop } from '../offline/startSync.js';
import OutboxBar from '../offline/OutboxBar.jsx';
import { startOutboxLoop } from '../offline/save.js';
import { useSession } from '../api/session.js';
import LoadingScreen from './LoadingScreen.jsx';

const isTest = typeof import.meta !== 'undefined' && import.meta.env?.MODE === 'test';

export default function AppShell() {
  const [iosGuide, setIosGuide] = useState(() => shouldAutoOpenIosGuide());
  const { user } = useSession();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const isStandaloneWelcome = location.pathname === '/welcome';
  // Show the royal loading screen on initial app open (splash screen)
  const [splashLoading, setSplashLoading] = useState(!isTest);

  useEffect(() => {
    askToKeepData();
  }, []);

  // Keep the phone's copy fresh for reading without internet (PWA §5.1).
  useEffect(() => (user?.id ? startSyncLoop(user.id) : undefined), [user?.id]);
  // Send what's waiting on the phone (PWA §5.2): now, back online, back in front, every 60 s.
  useEffect(() => (user?.id ? startOutboxLoop() : undefined), [user?.id]);

  // Initial splash screen timer: 2 seconds on app open
  useEffect(() => {
    if (isTest) return undefined;
    const timer = setTimeout(() => {
      setSplashLoading(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, [isTest]);

  // Scroll to top on page navigation without triggering buffering/loading screens
  useEffect(() => {
    if (isTest) return undefined;
    if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
      try {
        window.scrollTo(0, 0);
      } catch {
        /* jsdom stub */
      }
    }
  }, [location.pathname, isTest]);

  if (isStandaloneWelcome) {
    return (
      <div className="min-h-dvh bg-[#FBF5ED]">
        {splashLoading && (
          <LoadingScreen
            fullScreen
            fadeOut
            duration={2000}
            message="Preparing Your Wedding Journey…"
          />
        )}
        <Outlet />
        {iosGuide && <IosInstallGuide onClose={() => setIosGuide(false)} />}
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-bg">
      {splashLoading && (
        <LoadingScreen
          fullScreen
          fadeOut
          duration={2000}
          message="Preparing Your Wedding Journey…"
        />
      )}
      <OfflineBanner />
      <OutboxBar />
      <OldPhoneNotice />
      <div className="pb-[calc(6rem+env(safe-area-inset-bottom)+var(--am-update-h,0px)+var(--am-install-h,0px))]">
        <Outlet />
      </div>
      <UndoSnackbar />
      <AndroidInstallBanner />
      <BottomNav />
      {iosGuide && <IosInstallGuide onClose={() => setIosGuide(false)} />}
    </div>
  );
}
