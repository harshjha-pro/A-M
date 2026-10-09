// Home card (DESIGN §7 Card): surface, title, at most 5 items, one action.
import { Link } from 'react-router-dom';

export default function Card({ title, to, seeAll, children, tone = '' }) {
  return (
    <section className={`flex flex-col gap-3 rounded-md bg-surface p-4 shadow-card ${tone}`} aria-label={title}>
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-lg font-bold">{to ? <Link to={to} className="underline-offset-4 hover:underline">{title}</Link> : title}</h2>
        {seeAll && to && <Link to={to} className="tap inline-flex items-center font-bold text-primary">{seeAll} →</Link>}
      </div>
      {children}
    </section>
  );
}
