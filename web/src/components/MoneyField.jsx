// ₹ amount field (FEATURES A9, AC-MON-02): people type "125000", "1,25,000" or
// "1.25 lakh"; it shows ₹1,25,000 under the field and gives exact integer paise.
import { TextField } from './Field.jsx';
import { parseInrInput, formatInr, MAX_PAISE } from '../format/inr.js';
import { t } from '../i18n/strings.en.js';

/** text → { paise, error } (paise null while empty or wrong). */
export function readAmount(text, { required = true, max = MAX_PAISE } = {}) {
  const s = String(text ?? '').trim();
  if (s === '') return { paise: null, error: required ? t('money.amountBad') : null };
  const paise = parseInrInput(s);
  if (paise === null || paise < 1) return { paise: null, error: t('money.amountBad') };
  if (paise > max) return { paise: null, error: t('money.amountTooBig') };
  return { paise, error: null };
}

export default function MoneyField({ label, value, onChange, error, help, required = true, ...rest }) {
  const { paise } = readAmount(value, { required });
  const shown = paise !== null ? formatInr(paise) : null;
  return (
    <TextField label={label} value={value} onChange={onChange} inputMode="decimal" autoComplete="off" error={error}
      help={shown ?? help ?? t('money.amountHelp')} {...rest} />
  );
}
