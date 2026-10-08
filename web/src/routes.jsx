// Screens and deep links (IMPLEMENTATION §3.3). Each screen is lazy-loaded.
// Detail routes (/tasks/:id …) arrive with their modules; URLs only ever
// carry 26-character public ids.
import { lazy, Suspense } from 'react';
import AppShell from './components/AppShell.jsx';

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
  {
    element: <AppShell />,
    children: [
      { path: '/', element: page(() => import('./screens/home/Home.jsx')) },
      { path: '/calendar', element: page(() => import('./screens/calendar/Calendar.jsx')) },
      { path: '/tasks', element: page(() => import('./screens/tasks/Tasks.jsx')) },
      { path: '/guests', element: page(() => import('./screens/guests/Guests.jsx')) },
      { path: '/more', element: page(() => import('./screens/more/More.jsx')) },
      { path: '/money', element: page(() => import('./screens/money/Money.jsx')) },
      { path: '/documents', element: page(() => import('./screens/documents/Documents.jsx')) },
      { path: '/settings', element: page(() => import('./screens/settings/Settings.jsx')) },
      { path: '/install', element: page(() => import('./screens/install/InstallGuide.jsx')) },
      { path: '*', element: page(() => import('./screens/NotFound.jsx')) },
    ],
  },
];
