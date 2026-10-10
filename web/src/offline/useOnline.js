// Does the phone have internet right now? (navigator.onLine + the online/offline events.)
// "true" can still mean a weak signal; the outbox copes with that. "false" is reliable.
import { useSyncExternalStore } from 'react';

const subscribe = (fn) => {
  window.addEventListener('online', fn);
  window.addEventListener('offline', fn);
  return () => { window.removeEventListener('online', fn); window.removeEventListener('offline', fn); };
};
const read = () => (typeof navigator === 'undefined' ? true : navigator.onLine !== false);

export function useOnline() {
  return useSyncExternalStore(subscribe, read, () => true);
}
