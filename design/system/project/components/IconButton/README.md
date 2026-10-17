# IconButton

A 48px round icon-only button for top bars, rows and media overlays.

## Use it

- Always pass `label`: it becomes the accessible name and tooltip.
- `glass` only over photos (hero back/edit buttons). `call`/`wa` pair on vendor and family rows.
- Never use an icon button for the main action of a screen.

## Props

`icon, label (required), variant: 'plain'|'soft'|'outline'|'glass'|'call'|'wa', badge, onClick, to`

All colours, spacing and radii come from the tokens; the component never hard-codes a value.
