// Empty state (DESIGN §7): icon, one sentence, at most one action.
export default function EmptyState({ Icon, text, action = null }) {
  return (
    <section className="flex flex-col items-center gap-4 rounded-lg bg-surface px-6 py-10 text-center shadow-card">
      {Icon && <span className="grid size-20 place-items-center rounded-full bg-primary-soft text-primary"><Icon aria-hidden="true" size={36} strokeWidth={1.75} /></span>}
      <p className="text-lg">{text}</p>
      {action}
    </section>
  );
}
