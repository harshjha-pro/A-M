# ListRow

The compact list row: lead (checkbox, avatar, icon), title, metadata, trailing status.

## Use it

- Rows are 64px+ and the whole row is the tap target. `overdue` tone tints the left side; `queued` marks waiting-to-send.

## Props

`title, sub, meta, lead, trail, to, chevron, tone: 'overdue'|'queued', dense, children`

All colours, spacing and radii come from the tokens; the component never hard-codes a value.
