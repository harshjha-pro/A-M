// Vitest setup. The test machine pretends to be in New York, so any date
// that is not forced into IST shows up wrong (TESTING §1.7 "Indian formats").
process.env.TZ = 'America/New_York';
import '@testing-library/jest-dom/vitest';
import * as axeMatchers from 'vitest-axe/matchers';
import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

expect.extend(axeMatchers);
afterEach(() => cleanup());
globalThis.__APP_VERSION__ = '1.0.6';
