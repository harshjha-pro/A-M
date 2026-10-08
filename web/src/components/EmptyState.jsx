// Empty state (DESIGN §7): icon, one sentence, at most one action.
export default function EmptyState({ Icon, text, action = null }) {
  return (
    <section className="flex flex-col items-center gap-4 rounded-md bg-surface px-6 py-10 text-center shadow-card">
      {Icon && <Icon aria-hidden="true" size={48} strokeWidth={1.75} className="text-text-muted" />}
      <p className="text-lg">{text}</p>
      {action}
    </section>
  );
}
