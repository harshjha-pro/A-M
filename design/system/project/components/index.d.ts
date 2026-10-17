// A&M Wedding Planner components — window.AM. Types are documentation.
import type { ReactNode } from "react";

/** The pill-shaped action button; burgundy `primary` is the one main action on a screen. */
export interface ButtonProps {
  children?: ReactNode;
  variant?: 'primary'|'secondary'|'outline'|'ghost'|'destructive'|'destructive-outline'|'whatsapp'|'glass';
  size?: 'sm'|'md'|'lg';
  icon?: string;
  iconRight?: string;
  block?: boolean;
  busy?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  to?: string;
}
export declare function Button(props: ButtonProps): JSX.Element;

/** A 48px round icon-only button for top bars, rows and media overlays. */
export interface IconButtonProps {
  icon?: string;
  label: string;
  variant?: 'plain'|'soft'|'outline'|'glass'|'call'|'wa';
  badge?: string;
  onClick?: () => void;
  to?: string;
}
export declare function IconButton(props: IconButtonProps): JSX.Element;

/** The floating burgundy Quick Add button that sits above the bottom navigation. */
export interface QuickAddProps {
  label?: string;
  extended?: boolean;
  onClick?: () => void;
}
export declare function QuickAdd(props: QuickAddProps): JSX.Element;

/** A labelled single-line input with optional icon, help text and an inline error. */
export interface TextFieldProps {
  label?: string;
  value?: string;
  placeholder?: string;
  help?: string;
  error?: string;
  type?: string;
  icon?: string;
  suffix?: ReactNode;
  optional?: boolean;
  required?: boolean;
  readOnly?: boolean;
  inputMode?: string;
}
export declare function TextField(props: TextFieldProps): JSX.Element;

/** A multi-line text input for notes and guest notes. */
export interface TextAreaProps {
  label?: string;
  value?: string;
  placeholder?: string;
  help?: string;
  optional?: boolean;
  rows?: string;
}
export declare function TextArea(props: TextAreaProps): JSX.Element;

/** A field that opens a picker sheet (vendor, event, category, status). */
export interface SelectFieldProps {
  label?: string;
  value?: string;
  help?: string;
  optional?: boolean;
  error?: string;
  icon?: string;
}
export declare function SelectField(props: SelectFieldProps): JSX.Element;

/** The rupee amount input; accepts 50000, 1,25,000 or 1.25 lakh. */
export interface MoneyFieldProps {
  label?: string;
  value?: string;
  help?: string;
  error?: string;
}
export declare function MoneyField(props: MoneyFieldProps): JSX.Element;

/** Large plus/minus control for headcounts (adults, children, Jain people). */
export interface StepperProps {
  label?: string;
  value?: number;
  min?: number;
  help?: string;
}
export declare function Stepper(props: StepperProps): JSX.Element;

/** Square checklist box and the large round task-completion control. */
export interface CheckboxProps {
  checked?: boolean;
  label?: string;
  sub?: string;
  strike?: boolean;
  size?: 'md'|'lg';
  onChange?: () => void;
}
export declare function Checkbox(props: CheckboxProps): JSX.Element;

/** An on/off setting with a label and explanation. */
export interface SwitchProps {
  on?: boolean;
  label?: string;
  sub?: string;
}
export declare function Switch(props: SwitchProps): JSX.Element;

/** A 2–4 option switch for views and short choices (Month/Agenda, Bride/Groom/Both). */
export interface SegmentedProps {
  options?: string[];
  value?: string;
  label?: string;
  glass?: boolean;
}
export declare function Segmented(props: SegmentedProps): JSX.Element;

/** Filter and choice chip; the selected chip is frosted blush glass with a tick. */
export interface ChipProps {
  children?: ReactNode;
  selected?: boolean;
  icon?: string;
  count?: string;
  tone?: string;
  onClick?: () => void;
}
export declare function Chip(props: ChipProps): JSX.Element;

/** Due-date shortcut chips: Today, Tomorrow, This week, Pick date, No date. */
export interface DateShortcutsProps {
  value?: string;
}
export declare function DateShortcuts(props: DateShortcutsProps): JSX.Element;

