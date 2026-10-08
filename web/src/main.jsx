import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { routes } from './routes.jsx';
import { makeQueryClient } from './queryClient.js';
import { reportProblem } from './api/client.js';
import './styles/app.css';

// Crashes outside React (promise rejections, script errors) go to /client-log too.
window.addEventListener('error', (e) => reportProblem({ code: 'window_error', message: e.message, stack: e.error?.stack }));
window.addEventListener('unhandledrejection', (e) => reportProblem({ code: 'unhandled_rejection', message: String(e.reason?.message || e.reason), stack: e.reason?.stack }));

const router = createBrowserRouter(routes);
const queryClient = makeQueryClient();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
);
