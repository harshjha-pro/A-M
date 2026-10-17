// A&M reusable components. Styling lives in bundle.css (am-* classes) and reads tokens.css variables.
import React from 'react';
import * as L from './icons.js';
import { cx, initials, useGo, PHOTOS } from './core.jsx';

/* ---------- Icon ---------- */
export function Icon({ name, size = 22, stroke = 2, label, className, style }) {
  const C = L[name] || L.Circle;
  return <C size={size} strokeWidth={stroke} aria-hidden={label ? undefined : 'true'} aria-label={label} className={className} style={style} />;
}

/* ---------- Buttons ---------- */
export function Button({ children, variant = 'primary', size = 'md', icon, iconRight, block, disabled, busy, onClick, to, type = 'button' }) {
  const go = useGo();
  return (
    <button
      type={type}
      className={cx('am-btn', `am-btn--${variant}`, `am-btn--${size}`, block && 'am-btn--block', busy && 'is-busy')}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      onClick={onClick || (to ? () => go(to) : undefined)}
    >
      {busy ? <span className="am-spinner" aria-hidden="true" /> : icon && <Icon name={icon} size={size === 'sm' ? 18 : 20} />}
      <span>{children}</span>
      {iconRight && <Icon name={iconRight} size={18} />}
    </button>
  );
}

export function IconButton({ icon, label, variant = 'plain', onClick, to, badge }) {
  const go = useGo();
  return (
    <button type="button" className={cx('am-iconbtn', `am-iconbtn--${variant}`)} aria-label={label} title={label} onClick={onClick || (to ? () => go(to) : undefined)}>
      <Icon name={icon} size={22} />
      {badge ? <span className="am-iconbtn__badge">{badge}</span> : null}
    </button>
  );
}

/* ---------- Form fields ---------- */
export function Field({ label, help, error, required, children, optional, id }) {
  return (
    <div className={cx('am-field', error && 'has-error')}>
      {label && (
        <label className="am-field__label" htmlFor={id}>
          {label}
          {optional && <span className="am-field__opt"> (optional)</span>}
          {required && <span className="am-field__req" aria-hidden="true"> *</span>}
        </label>
      )}
      {children}
      {error && error.trim() ? (
        <p className="am-field__error" role="alert"><Icon name="CircleAlert" size={16} /> {error}</p>
      ) : help ? (
        <p className="am-field__help">{help}</p>
      ) : null}
    </div>
  );
}

export function TextField({ label, value, placeholder, help, error, type = 'text', icon, suffix, optional, required, readOnly, inputMode }) {
  const id = 'f-' + (label || placeholder || '').replace(/\W+/g, '-').toLowerCase();
  return (
    <Field label={label} help={help} error={error} optional={optional} required={required} id={id}>
      <div className={cx('am-input', icon && 'has-icon', readOnly && 'is-readonly')}>
        {icon && <Icon name={icon} size={20} className="am-input__icon" />}
        <input id={id} type={type} defaultValue={value} placeholder={placeholder} readOnly={readOnly} inputMode={inputMode} aria-invalid={error ? 'true' : undefined} />
        {suffix}
      </div>
    </Field>
  );
}

export function TextArea({ label, value, placeholder, help, optional, rows = 3 }) {
  return (
    <Field label={label} help={help} optional={optional}>
      <div className="am-input am-input--area"><textarea rows={rows} defaultValue={value} placeholder={placeholder} /></div>
    </Field>
  );
}

export function SelectField({ label, value, help, optional, error, icon }) {
  return (
    <Field label={label} help={help} optional={optional} error={error}>
      <div className={cx('am-input am-input--select', icon && 'has-icon')}>
        {icon && <Icon name={icon} size={20} className="am-input__icon" />}
        <span className={cx('am-input__value', !value && 'is-placeholder')}>{value || 'Choose…'}</span>
        <Icon name="ChevronDown" size={20} className="am-input__chev" />
      </div>
    </Field>
  );
}

