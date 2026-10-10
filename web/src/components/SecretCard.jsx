// A password or set-password link, shown ONCE, with Share on WhatsApp (wa.me) and Copy.
import { useState } from 'react';
import { MessageCircle, Copy } from 'lucide-react';
import { waDigits } from '../format/phone.js';
import { t } from '../i18n/strings.en.js';

export default function SecretCard({ member, password, link, onDone }) {
  const [copied, setCopied] = useState(false);
  const app = typeof window !== 'undefined' ? window.location.origin : '';
  const text = link
    ? t('members.linkText', { name: firstName(member.name), link })
    : t('members.passwordText', { name: firstName(member.name), app, phone: member.phone, password });
  const wa = `https://wa.me/${waDigits(member.phone)}?text=${encodeURIComponent(text)}`;

  async function copy() {
    try { await navigator.clipboard.writeText(link || password); setCopied(true); } catch { setCopied(false); }
  }

  return (
    <section className="flex flex-col gap-3 rounded-md border-[1.5px] border-primary bg-surface p-4" aria-live="polite">
      <h2 className="text-lg font-bold">{t(link ? 'members.shareTitleLink' : 'members.shareTitlePassword', { name: member.name })}</h2>
      <p className="break-all rounded-sm bg-surface-2 p-3 font-bold text-lg" data-testid="secret">{link || password}</p>
      <p className="text-sm text-text-muted">{t('members.shareOnce')}</p>
      <a href={wa} target="_blank" rel="noopener noreferrer" className="tap inline-flex items-center justify-center gap-2 rounded-md bg-primary px-5 font-bold text-on-primary">
        <MessageCircle aria-hidden="true" size={22} /> {t('members.whatsapp')}
      </a>
      <button type="button" onClick={copy} className="tap inline-flex items-center justify-center gap-2 rounded-md border-[1.5px] border-border-strong bg-surface px-5">
        <Copy aria-hidden="true" size={20} /> {copied ? t('members.copied') : t('members.copy')}
      </button>
      {onDone && <button type="button" onClick={onDone} className="tap rounded-md px-5 text-primary underline">{t('members.done')}</button>}
    </section>
  );
}

function firstName(name) {
  return String(name).split(/[\s(]/)[0] || name;
}
