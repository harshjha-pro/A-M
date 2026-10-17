# A&M Design System (redesign reference)

Source for the **A&M Wedding Planner** Design System artifact on claude.ai: tokens, 41 React components, 44 screen pages (every route in `web/src/routes.jsx`, phone + desktop, with states) and a clickable prototype.

This folder is design only. The production app in `/web` is not changed by it.

| Folder | What |
|---|---|
| `src/` | React components (`components.jsx`), screens (`screens/*.jsx`), sample data, icon list and `build.mjs` (esbuild → one `bundle.js` that sets `window.AM`) |
| `gen/` | Python helpers: `tokens.py` (writes `tokens.json` from the app palette), `photos.py` (generates the warm placeholder photos), `components_spec.py` + `screens_spec.py` + `write_project.py` (write every `preview.html` / `README.md`) |
| `project/` | Exactly what is published to the artifact (`project/…` paths), including `bundle.js`, `bundle.css`, `tokens.json`, brand book `README.md`, fonts and photos |

Rebuild after a change:

```bash
node design/system/src/build.mjs design/system/project/components/bundle.js
python3 design/system/gen/write_project.py design/system/project   # only if specs changed
```

The photos are generated placeholders. Replace them with the couple's own photos (they live in Settings › Home photos in the app).
