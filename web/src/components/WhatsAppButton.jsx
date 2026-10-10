// Share on WhatsApp (FEATURES A7): wa.me with the text filled in. With no number,
// WhatsApp opens its chat picker. Plain link, no API, no cost.
import { MessageCircle } from 'lucide-react';

export function waHref(text, phone = '') {
  const digits = String(phone || '').replace(/\D/g, '');
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

export default function WhatsAppButton({ text, phone = '', label }) {
  return (
    <a href={waHref(text, phone)} target="_blank" rel="noopener noreferrer"
      className="tap inline-flex items-center justify-center gap-2 rounded-md border-[1.5px] border-border-strong bg-surface px-4 font-bold">
      <MessageCircle aria-hidden="true" size={20} /> {label}
    </a>
  );
}
