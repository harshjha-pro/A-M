// Mark as paid / Pay part (FEATURES B6, AC-MON-04): paid on (today), how, by whom,
// reference. Pay part also asks the amount, which must be less than what is due.
import { useState } from 'react';
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
import { t } from '../../i18n/strings.en.js';

export default function MarkPaidSheet({ payment, part = false, onClose, onDone }) {
  const [v, setV] = useState({ amount: '', paidOn: todayIst(), method: 'upi', paidBy: '', reference: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
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
      if (res.meta.undo) showUndo({ batchId: res.meta.undo.batchId, summary: res.meta.undo.summary, onUndone: onDone });
      onDone(res.data);
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
        <p className="text-sm text-text-muted">{t('money.receiptLater')}</p>
        <Button onClick={save} loading={busy}>{t('money.savePaid')}</Button>
      </div>
    </Sheet>
  );
}
