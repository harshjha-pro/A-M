// Layout (DESIGN §4.1): screen content scrolls; bottom nav fixed; padding so
// the nav (and later the + button) never covers the last row.
import { Outlet } from 'react-router-dom';
import BottomNav from './BottomNav.jsx';

export default function AppShell() {
  return (
    <div className="min-h-dvh bg-bg">
      <div className="pb-[calc(6rem+env(safe-area-inset-bottom))]">
        <Outlet />
      </div>
      <BottomNav />
    </div>
  );
}
