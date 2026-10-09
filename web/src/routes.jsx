// Screens and deep links (IMPLEMENTATION §3.3). Each screen is lazy-loaded.
// Log in, set password and first setup are open; everything else needs a login.
// URLs only ever carry 26-character public ids.
import { lazy, Suspense } from 'react';
import AppShell from './components/AppShell.jsx';
import RequireAuth from './components/RequireAuth.jsx';

const page = (load) => {
  const C = lazy(load);
  return (
    <Suspense fallback={<div className="p-6 text-text-muted" aria-busy="true">…</div>}>
      <C />
    </Suspense>
  );
};

export const routes = [
  { path: '/login', element: page(() => import('./screens/auth/Login.jsx')) },
  { path: '/set-password', element: page(() => import('./screens/auth/SetPassword.jsx')) },
  { path: '/setup', element: page(() => import('./screens/auth/FirstOwner.jsx')) },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: '/', element: page(() => import('./screens/home/Home.jsx')) },
          { path: '/calendar', element: page(() => import('./screens/calendar/Calendar.jsx')) },
          { path: '/tasks', element: page(() => import('./screens/tasks/TaskList.jsx')) },
          { path: '/tasks/new', element: page(() => import('./screens/tasks/TaskForm.jsx')) },
          { path: '/tasks/:id', element: page(() => import('./screens/tasks/TaskDetail.jsx')) },
          { path: '/tasks/:id/edit', element: page(() => import('./screens/tasks/TaskForm.jsx')) },
          { path: '/guests', element: page(() => import('./screens/guests/Guests.jsx')) },
          { path: '/more', element: page(() => import('./screens/more/More.jsx')) },
          { path: '/money', element: page(() => import('./screens/money/Money.jsx')) },
          { path: '/documents', element: page(() => import('./screens/documents/Documents.jsx')) },
          { path: '/settings', element: page(() => import('./screens/settings/Settings.jsx')) },
          { path: '/settings/wedding', element: page(() => import('./screens/settings/WeddingDetails.jsx')) },
          { path: '/settings/members', element: page(() => import('./screens/settings/Members.jsx')) },
          { path: '/settings/members/new', element: page(() => import('./screens/settings/MemberForm.jsx')) },
          { path: '/settings/members/:id', element: page(() => import('./screens/settings/MemberForm.jsx')) },
          { path: '/settings/wedding/history', element: page(() => import('./screens/safety/HistoryScreen.jsx')) },
          { path: '/settings/safety', element: page(() => import('./screens/safety/Safety.jsx')) },
          { path: '/settings/activity', element: page(() => import('./screens/safety/Activity.jsx')) },
          { path: '/settings/deleted', element: page(() => import('./screens/safety/DeletedItems.jsx')) },
          { path: '/history/:resource/:id', element: page(() => import('./screens/safety/HistoryScreen.jsx')) },
          { path: '/settings/account', element: page(() => import('./screens/settings/MyAccount.jsx')) },
          { path: '/install', element: page(() => import('./screens/install/InstallGuide.jsx')) },
          { path: '*', element: page(() => import('./screens/NotFound.jsx')) },
        ],
      },
    ],
  },
];
