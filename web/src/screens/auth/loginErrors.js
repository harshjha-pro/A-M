// Plain words for login problems (DESIGN §8).
import { AuthError, ForbiddenError, OfflineError, RateLimitedError, ValidationError } from '../../api/errors.js';
import { t } from '../../i18n/strings.en.js';

export function loginErrorText(e) {
  if (e instanceof OfflineError) return t('login.offline');
  if (e instanceof RateLimitedError) return t('login.locked');
  if (e instanceof AuthError) return t('login.wrong');
  if (e instanceof ValidationError) return t('login.wrong');
  if (e instanceof ForbiddenError) return e.message; // access ended
  return t('errors.server');
}
