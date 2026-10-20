// Vitest setup. The test machine pretends to be in New York, so any date
// that is not forced into IST shows up wrong (TESTING §1.7 "Indian formats").
process.env.TZ = 'America/New_York';
import '@testing-library/jest-dom/vitest';
import * as axeMatchers from 'vitest-axe/matchers';
import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

expect.extend(axeMatchers);
afterEach(() => cleanup());
globalThis.__APP_VERSION__ = '1.0.25';

// Node 24 jsdom compatibility: React Router navigations create internal Requests with jsdom AbortSignal
if (globalThis.Request) {
  const OrigRequest = globalThis.Request;
  const WrappedRequest = function Request(input, init) {
    if (init && init.signal) {
      try {
        new OrigRequest('http://localhost', { signal: init.signal });
      } catch {
        const copy = { ...init };
        delete copy.signal;
        return new OrigRequest(input, copy);
      }
    }
    return new OrigRequest(input, init);
  };
  WrappedRequest.prototype = OrigRequest.prototype;
  globalThis.Request = WrappedRequest;
}