/** Disclosure that tucks optional form fields under "More details". */
export interface MoreDetailsProps {
  open?: boolean;
  count?: number;
  label?: string;
  children?: ReactNode;
}
export declare function MoreDetails(props: MoreDetailsProps): JSX.Element;

/** Icon + word status pill for tasks, Coming?, payments, roles, diets and attachment types. */
export interface StatusBadgeProps {
  status?: string;
  size?: 'sm'|'md';
}
export declare function StatusBadge(props: StatusBadgeProps): JSX.Element;

/** Initials avatar for people, families and vendors — no photos needed. */
export interface AvatarProps {
  name?: string;
  size?: number;
  tone?: 'blush'|'cream'|'champagne'|'wine';
  src?: string;
}
export declare function Avatar(props: AvatarProps): JSX.Element;

/** Circular percent for planning and workspace progress, with the number inside. */
export interface ProgressRingProps {
  value?: number;
  size?: number;
  stroke?: number;
  label?: string;
  glass?: boolean;
}
export declare function ProgressRing(props: ProgressRingProps): JSX.Element;

/** Thin labelled bar for steps done, budgets and uploads. */
export interface ProgressBarProps {
  value?: number;
  label?: string;
  detail?: string;
  tone?: 'primary'|'accent'|'success';
}
export declare function ProgressBar(props: ProgressBarProps): JSX.Element;

/** The solid white content card with optional title, icon and "See all" link. */
export interface CardProps {
  title?: string;
  icon?: string;
  action?: string;
  to?: string;
  tone?: string;
  pad?: boolean;
  children?: ReactNode;
}
export declare function Card(props: CardProps): JSX.Element;

/** Frosted translucent surface for small overlays on photos and floating controls. */
export interface GlassPanelProps {
  tone?: 'white'|'blush';
  style?: Record<string, string | number>;
  children?: ReactNode;
}
export declare function GlassPanel(props: GlassPanelProps): JSX.Element;

/** Section title with optional count and right-hand link. */
export interface SectionHeaderProps {
  title?: string;
  count?: number;
  action?: string;
  to?: string;
  icon?: string;
}
export declare function SectionHeader(props: SectionHeaderProps): JSX.Element;

/** The compact list row: lead (checkbox, avatar, icon), title, metadata, trailing status. */
export interface ListRowProps {
  title?: string;
  sub?: string;
  meta?: string;
  lead?: ReactNode;
  trail?: ReactNode;
  to?: string;
  chevron?: boolean;
  tone?: 'overdue'|'queued';
  dense?: boolean;
  children?: ReactNode;
}
export declare function ListRow(props: ListRowProps): JSX.Element;

/** Rounded image container with optional bottom scrim and overlay content. */
export interface PhotoProps {
  src?: string;
  ratio?: string;
  radius?: string;
  overlay?: 'scrim'|'scrim-top';
  label?: string;
  children?: ReactNode;
}
export declare function Photo(props: PhotoProps): JSX.Element;

/** Small dashboard figure tile with icon, label, value and a destination. */
export interface StatTileProps {
  icon?: string;
  label?: string;
  value?: number;
  sub?: string;
  to?: string;
  glass?: boolean;
}
export declare function StatTile(props: StatTileProps): JSX.Element;

/** Months · Days · Hours countdown in frosted tiles over the hero photo. */
export interface CountdownProps {
  months?: number;
  days?: number;
  hours?: number;
  compact?: boolean;
}
export declare function Countdown(props: CountdownProps): JSX.Element;

/** The A&M monogram set in the display face inside a champagne ring. */
export interface MonogramProps {
  size?: number;
  light?: boolean;
}
export declare function Monogram(props: MonogramProps): JSX.Element;

/** Vertical step timeline for outfits and decor items. */
export interface TimelineProps {
  steps?: { title: string; state: 'done' | 'current' | 'next'; meta?: string; extra?: ReactNode }[];
  state?: 'done'|'current'|'next';
  meta?: string;
}
export declare function Timeline(props: TimelineProps): JSX.Element;

/** The phone’s floating glass bottom navigation: Home · Calendar · Tasks · Workspace · More. */
export interface BottomNavProps {
  active?: string;
}
export declare function BottomNav(props: BottomNavProps): JSX.Element;