export function MoneyField({ label = 'Amount (₹)', value, help = 'Like 50000, 1,25,000 or 1.25 lakh', error }) {
  return (
    <Field label={label} help={help} error={error}>
      <div className="am-input am-input--money"><span className="am-input__prefix">₹</span><input defaultValue={value} inputMode="decimal" aria-invalid={error ? 'true' : undefined} /></div>
    </Field>
  );
}

export function Stepper({ label, value, min = 0, help }) {
  return (
    <div className="am-stepper">
      <div>
        <div className="am-stepper__label">{label}</div>
        {help && <div className="am-field__help">{help}</div>}
      </div>
      <div className="am-stepper__ctrl" role="group" aria-label={label}>
        <button type="button" className="am-stepper__btn" aria-label={`Fewer ${label}`} disabled={value <= min}><Icon name="Minus" /></button>
        <output className="am-stepper__value" aria-live="polite">{value}</output>
        <button type="button" className="am-stepper__btn" aria-label={`More ${label}`}><Icon name="Plus" /></button>
      </div>
    </div>
  );
}

export function Checkbox({ checked, label, sub, strike, onChange, size = 'md' }) {
  return (
    <label className={cx('am-check', `am-check--${size}`, checked && 'is-checked', strike && checked && 'is-struck')}>
      <input type="checkbox" defaultChecked={checked} onChange={onChange} />
      <span className="am-check__box" aria-hidden="true">{checked && <Icon name="Check" size={size === 'lg' ? 22 : 18} stroke={3} />}</span>
      <span className="am-check__text">
        <span className="am-check__label">{label}</span>
        {sub && <span className="am-check__sub">{sub}</span>}
      </span>
    </label>
  );
}

export function Switch({ on, label, sub }) {
  return (
    <label className="am-switch">
      <span className="am-check__text"><span className="am-check__label">{label}</span>{sub && <span className="am-check__sub">{sub}</span>}</span>
      <input type="checkbox" role="switch" defaultChecked={on} />
      <span className={cx('am-switch__track', on && 'is-on')} aria-hidden="true"><span className="am-switch__thumb" /></span>
    </label>
  );
}

export function Segmented({ options, value, label, glass }) {
  return (
    <div className={cx('am-seg', glass && 'am-seg--glass')} role="tablist" aria-label={label}>
      {options.map((o) => (
        <button key={o} type="button" role="tab" aria-selected={o === value} className={cx('am-seg__opt', o === value && 'is-on')}>{o}</button>
      ))}
    </div>
  );
}

export function DateShortcuts({ value = 'Tomorrow' }) {
  const opts = ['Today', 'Tomorrow', 'This week', 'Pick date', 'No date'];
  return (
    <div className="am-chiprow am-chiprow--wrap" role="radiogroup" aria-label="Due date">
      {opts.map((o) => <Chip key={o} selected={o === value} icon={o === 'Pick date' ? 'CalendarDays' : undefined}>{o}</Chip>)}
    </div>
  );
}

export function MoreDetails({ open, children, label = 'More details', count }) {
  return (
    <div className={cx('am-more', open && 'is-open')}>
      <button type="button" className="am-more__head" aria-expanded={open}>
        <span>{label}{count ? <span className="am-more__count"> · {count} fields</span> : null}</span>
        <Icon name={open ? 'ChevronUp' : 'ChevronDown'} />
      </button>
      {open && <div className="am-more__body">{children}</div>}
    </div>
  );
}

/* ---------- Chips, badges, avatars, progress ---------- */
export function Chip({ children, selected, icon, count, onClick, tone }) {
  return (
    <button type="button" className={cx('am-chip', selected && 'is-on', tone && `am-chip--${tone}`)} aria-pressed={selected} onClick={onClick}>
      {selected && !icon ? <Icon name="Check" size={16} stroke={3} /> : icon ? <Icon name={icon} size={16} /> : null}
      <span>{children}</span>
      {count != null && <span className="am-chip__count">{count}</span>}
    </button>
  );
}

