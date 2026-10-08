// App shell: bottom nav labels, active state not by colour alone, Back button, axe.
import { describe, test, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { axe } from 'vitest-axe';
import AppShell from './AppShell.jsx';
import Screen from './Screen.jsx';
import More from '../screens/more/More.jsx';
import Tasks from '../screens/tasks/Tasks.jsx';
import Guests from '../screens/guests/Guests.jsx';
import Calendar from '../screens/calendar/Calendar.jsx';
import Money from '../screens/money/Money.jsx';
import ErrorBoundary from './ErrorBoundary.jsx';

function renderAt(path) {
  const router = createMemoryRouter([
    {
      element: <AppShell />,
      children: [
        { path: '/', element: <Screen title="Home"><p>home</p></Screen> },
        { path: '/calendar', element: <Calendar /> },
        { path: '/tasks', element: <Tasks /> },
        { path: '/guests', element: <Guests /> },
        { path: '/more', element: <More /> },
        { path: '/money', element: <Money /> },
      ],
    },
  ], { initialEntries: [path] });
  const qc = new QueryClient();
  const utils = render(<QueryClientProvider client={qc}><RouterProvider router={router} /></QueryClientProvider>);
  return { ...utils, router };
}

describe('bottom nav', () => {
  test('five items with visible words beside icons', () => {
    renderAt('/');
    const nav = screen.getByRole('navigation', { name: 'Main' });
    const links = within(nav).getAllByRole('link');
    expect(links.map((l) => l.textContent)).toEqual(['Home', 'Calendar', 'Tasks', 'Guests', 'More']);
  });

  test('active item has aria-current and bold label (not colour alone)', () => {
    renderAt('/tasks');
    const nav = screen.getByRole('navigation', { name: 'Main' });
    const active = within(nav).getByRole('link', { name: 'Tasks' });
    expect(active).toHaveAttribute('aria-current', 'page');
    expect(within(active).getByText('Tasks')).toHaveClass('font-bold');
    expect(within(nav).getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current');
  });

  test('tap targets are at least 48 px (tap class)', () => {
    renderAt('/');
    for (const link of within(screen.getByRole('navigation')).getAllByRole('link')) {
      expect(link).toHaveClass('tap');
    }
  });

  test('navigates between screens', async () => {
    const user = userEvent.setup();
    renderAt('/');
    await user.click(screen.getByRole('link', { name: 'Guests' }));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Guests');
    expect(screen.getByText('No families yet. Add one, or import your list.')).toBeInTheDocument();
  });
});

describe('screens', () => {
  test('non-root screens show a labelled Back button; root screens do not', async () => {
    const { router } = renderAt('/more');
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
    const user = userEvent.setup();
    await user.click(screen.getByRole('link', { name: 'Money' }));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Money');
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(router.state.location.pathname).toBe('/more');
  });

  test.each(['/', '/calendar', '/tasks', '/guests', '/more', '/money'])('%s has no axe violations', async (path) => {
    const { container } = renderAt(path);
    expect(await axe(container)).toHaveNoViolations();
  });

  test('a stored-script name renders as text (SEC-27)', () => {
    render(<Screen title={'<img src=x onerror=alert(1)>'}><p>x</p></Screen>, { wrapper: ({ children }) => {
      const router = createMemoryRouter([{ path: '/', element: children }]);
      return <RouterProvider router={router} />;
    } });
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('<img src=x onerror=alert(1)>');
    expect(document.querySelector('img')).toBeNull();
  });
});

describe('error boundary', () => {
  test('a crashed screen shows a calm message and reports it', async () => {
    const calls = [];
    globalThis.fetch = (url, init) => { calls.push([url, init]); return Promise.resolve(new Response('{"ok":true,"data":{},"meta":{}}', { status: 200 })); };
    const Boom = () => { throw new Error('kaboom'); };
    const spy = console.error;
    console.error = () => {};
    render(<ErrorBoundary><Boom /></ErrorBoundary>);
    console.error = spy;
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong');
    await new Promise((r) => setTimeout(r, 0));
    expect(calls[0][0]).toBe('/api/v1/client-log');
    expect(JSON.parse(calls[0][1].body)).toMatchObject({ code: 'render_error', message: 'kaboom' });
  });
});