/** Desktop/tablet persistent navigation with the same destinations as the phone. */
export interface SideNavProps {
  active?: string;
  role?: string;
}
export declare function SideNav(props: SideNavProps): JSX.Element;

/** Sticky top bar with back, title (or large display title) and actions. */
export interface TopBarProps {
  title?: string;
  back?: boolean;
  actions?: ReactNode;
  sub?: string;
  large?: boolean;
  transparent?: boolean;
}
export declare function TopBar(props: TopBarProps): JSX.Element;

/** The frosted bottom action bar that keeps Save visible on long forms. */
export interface StickyActionsProps {
  note?: ReactNode;
  children?: ReactNode;
}
export declare function StickyActions(props: StickyActionsProps): JSX.Element;

/** Frosted bottom sheet for quick add, pickers, Coming? answers and contextual filters. */
export interface BottomSheetProps {
  title?: string;
  actions?: ReactNode;
  onClose?: () => void;
  children?: ReactNode;
}
export declare function BottomSheet(props: BottomSheetProps): JSX.Element;

/** Confirmation dialog for destructive, duplicate and conflict decisions. */
export interface DialogProps {
  title?: string;
  icon?: string;
  tone?: 'primary'|'danger'|'warning';
  actions?: ReactNode;
  children?: ReactNode;
}
export declare function Dialog(props: DialogProps): JSX.Element;

/** Short confirmation or problem message above the navigation. */
export interface ToastProps {
  tone?: 'success'|'info'|'warning'|'error';
  action?: string;
  icon?: string;
  children?: ReactNode;
}
export declare function Toast(props: ToastProps): JSX.Element;

/** Dark bar with Undo after completing or deleting something. */
export interface UndoBarProps {
  seconds?: number;
  children?: ReactNode;
}
export declare function UndoBar(props: UndoBarProps): JSX.Element;

/** Inline save status for edit screens: Saving…, Saved, Kept on this phone, Couldn’t save. */
export interface SavedIndicatorProps {
  state?: 'saving'|'saved'|'queued'|'failed';
}
export declare function SavedIndicator(props: SavedIndicatorProps): JSX.Element;

/** Full-width notice for offline, waiting, errors, warnings, updates and success. */
export interface BannerProps {
  tone?: string;
  icon?: string;
  title?: string;
  action?: string;
  onAction?: () => void;
  compact?: boolean;
  children?: ReactNode;
}
export declare function Banner(props: BannerProps): JSX.Element;

/** Shimmering placeholder rows while data loads. */
export interface SkeletonProps {
  lines?: string;
  avatar?: string;
  card?: string;
  height?: number;
}
export declare function Skeleton(props: SkeletonProps): JSX.Element;

/** Friendly empty or no-results message with one clear next action. */
export interface EmptyStateProps {
  icon?: string;
  photo?: string;
  title?: string;
  action?: string;
  actionIcon?: string;
  onAction?: () => void;
  children?: ReactNode;
}
export declare function EmptyState(props: EmptyStateProps): JSX.Element;

/** 390 × 844 phone frame with status bar, safe areas, glass nav, Quick Add and overlay slots. */
export interface PhoneFrameProps {
  children?: ReactNode;
  nav?: string;
  fab?: ReactNode;
  toast?: ReactNode;
  overlay?: ReactNode;
  label?: string;
  darkStatus?: boolean;
  offline?: boolean;
  height?: number;
  theme?: string;
}
export declare function PhoneFrame(props: PhoneFrameProps): JSX.Element;

/** 1280 × 820 desktop frame with side navigation, title bar and an optional detail panel. */
export interface DesktopFrameProps {
  children?: ReactNode;
  active?: string;
  title?: string;
  actions?: ReactNode;
  aside?: ReactNode;
  label?: string;
  role?: string;
}
export declare function DesktopFrame(props: DesktopFrameProps): JSX.Element;

/** Ready-made screen frames (phone and desktop), one per route and state. */
export declare const Screens: Record<string, (props?: Record<string, unknown>) => JSX.Element>;
/** Photography asset urls by name: hero, engagement, mehndi, night, drapes, reception, phere, petals, lehenga, sherwani, feast, stage. */
export declare const PHOTOS: Record<string, string>;
