# TextField

A labelled single-line input with optional icon, help text and an inline error.

## Use it

- Label above the field, never placeholder-only. Help text explains format in plain words.
- Errors appear under the field in `danger` with an icon and replace the help text; the summary banner says how many things to fix.
- 52px tall, 17px text, `border-strong` edge so it meets 3:1.

## Props

`label, value, placeholder, help, error, type, icon, suffix, optional, required, readOnly, inputMode`

All colours, spacing and radii come from the tokens; the component never hard-codes a value.
