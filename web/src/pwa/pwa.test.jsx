// Install and updates (PWA.md §3, §6; TESTING §1.7): the update prompt never reloads by
// itself and never over unsaved typing; forced mode on 426 / X-Min-Client-Version; a stuck
// old worker offers Fix the app; our Android install banner; the iPhone steps; old phones.
import { describe, test, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, act, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { axe } from '../test/axe.js';

const sw = vi.hoisted(() => ({
  state: { supported: true, registered: true, failed: false, needRefresh: false, installing: false },
  subs: new Set(),
  applyUpdate: vi.fn(() => false),
  checkForUpdate: vi.fn(async () => {}),
  updateArriving: vi.fn(async () => false),
}));
vi.mock('./swClient.js', () => ({
  getSwState: () => sw.state,
  subscribeSw: (fn) => { sw.subs.add(fn); return () => sw.subs.delete(fn); },
  applyUpdate: (...a) => sw.applyUpdate(...a),
  checkForUpdate: (...a) => sw.checkForUpdate(...a),
  updateArriving: (...a) => sw.updateArriving(...a),
  registerServiceWorker: vi.fn(),
}));
const setSw = (p) => { sw.state = { ...sw.state, ...p }; sw.subs.forEach((fn) => fn()); };

/* eslint-disable import/first */
import UpdatePrompt, { STUCK_AFTER_MS } from './UpdatePrompt.jsx';
import AndroidInstallBanner, { SNOOZE_KEY } from './AndroidInstallBanner.jsx';
import { captureInstallPrompt } from './useAndroidInstall.js';
import { IosSteps, shouldAutoOpenIosGuide, SEEN_KEY } from './IosInstallGuide.jsx';
import OldPhoneNotice from './OldPhoneNotice.jsx';
import { oldPhoneMessage, iosVersionOf, chromeVersionOf } from './platform.js';
import { useDirtyForm, anyDirtyForm } from './dirtyForms.js';
import { setForcedUpdate, isForcedUpdate, versionGreater } from './updateState.js';
import { api } from '../api/client.js';
import { routes } from '../routes.jsx';
import { fakeApi, fail, ok, signInAs, signOut } from '../test/helpers.js';

const IPHONE_16 = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1';
const IPHONE_18 = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1';
const CHROME_110 = 'Mozilla/5.0 (Linux; Android 11; SM-A515F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.5481.153 Mobile Safari/537.36';
const CHROME_130 = 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.6723.58 Mobile Safari/537.36';
const SAMSUNG = 'Mozilla/5.0 (Linux; Android 13; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/115.0.0.0 Mobile Safari/537.36';

function Dirty({ on }) {
  useDirtyForm('test-form', on);
  return null;
}

beforeEach(() => {
  sw.state = { supported: true, registered: true, failed: false, needRefresh: false, installing: false };
  sw.applyUpdate.mockReset().mockImplementation(() => sw.state.needRefresh); // like the real one: only with a waiting worker
  sw.checkForUpdate.mockClear();
  sw.updateArriving.mockReset().mockResolvedValue(false);
  try { localStorage.clear(); } catch { /* none */ }
});
afterEach(() => { act(() => setForcedUpdate(false)); signOut(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe('Update prompt', () => {
  test('hidden until a new version is waiting; then "New version available." and Tap to refresh activates it', async () => {
    fakeApi({});
    const user = userEvent.setup();
    const { container } = render(<UpdatePrompt />);
    expect(screen.queryByText('New version available.')).toBeNull();
    act(() => setSw({ needRefresh: true }));
    expect(screen.getByText('New version available.')).toBeInTheDocument();
    expect(document.documentElement.style.getPropertyValue('--am-update-h')).toMatch(/px$/); // the page makes room: Save stays reachable
    expect(await axe(container)).toHaveNoViolations();
    await user.click(screen.getByRole('button', { name: 'Tap to refresh' }));
    expect(sw.applyUpdate).toHaveBeenCalledTimes(1);
  });

  test('never over unsaved typing: "Save or close the open form first."; after saving it refreshes', async () => {
    fakeApi({});
    const user = userEvent.setup();
    const { rerender } = render(<><UpdatePrompt /><Dirty on /></>);
    act(() => setSw({ needRefresh: true }));
    expect(anyDirtyForm()).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Tap to refresh' }));
    expect(screen.getByText('Save or close the open form first. Then tap Refresh.')).toBeInTheDocument();
    expect(sw.applyUpdate).not.toHaveBeenCalled();
    rerender(<><UpdatePrompt /><Dirty on={false} /></>);
    await user.click(screen.getByRole('button', { name: 'Tap to refresh' }));
    expect(sw.applyUpdate).toHaveBeenCalledTimes(1);
  });

  test('a newer version.json asks for the new worker but never reloads by itself; stuck after 20 s → Fix the app', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    fakeApi({ 'GET /version.json': () => new Response(JSON.stringify({ version: '9.9.9' }), { status: 200 }) });
    const reload = vi.fn();
    const assign = vi.fn();
    vi.spyOn(window, 'location', 'get').mockReturnValue({ ...window.location, reload, assign });
    render(<UpdatePrompt />);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    await vi.waitFor(() => expect(sw.checkForUpdate).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('button', { name: 'Tap to refresh' })).toBeNull();
    await act(async () => { vi.advanceTimersByTime(STUCK_AFTER_MS + 10); });
    const button = await screen.findByRole('button', { name: 'Tap to refresh' });
    expect(reload).not.toHaveBeenCalled();
    expect(assign).not.toHaveBeenCalled();
    await act(async () => { button.click(); });
    expect(assign).toHaveBeenCalledWith('/reset.html');
  });

  test('same version on the server → nothing to do', async () => {
    fakeApi({ 'GET /version.json': () => new Response(JSON.stringify({ version: __APP_VERSION__ }), { status: 200 }) });
    render(<UpdatePrompt />);
    await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
    expect(sw.checkForUpdate).not.toHaveBeenCalled();
  });

  test('forced on 426: "Please refresh to keep saving. Your typing is kept." and it goes ahead even with a form open', async () => {
    fakeApi({ 'POST /tasks': () => fail(426, { code: 'update_required', message: 'Please refresh the app to keep saving.' }) });
    signInAs('papa');
    const user = userEvent.setup();
    render(<><UpdatePrompt /><Dirty on /></>);
    await act(async () => { await api('POST', '/tasks', { body: { title: 'x' } }).catch(() => {}); });
    expect(isForcedUpdate()).toBe(true);
    expect(screen.getByText('Please refresh to keep saving. Your typing is kept.')).toBeInTheDocument();
    act(() => setSw({ needRefresh: true }));
    await user.click(screen.getByRole('button', { name: 'Tap to refresh' }));
    expect(sw.applyUpdate).toHaveBeenCalledTimes(1);
  });

  test('any reply whose X-Min-Client-Version is above ours turns on the forced prompt', async () => {
    fakeApi({ 'GET /health': () => ok({ status: 'ok' }, 200, { 'X-Min-Client-Version': '99.0.0' }) });
    render(<UpdatePrompt />);
    await act(async () => { await api('GET', '/health'); });
    expect(screen.getByText('Please refresh to keep saving. Your typing is kept.')).toBeInTheDocument();
  });

  test('versions compare by number, not text', () => {
    expect(versionGreater('1.0.10', '1.0.9')).toBe(true);
    expect(versionGreater('1.0.9', '1.0.10')).toBe(false);
    expect(versionGreater('1.0.12', '1.0.12')).toBe(false);
    expect(versionGreater('2.0', '1.9.9')).toBe(true);
  });
});

describe('Android install banner', () => {
  function chromeReady(outcome = 'accepted') {
    const e = new Event('beforeinstallprompt');
    e.prompt = vi.fn(async () => {});
    e.userChoice = Promise.resolve({ outcome });
    return e;
  }

  test('appears once Chrome can install; Install opens Chrome\'s dialog; accepted → Done', async () => {
    captureInstallPrompt();
    const user = userEvent.setup();
    render(<AndroidInstallBanner android />);
    expect(screen.queryByText('Install A&M Wedding on this phone')).toBeNull();
    const e = chromeReady();
    act(() => { window.dispatchEvent(e); });
    expect(screen.getByRole('region', { name: 'Install the app' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Install' }));
    expect(e.prompt).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Done. Open A&M Wedding from your Home screen.')).toBeInTheDocument();
  });

  test('Not now hides it for 7 days', async () => {
    captureInstallPrompt();
    const user = userEvent.setup();
    const { unmount } = render(<AndroidInstallBanner android />);
    act(() => { window.dispatchEvent(chromeReady('dismissed')); });
    await user.click(screen.getByRole('button', { name: 'Not now' }));
    expect(screen.queryByRole('region', { name: 'Install the app' })).toBeNull();
    expect(localStorage.getItem(SNOOZE_KEY)).toBeTruthy();
    unmount();
    render(<AndroidInstallBanner android />);
    act(() => { window.dispatchEvent(chromeReady()); });
    expect(screen.queryByRole('region', { name: 'Install the app' })).toBeNull();
  });

  test('never on iPhone or a computer', () => {
    captureInstallPrompt();
    render(<AndroidInstallBanner android={false} />);
    act(() => { window.dispatchEvent(chromeReady()); });
    expect(screen.queryByRole('region', { name: 'Install the app' })).toBeNull();
  });
});

describe('iPhone Add to Home Screen guide', () => {
  test('4 illustrated steps with Next / Back; the last says log in once more', async () => {
    const user = userEvent.setup();
    const done = vi.fn();
    const { container } = render(<IosSteps onDone={done} nonSafari={false} version={18.5} />);
    expect(screen.getByText('Step 1 of 4')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Safari with the Share button circled' })).toHaveAttribute('src', '/install-guide/ios-1-share.svg');
    expect(await axe(container)).toHaveNoViolations();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText(/Keep Open as Web App on/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByText('Step 2 of 4')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText(/Log in once more/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(done).toHaveBeenCalled();
  });

  test('Chrome on iPhone → "Please open this in Safari"; iOS 16 → please update first', () => {
    const { unmount } = render(<IosSteps nonSafari />);
    expect(screen.getByText('Please open this in Safari')).toBeInTheDocument();
    unmount();
    render(<IosSteps nonSafari={false} version={16.7} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Please update this iPhone first');
  });

  test('opens by itself only once, and only on iPhone', () => {
    expect(shouldAutoOpenIosGuide(true)).toBe(true);
    expect(shouldAutoOpenIosGuide(false)).toBe(false);
    localStorage.setItem(SEEN_KEY, '2026-10-09T10:00:00Z');
    expect(shouldAutoOpenIosGuide(true)).toBe(false);
  });
});

describe('Old phones (PWA §0.1)', () => {
  test('iOS below 17 and Chrome below 120 get "please update"; current phones and Samsung Internet do not', () => {
    expect(iosVersionOf(IPHONE_16)).toBe(16.7);
    expect(chromeVersionOf(CHROME_130)).toBe(130);
    expect(chromeVersionOf(SAMSUNG)).toBeNull();
    expect(oldPhoneMessage(IPHONE_16)).toBe('ios');
    expect(oldPhoneMessage(CHROME_110)).toBe('chrome');
    expect(oldPhoneMessage(IPHONE_18)).toBeNull();
    expect(oldPhoneMessage(CHROME_130)).toBeNull();
    expect(oldPhoneMessage(SAMSUNG)).toBeNull();
  });

  test('the note can be put away for 30 days; in This phone it always shows', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<OldPhoneNotice agent={IPHONE_16} />);
    expect(screen.getByRole('note')).toHaveTextContent('Please update this iPhone');
    await user.click(screen.getByRole('button', { name: 'Got it' }));
    expect(screen.queryByRole('note')).toBeNull();
    unmount();
    render(<OldPhoneNotice agent={IPHONE_16} dismissible={false} />);
    expect(screen.getByRole('note')).toBeInTheDocument();
  });
});

describe('Screens', () => {
  function renderAt(path) {
    const router = createMemoryRouter(routes, { initialEntries: [path] });
    return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><RouterProvider router={router} /></QueryClientProvider>);
  }

  test('This phone: version, offline, Fix the app opens /reset.html', async () => {
    signInAs('papa');
    fakeApi({});
    const { container } = renderAt('/settings/phone');
    expect(await screen.findByRole('heading', { level: 1, name: 'This phone' })).toBeInTheDocument();
    expect(screen.getByText('App version')).toBeInTheDocument();
    expect(screen.getByText('Opens without internet').nextSibling).toHaveTextContent('Not on this browser'); // jsdom has no service workers
    expect(screen.getByRole('link', { name: 'Fix the app' })).toHaveAttribute('href', '/reset.html');
    expect(await axe(container)).toHaveNoViolations();
  });

  test('Install Guide on a computer: choose Android or iPhone', async () => {
    signInAs('papa');
    fakeApi({});
    const user = userEvent.setup();
    renderAt('/install');
    expect(await screen.findByRole('heading', { level: 1, name: 'Install Guide' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Chrome menu with Install app circled' })).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'iPhone' }));
    expect(screen.getByText('Step 1 of 4')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Fix the app' })).toHaveAttribute('href', '/reset.html');
  });

  test('Settings lists This phone for everyone', async () => {
    signInAs('nani');
    fakeApi({});
    renderAt('/settings');
    expect(await screen.findByRole('link', { name: 'This phone' })).toHaveAttribute('href', '/settings/phone');
  });

  test('typing in an edit form marks it unsaved (blocks the refresh) until it is saved or closed', async () => {
    signInAs('ayush');
    fakeApi({
      'GET /settings': () => ok({ bride_name: 'Mahi', groom_name: 'Ayush', bride_side_label: "Mahi's side", groom_side_label: "Ayush's side", wedding_start_date: '2027-02-14', wedding_end_date: '2027-02-16', city: 'Bhilwara', total_budget_paise: null, version: 1 }),
    });
    const user = userEvent.setup();
    renderAt('/settings/wedding');
    const edit = await screen.findByRole('button', { name: 'Edit' }).catch(() => null);
    if (edit) await user.click(edit);
    const city = await screen.findByLabelText('City');
    expect(anyDirtyForm()).toBe(false);
    await user.type(city, ' Rajasthan');
    expect(anyDirtyForm()).toBe(true);
  });
});
