// Every route loads its screen (catches broken imports before the build does).
import { test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { routes } from './routes.jsx';

const HEADINGS = {
  '/': 'Home', '/calendar': 'Calendar', '/tasks': 'Tasks', '/guests': 'Guests', '/more': 'More',
  '/money': 'Money', '/documents': 'Documents', '/settings': 'Settings', '/install': 'Install Guide',
  '/login': 'Log in', '/no-such-page': 'Not found',
};

test.each(Object.entries(HEADINGS))('%s shows "%s"', async (path, heading) => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"status":"ok"}', { status: 200 })));
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<QueryClientProvider client={new QueryClient()}><RouterProvider router={router} /></QueryClientProvider>);
  expect(await screen.findByRole('heading', { level: 1, name: heading })).toBeInTheDocument();
});

test('Home shows the version and a live server check', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"status":"ok"}', { status: 200 })));
  const router = createMemoryRouter(routes, { initialEntries: ['/'] });
  render(<QueryClientProvider client={new QueryClient()}><RouterProvider router={router} /></QueryClientProvider>);
  expect(await screen.findByText('A&M Wedding — version 1.0.1')).toBeInTheDocument();
  expect(await screen.findByText('Connected')).toBeInTheDocument();
});

test('Home says so when the server is down', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"status":"fail"}', { status: 503 })));
  const router = createMemoryRouter(routes, { initialEntries: ['/'] });
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><RouterProvider router={router} /></QueryClientProvider>);
  expect(await screen.findByText('Not reachable. Check your internet.', {}, { timeout: 4000 })).toBeInTheDocument();
});