export function ChipRow({ children, wrap }) {
  return <div className={cx('am-chiprow', wrap && 'am-chiprow--wrap')}>{children}</div>;
}

const STATUS = {
  todo: ['To do', 'neutral', 'Circle'], doing: ['Doing', 'info', 'CircleDot'], waiting: ['Waiting', 'warning', 'Hourglass'],
  done: ['Done', 'success', 'CircleCheck'], cancelled: ['Cancelled', 'muted', 'CircleSlash'],
  overdue: ['Overdue', 'danger', 'TriangleAlert'], today: ['Due today', 'accent', 'Clock'], urgent: ['Urgent', 'danger', 'Flame'],
  normal: ['Normal', 'neutral', 'Minus'], low: ['Low', 'muted', 'ArrowDown'],
  coming: ['Coming', 'success', 'CircleCheck'], not_coming: ['Not coming', 'muted', 'CircleX'], not_asked: ['Not asked yet', 'neutral', 'CircleHelp'],
  paid: ['Paid', 'success', 'CircleCheck'], due: ['Due', 'warning', 'Clock'], partly: ['Part paid', 'info', 'CircleDashed'],
  queued: ['Waiting to send', 'warning', 'CloudUpload'], private: ['Private', 'primary', 'Lock'], vip: ['Important', 'accent', 'Star'],
  owner: ['Owner', 'primary', 'Crown'], partner: ['Partner', 'primary', 'Heart'], family: ['Family', 'info', 'Users'], viewer: ['Viewer', 'neutral', 'Eye'],
  invited: ['Invited', 'info', 'Mail'], active: ['Active', 'success', 'CircleCheck'],
  photo: ['Photo', 'neutral', 'Image'], video: ['Video', 'neutral', 'Video'], document: ['Document', 'neutral', 'FileText'], link: ['Link', 'neutral', 'Link'], text: ['Text', 'neutral', 'StickyNote'],
  jain: ['Jain', 'success', 'Leaf'], normalDiet: ['Normal', 'neutral', 'Utensils'], must: ['Must-have', 'accent', 'Heart'],
};

export function StatusBadge({ status, children, size = 'md' }) {
  const [label, tone, icon] = STATUS[status] || [status, 'neutral', 'Circle'];
  return (
    <span className={cx('am-badge', `am-badge--${tone}`, `am-badge--${size}`)}>
      {!(status === 'normal' && children) && <Icon name={icon} size={size === 'sm' ? 14 : 16} stroke={2.25} />}
      {children || label}
    </span>
  );
}

export function Avatar({ name, size = 40, tone, src }) {
  const tones = ['blush', 'cream', 'champagne', 'wine'];
  const t = tone || tones[(name || 'A').charCodeAt(0) % tones.length];
  return (
    <span className={cx('am-avatar', `am-avatar--${t}`)} style={{ width: size, height: size, fontSize: size * 0.38 }} aria-hidden="true">
      {src ? <img src={src} alt="" /> : initials(name || '?')}
    </span>
  );
}

export function ProgressRing({ value, size = 64, stroke = 7, label, glass }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  return (
    <span className={cx('am-ring', glass && 'am-ring--glass')} style={{ width: size, height: size }} role="img" aria-label={label || `${value}% done`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} className="am-ring__track" strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} className="am-ring__bar" strokeWidth={stroke} fill="none" strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)} strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </svg>
      <span className="am-ring__num" style={{ fontSize: size * 0.26 }}>{value}%</span>
    </span>
  );
}

