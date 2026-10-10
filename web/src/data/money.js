// Money helpers shared by the budget, payment and vendor screens (FEATURES B6).
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client.js';
import { useSession } from '../api/session.js';
import { clearMoneyDrafts } from '../forms/drafts.js';
import { formatDateOnly } from '../format/ist.js';
import { t } from '../i18n/strings.en.js';

export const METHODS = ['upi', 'cash', 'bank', 'cheque', 'card', 'other'];
export const VENDOR_CATEGORIES = ['venue', 'caterer', 'tent_decor', 'photo_video', 'makeup', 'mehndi_artist', 'band_dj', 'florist', 'transport', 'printer', 'pandit', 'jeweller', 'tailor', 'other'];

export const isNoMoney = (err) => err?.code === 'no_money_access';

/** When the server says money access ended: drop drafts with amounts (B6 edge case). */
export function useMoneyGuard(...errors) {
  const { user } = useSession();
  const lost = errors.some(isNoMoney);
  useEffect(() => { if (lost && user) clearMoneyDrafts(user.id); }, [lost, user]);
  return lost;
}

export function useCategories(enabled = true) {
  return useQuery({ queryKey: ['budget-categories'], queryFn: () => api('GET', '/budget-categories').then((r) => r.data), enabled, staleTime: 30_000 });
}

export function useAllVendors() {
  return useQuery({ queryKey: ['vendors', 'all'], queryFn: () => api('GET', '/vendors', { query: { limit: 200 } }).then((r) => r.data), staleTime: 30_000 });
}

/** "Due 20 Oct 2026" / "Paid 12 Oct 2026" / "No date" */
export function paymentWhen(p) {
  if (p.status === 'paid') return t('money.paidOn', { date: formatDateOnly(p.paidOn) });
  return p.dueDate ? t('money.dueOn', { date: formatDateOnly(p.dueDate) }) : t('money.noDate');
}

/** Vendor name, marked when deleted; "Expense" with none. */
export function payee(p) {
  if (!p.vendor) return t('money.expense');
  return p.vendor.deleted ? t('money.deletedVendor', { name: p.vendor.name }) : p.vendor.name;
}
