// Mark as paid / Pay part (FEATURES B6, AC-MON-04): paid on (today), how, by whom,
// reference. Pay part also asks the amount, which must be less than what is due.
// Mark as paid can take a receipt photo; it is uploaded after the payment is saved,
// so a failed upload never undoes the payment (AC-MON-09).
import { useRef, useState } from 'react';
import { Camera, X } from 'lucide-react';
import Sheet from '../../components/Sheet.jsx';
import Button from '../../components/Button.jsx';
import MoneyField, { readAmount } from '../../components/MoneyField.jsx';
import { TextField, ChoiceChips, FixSummary } from '../../components/Field.jsx';
import { api, newIdemKey } from '../../api/client.js';
import { withRelogin } from '../../api/auth.js';
import { ValidationError } from '../../api/errors.js';
import { showUndo, showToast } from '../../undo/undoStore.js';
import { todayIst } from '../../format/ist.js';
import { formatInr } from '../../format/inr.js';
import { METHODS } from '../../data/money.js';
import { ACCEPT } from '../../data/documents.js';
import { t } from '../../i18n/strings.en.js';

export default function MarkPaidSheet({ payment, part = false, onClose, onDone }) {
  const [v, setV] = useState({ amount: '', paidOn: todayIst(), method: 'upi', paidBy: '', reference: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState(null); // File, kept in memory
  const picker = useRef(null);
  const set = (k) => (x) => setV((cur) => ({ ...cur, [k]: x }));

  async function save() {
    const errs = {};
    let amountPaise;
    if (part) {
      const a = readAmount(v.amount);
      if (a.error) errs.amountPaise = a.error;
      else if (a.paise >= payment.amountPaise) errs.amountPaise = t('money.partTooBig', { amount: formatInr(payment.amountPaise) });
      amountPaise = a.paise;
    }
    if (!v.paidOn) errs.paidOn = t('money.paidOnLabel');
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    const body = { paidOn: v.paidOn, method: v.method, paidBy: v.paidBy.trim() || null, reference: v.reference.trim() || null, ...(part ? { amountPaise } : {}) };
    try {
      const res = await withRelogin(() => api('POST', `/payments/${payment.id}/${part ? 'pay-part' : 'mark-paid'}`, { body, ifMatch: payment.version, idemKey: newIdemKey() }));
      if (res.meta.undo) showUndo({ batchId: res.meta.undo.batchId, summary: res.meta.undo.summary, onUndone: () => onDone() });
      onDone(res.data, part ? null : receipt);
    } catch (e) {
      if (e instanceof ValidationError) setErrors(e.fields);
      else showToast(e.message || t('errors.server'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet title={part ? t('money.payPart') : t('money.markPaid')} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <FixSummary fields={errors} />
        {part && <MoneyField label={t('money.partAmount')} value={v.amount} onChange={set('amount')} error={errors.amountPaise}
          help={t('money.partHelp', { amount: formatInr(payment.amountPaise) })} />}
        <TextField type="date" label={t('money.paidOnLabel')} value={v.paidOn} onChange={set('paidOn')} max={todayIst()} error={errors.paidOn} />
        <ChoiceChips label={t('money.method')} value={v.method} onChange={set('method')} options={METHODS.map((m) => ({ value: m, label: t(`money.methods.${m}`) }))} error={errors.method} />
        <TextField label={t('money.paidBy')} value={v.paidBy} onChange={set('paidBy')} maxLength={60} />
        <TextField label={t('money.reference')} help={t('money.referenceHelp')} value={v.reference} onChange={set('reference')} maxLength={60} />
        {!part && (
          <div className="flex flex-col gap-2">
            <input ref={picker} type="file" accept={ACCEPT} className="sr-only" tabIndex={-1} aria-label={t('money.receiptPhoto')}
              onChange={(e) => { setReceipt(e.target.files?.[0] ?? null); e.target.value = ''; }} />
            {receipt ? (
              <p className="flex items-center gap-2 rounded-md border-[1.5px] border-border p-3">
                <span className="flex-1 break-all">{t('money.receiptChosen', { name: receipt.name })}</span>
                <button type="button" className="tap inline-flex items-center gap-1 text-primary" onClick={() => setReceipt(null)}><X aria-hidden="true" size={18} />{t('money.receiptRemove')}</button>
              </p>
            ) : (
              <Button variant="secondary" onClick={() => picker.current?.click()}><Camera aria-hidden="true" size={20} />{t('money.addReceipt')}</Button>
            )}
          </div>
        )}
        <Button needsInternet onClick={save} loading={busy}>{t('money.savePaid')}</Button>
      </div>
    </Sheet>
  );
}