export function ProgressBar({ value, label, detail, tone = 'primary' }) {
  return (
    <div className="am-pbar">
      {(label || detail) && <div className="am-pbar__top"><span>{label}</span><span className="am-pbar__detail">{detail}</span></div>}
      <div className="am-pbar__track" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <div className={cx('am-pbar__fill', `am-pbar__fill--${tone}`)} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

/* ---------- Surfaces ---------- */
export function Card({ children, title, action, onAction, to, pad = true, tone, className, icon }) {
  const go = useGo();
  return (
    <section className={cx('am-card', tone && `am-card--${tone}`, !pad && 'am-card--flush', className)}>
      {title && (
        <header className="am-card__head">
          <h3 className="am-card__title">{icon && <Icon name={icon} size={20} />} {title}</h3>
          {action && <button type="button" className="am-link" onClick={onAction || (to ? () => go(to) : undefined)}>{action} <Icon name="ChevronRight" size={16} /></button>}
        </header>
      )}
      {children}
    </section>
  );
}

export function GlassPanel({ children, tone = 'white', className, style }) {
  return <div className={cx('am-glass', `am-glass--${tone}`, className)} style={style}>{children}</div>;
}

export function SectionHeader({ title, count, action, to, icon }) {
  const go = useGo();
  return (
    <div className="am-sechead">
      <h2 className="am-sechead__title">{icon && <Icon name={icon} size={20} />}{title}{count != null && <span className="am-sechead__count">{count}</span>}</h2>
      {action && <button type="button" className="am-link" onClick={to ? () => go(to) : undefined}>{action} <Icon name="ChevronRight" size={16} /></button>}
    </div>
  );
}

export function ListRow({ title, sub, meta, lead, trail, to, chevron = true, children, tone, dense }) {
  const go = useGo();
  return (
    <div className={cx('am-row', tone && `am-row--${tone}`, dense && 'am-row--dense')} role={to ? 'link' : undefined} tabIndex={to ? 0 : undefined} onClick={to ? () => go(to) : undefined}>
      {lead && <div className="am-row__lead">{lead}</div>}
      <div className="am-row__main">
        <div className="am-row__title">{title}</div>
        {sub && <div className="am-row__sub">{sub}</div>}
        {children}
      </div>
      {(meta || trail) && <div className="am-row__trail">{meta && <div className="am-row__meta">{meta}</div>}{trail}</div>}
      {to && chevron && <Icon name="ChevronRight" size={20} className="am-row__chev" />}
    </div>
  );
}

export function Photo({ name = 'hero', src, alt = '', ratio = '4/3', radius = 'lg', children, overlay, className, style, label, labelStyle }) {
  return (
    <div className={cx('am-photo', `am-photo--r-${radius}`, overlay && `am-photo--${overlay}`, className)} style={{ aspectRatio: ratio, ...style }}>
      <img src={src || PHOTOS[name]} alt={alt} loading="lazy" />
      {label && <span className="am-photo__slot" style={labelStyle}><Icon name="ImagePlus" size={14} /> {label}</span>}
      {children && <div className="am-photo__content">{children}</div>}
    </div>
  );
}

export function StatTile({ icon, label, value, sub, to, glass }) {
  const go = useGo();
  return (
    <button type="button" className={cx('am-stat', glass && 'am-stat--glass')} onClick={to ? () => go(to) : undefined}>
      <span className="am-stat__icon"><Icon name={icon} size={22} /></span>
      <span className="am-stat__label">{label}</span>
      <span className="am-stat__value">{value}</span>
      {sub && <span className="am-stat__sub">{sub}</span>}
    </button>
  );
}

export function Countdown({ months, days, hours, compact }) {
  const units = [[months, months === 1 ? 'Month' : 'Months'], [days, days === 1 ? 'Day' : 'Days'], [hours, hours === 1 ? 'Hour' : 'Hours']];
  return (
    <div className={cx('am-count', compact && 'am-count--compact')} role="timer" aria-label={`${months} months, ${days} days and ${hours} hours to the wedding`}>
      {units.map(([n, l]) => (
        <div key={l} className="am-count__tile am-glass am-glass--white">
          <span className="am-count__num">{String(n).padStart(2, '0')}</span>
          <span className="am-count__unit">{l}</span>
        </div>
      ))}
    </div>
  );
}

export function Monogram({ size = 44, light }) {
  return (
    <span className={cx('am-mono', light && 'am-mono--light')} style={{ width: size, height: size, fontSize: size * 0.33 }} aria-label="A&M monogram" role="img">
      A<span className="am-mono__amp">&amp;</span>M
    </span>
  );
}

/* ---------- Timeline (outfit, decor, event steps) ---------- */
export function Timeline({ steps }) {
  return (
    <ol className="am-tl">
      {steps.map((s, i) => (
        <li key={i} className={cx('am-tl__step', `is-${s.state}`)}>
          <span className="am-tl__dot" aria-hidden="true">{s.state === 'done' ? <Icon name="Check" size={16} stroke={3} /> : s.state === 'current' ? <span className="am-tl__pulse" /> : i + 1}</span>
          <div className="am-tl__body">
            <div className="am-tl__title">
              {s.title}
              <span className={cx('am-tl__state', `am-tl__state--${s.state}`)}>{s.state === 'done' ? 'Done' : s.state === 'current' ? 'Now' : 'Next'}</span>
            </div>
            {s.meta && <div className="am-tl__meta">{s.meta}</div>}
            {s.extra}
          </div>
        </li>
      ))}
    </ol>
  );
}

/* ---------- Navigation ---------- */
export const NAV = [
  ['Home', 'House', 'home'], ['Calendar', 'CalendarDays', 'calendar'], ['Tasks', 'ListChecks', 'tasks'], ['Workspace', 'LayoutGrid', 'workspaces'], ['More', 'Menu', 'more'],
];

export function BottomNav({ active = 'Home' }) {
  const go = useGo();
  return (
    <nav className="am-bnav am-glass am-glass--white" aria-label="Main">
      {NAV.map(([label, icon, to]) => (
        <button key={label} type="button" className={cx('am-bnav__item', label === active && 'is-on')} aria-current={label === active ? 'page' : undefined} onClick={() => go(to)}>
          <span className="am-bnav__pill"><Icon name={icon} size={24} /></span>
          <span className="am-bnav__label">{label}</span>
        </button>
      ))}
    </nav>
  );
}

export function SideNav({ active = 'Home', role = 'owner' }) {
  const go = useGo();
  const more = [['Guests', 'Users', 'guests'], ['Money', 'IndianRupee', 'money'], ['Vendors', 'Store', 'vendors'], ['Attachment Vault', 'Archive', 'vault'], ['Documents', 'FileText', 'documents'], ['Settings', 'Settings', 'settings']];
  return (
    <nav className="am-snav" aria-label="Main">
      <div className="am-snav__brand"><Monogram size={40} /><div><div className="am-snav__name">Ayush &amp; Mahi</div><div className="am-snav__date">14–16 Feb 2027</div></div></div>
      <div className="am-snav__group">
        {NAV.slice(0, 4).map(([label, icon, to]) => (
          <button key={label} type="button" className={cx('am-snav__item', label === active && 'is-on')} aria-current={label === active ? 'page' : undefined} onClick={() => go(to)}><Icon name={icon} /> {label}</button>
        ))}
      </div>
      <div className="am-snav__sep">More</div>
      <div className="am-snav__group">
        {more.filter(([l]) => l !== 'Money' || role === 'owner' || role === 'partner').map(([label, icon, to]) => (
          <button key={label} type="button" className={cx('am-snav__item', label === active && 'is-on')} onClick={() => go(to)}><Icon name={icon} /> {label}</button>
        ))}
      </div>
      <div className="am-snav__foot"><Avatar name="Ayush" size={36} /><div><div className="am-snav__name">Ayush</div><div className="am-snav__date">Owner · online</div></div></div>
    </nav>
  );
}

export function TopBar({ title, back, actions, sub, large, transparent, onBack }) {
  const go = useGo();
  return (
    <header className={cx('am-top', large && 'am-top--large', transparent && 'am-top--clear')}>
      {back && <IconButton icon="ChevronLeft" label="Back" onClick={onBack || (() => go('back'))} variant={transparent ? 'glass' : 'plain'} />}
      <div className="am-top__titles">
        <h1 className="am-top__title">{title}</h1>
        {sub && <div className="am-top__sub">{sub}</div>}
      </div>
      <div className="am-top__actions">{actions}</div>
    </header>
  );
}

export function QuickAdd({ label = 'Add', onClick, extended }) {
  return (
    <button type="button" className={cx('am-fab', extended && 'am-fab--ext')} aria-label={label} onClick={onClick}>
      <Icon name="Plus" size={26} stroke={2.5} />
      {extended && <span>{label}</span>}
    </button>
  );
}

export function StickyActions({ children, note }) {
  return <div className="am-sticky">{note && <div className="am-sticky__note">{note}</div>}<div className="am-sticky__row">{children}</div></div>;
}

/* ---------- Overlays and feedback ---------- */
export function BottomSheet({ title, children, actions, onClose }) {
  return (
    <div className="am-sheet-wrap">
      <div className="am-scrim" />
      <div className="am-sheet am-glass am-glass--white" role="dialog" aria-modal="true" aria-label={title}>
        <div className="am-sheet__grip" aria-hidden="true" />
        <div className="am-sheet__head"><h2 className="am-sheet__title">{title}</h2><IconButton icon="X" label="Close" onClick={onClose} /></div>
        <div className="am-sheet__body">{children}</div>
        {actions && <div className="am-sheet__actions">{actions}</div>}
      </div>
    </div>
  );
}

export function Dialog({ title, children, actions, icon, tone = 'primary' }) {
  return (
    <div className="am-dialog-wrap">
      <div className="am-scrim" />
      <div className="am-dialog am-glass am-glass--white" role="alertdialog" aria-modal="true" aria-label={title}>
        {icon && <span className={cx('am-dialog__icon', `am-dialog__icon--${tone}`)}><Icon name={icon} size={26} /></span>}
        <h2 className="am-dialog__title">{title}</h2>
        <div className="am-dialog__body">{children}</div>
        <div className="am-dialog__actions">{actions}</div>
      </div>
    </div>
  );
}

export function Toast({ children, tone = 'success', action, icon }) {
  const icons = { success: 'CircleCheck', info: 'Info', warning: 'CloudUpload', error: 'CircleAlert' };
  return (
    <div className={cx('am-toast', `am-toast--${tone}`)} role="status">
      <Icon name={icon || icons[tone]} size={22} />
      <span className="am-toast__text">{children}</span>
      {action && <button type="button" className="am-toast__action">{action}</button>}
    </div>
  );
}

export function UndoBar({ children, seconds }) {
  return (
    <div className="am-toast am-toast--dark" role="status">
      <Icon name="CircleCheck" size={22} />
      <span className="am-toast__text">{children}</span>
      <button type="button" className="am-toast__action"><Icon name="Undo2" size={18} /> Undo{seconds ? ` · ${seconds}s` : ''}</button>
    </div>
  );
}

export function SavedIndicator({ state = 'saved' }) {
  const m = { saving: ['Saving…', 'LoaderCircle'], saved: ['Saved', 'CircleCheck'], queued: ['Kept on this phone · will send when online', 'CloudUpload'], failed: ["Couldn't save", 'CircleAlert'] };
  return <span className={cx('am-saved', `am-saved--${state}`)} role="status"><Icon name={m[state][1]} size={16} /> {m[state][0]}</span>;
}

export function Banner({ tone = 'info', icon, title, children, action, onAction, compact }) {
  const icons = { info: 'Info', offline: 'WifiOff', waiting: 'CloudUpload', warning: 'TriangleAlert', error: 'CircleAlert', success: 'CircleCheck', update: 'RefreshCw', lock: 'Lock' };
  return (
    <div className={cx('am-banner', `am-banner--${tone}`, compact && 'am-banner--compact')} role={tone === 'error' ? 'alert' : 'status'}>
      <Icon name={icon || icons[tone]} size={22} className="am-banner__icon" />
      <div className="am-banner__text">
        {title && <div className="am-banner__title">{title}</div>}
        {children && <div className="am-banner__body">{children}</div>}
      </div>
      {action && <button type="button" className="am-banner__action" onClick={onAction}>{action}</button>}
    </div>
  );
}

export function Skeleton({ lines = 3, avatar, card, height }) {
  if (height) return <div className="am-skel am-skel--block" style={{ height }} aria-hidden="true" />;
  return (
    <div className={cx('am-skelrow', card && 'am-card')} aria-hidden="true">
      {avatar && <div className="am-skel am-skel--circle" />}
      <div className="am-skelrow__lines">
        {Array.from({ length: lines }).map((_, i) => <div key={i} className="am-skel" style={{ width: `${[78, 54, 66, 40][i % 4]}%` }} />)}
      </div>
    </div>
  );
}

export function EmptyState({ icon = 'Sparkles', title, children, action, actionIcon = 'Plus', onAction, photo }) {
  return (
    <div className="am-empty">
      {photo ? <Photo name={photo} ratio="16/9" className="am-empty__photo" /> : <span className="am-empty__icon"><Icon name={icon} size={34} /></span>}
      <h3 className="am-empty__title">{title}</h3>
      {children && <p className="am-empty__body">{children}</p>}
      {action && <Button icon={actionIcon} onClick={onAction}>{action}</Button>}
    </div>
  );
}

/* ---------- Frames ---------- */
export function StatusBar({ dark }) {
  return (
    <div className={cx('am-statusbar', dark && 'am-statusbar--dark')} aria-hidden="true">
      <span>9:41</span>
      <span className="am-statusbar__icons"><Icon name="Signal" size={16} /><Icon name="Wifi" size={16} /><Icon name="BatteryFull" size={18} /></span>
    </div>
  );
}

export function PhoneFrame({ children, nav, fab, label, overlay, darkStatus, scroll = true, offline, toast, theme, height }) {
  return (
    <figure className="am-frame">
      <div className="am-phone" data-theme={theme} style={height ? { height } : undefined}>
        <StatusBar dark={darkStatus} />
        {offline && <div className="am-offline-strip" role="status"><Icon name="WifiOff" size={16} /> No internet · from 9:12 am · 3 changes waiting</div>}
        <div className={cx('am-phone__screen', scroll && 'is-scroll', nav && 'has-nav')}>{children}</div>
        {toast && <div className={cx('am-phone__toast', nav && 'has-nav')}>{toast}</div>}
        {fab && <div className={cx('am-phone__fab', nav && 'has-nav')}>{fab}</div>}
        {nav && <BottomNav active={nav} />}
        {overlay}
        <div className="am-phone__home" aria-hidden="true" />
      </div>
      {label && <figcaption className="am-frame__label">{label}</figcaption>}
    </figure>
  );
}

export function DesktopFrame({ children, active, label, aside, title, actions, role }) {
  return (
    <figure className="am-frame am-frame--desk">
      <div className="am-desk">
        <SideNav active={active} role={role} />
        <div className="am-desk__main">
          {title && <header className="am-desk__top"><h1 className="am-desk__title">{title}</h1><div className="am-top__actions">{actions}</div></header>}
          <div className={cx('am-desk__body', aside && 'has-aside')}>
            <div className="am-desk__content">{children}</div>
            {aside && <aside className="am-desk__aside">{aside}</aside>}
          </div>
        </div>
      </div>
      {label && <figcaption className="am-frame__label">{label}</figcaption>}
    </figure>
  );
}

export function FrameRow({ children, title, note }) {
  return (
    <section className="am-framerow">
      {title && <h2 className="am-framerow__title">{title}</h2>}
      {note && <p className="am-framerow__note">{note}</p>}
      <div className="am-framerow__frames">{children}</div>
    </section>
  );
}

export function Hint({ children }) {
  return <p className="am-hint"><Icon name="Lock" size={16} /> {children}</p>;
}
