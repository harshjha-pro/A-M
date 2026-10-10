import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import LoginSheet from './components/LoginSheet.jsx';
import { routes } from './routes.jsx';
import { makeQueryClient } from './queryClient.js';
import { reportProblem } from './api/client.js';
import UpdatePrompt from './pwa/UpdatePrompt.jsx';
import { captureInstallPrompt } from './pwa/useAndroidInstall.js';
import { registerServiceWorker } from './pwa/swClient.js';
import './styles/app.css';

// Crashes outside React (promise rejections, script errors) go to /client-log too.
window.addEventListener('error', (e) => reportProblem({ code: 'window_error', message: e.message, stack: e.error?.stack }));
window.addEventListener('unhandledrejection', (e) => reportProblem({ code: 'unhandled_rejection', message: String(e.reason?.message || e.reason), stack: e.reason?.stack }));

// Chrome fires beforeinstallprompt early: keep it before React mounts (PWA §3.2).
captureInstallPrompt();
// The service worker only in real builds (testing it in vite dev would mislead, PWA §4.2).
if (import.meta.env.PROD) registerServiceWorker();

const router = createBrowserRouter(routes);
const queryClient = makeQueryClient();
// After the login sheet: load again whatever failed while logged out.
window.addEventListener('am:relogin', () => queryClient.invalidateQueries());

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
        <LoginSheet />
        <UpdatePrompt />
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
);
