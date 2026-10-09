// Layout (DESIGN §4.1): screen content scrolls; bottom nav fixed; padding so
// the nav (and the + button) never covers the last row. Above the content, after
// login: our Android install banner and the "please update" note for old phones
// (PWA §0.1, §3.2). The iPhone Add to Home Screen guide opens by itself once, in
// Safari only (PWA §3.3). After login we also ask the phone to keep our data (§5.6).
import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import BottomNav from './BottomNav.jsx';
import UndoSnackbar from './UndoSnackbar.jsx';
import AndroidInstallBanner from '../pwa/AndroidInstallBanner.jsx';
import OldPhoneNotice from '../pwa/OldPhoneNotice.jsx';
import IosInstallGuide, { shouldAutoOpenIosGuide } from '../pwa/IosInstallGuide.jsx';
import { askToKeepData } from '../pwa/persist.js';

export default function AppShell() {
  const [iosGuide, setIosGuide] = useState(() => shouldAutoOpenIosGuide());
  useEffect(() => { askToKeepData(); }, []);
  return (
    <div className="min-h-dvh bg-bg">
      <AndroidInstallBanner />
      <OldPhoneNotice />
      <div className="pb-[calc(6rem+env(safe-area-inset-bottom)+var(--am-update-h,0px))]">
        <Outlet />
      </div>
      <UndoSnackbar />
      <BottomNav />
      {iosGuide && <IosInstallGuide onClose={() => setIosGuide(false)} />}
    </div>
  );
}
