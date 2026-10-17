# Button

The pill-shaped action button; burgundy `primary` is the one main action on a screen.

## Use it

- One `primary` per screen (Save, Log in, Mark as done). Everything else is `secondary`, `outline` or `ghost`.
- `destructive` only after a confirmation dialog; on the screen itself use `destructive-outline`.
- `busy` replaces the icon with a spinner and keeps the label readable ("Saving…"). Never claim Saved until the server confirms.
- `disabled` is for actions the person cannot take; pair it with a `Hint` saying why (permissions, offline).
- Minimum height 48px (`lg` 56px for the main action on auth and detail screens).

## Props

`children, variant: 'primary'|'secondary'|'outline'|'ghost'|'destructive'|'destructive-outline'|'whatsapp'|'glass', size: 'sm'|'md'|'lg', icon, iconRight, block, busy, disabled, onClick, to`

All colours, spacing and radii come from the tokens; the component never hard-codes a value.
