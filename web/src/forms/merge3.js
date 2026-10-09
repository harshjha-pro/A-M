// 3-way merge of base (what I loaded), mine and theirs (FEATURES A4).
//   changed only by me      → mine
//   changed only by them    → theirs (merged automatically)
//   both, to the same value → that value (merged automatically)
//   both, different values  → I choose
// Fields in `neverAuto` (amounts, statuses) are never merged silently when both
// sides touched them, even to the same value.

const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/**
 * @returns {{ merged: object, auto: string[], conflicts: string[], mine: string[] }}
 *   merged: theirs + my safe changes (conflicting fields hold theirs until chosen)
 */
export function merge3({ base, mine, theirs, fields, neverAuto = [] }) {
  const merged = { ...theirs };
  const auto = [];
  const conflicts = [];
  const mineChanged = [];
  for (const f of fields) {
    const b = base?.[f];
    const m = mine?.[f];
    const t = theirs?.[f];
    const iChanged = !same(m, b);
    const theyChanged = !same(t, b);
    if (iChanged) mineChanged.push(f);
    if (!iChanged) {
      merged[f] = t;
      if (theyChanged) auto.push(f);
    } else if (!theyChanged) {
      merged[f] = m;
    } else if (same(m, t) && !neverAuto.includes(f)) {
      merged[f] = m;
      auto.push(f);
    } else {
      merged[f] = t;
      conflicts.push(f);
    }
  }
  return { merged, auto, conflicts, mine: mineChanged };
}

/** Apply the choices from the conflict screen: 'mine' | 'theirs' | 'both' (long text). */
export function applyChoices(merged, mine, choices) {
  const out = { ...merged };
  for (const [f, choice] of Object.entries(choices)) {
    if (choice === 'mine') out[f] = mine[f];
    else if (choice === 'both') out[f] = [merged[f], mine[f]].filter((v) => v != null && v !== '').join('\n');
  }
  return out;
}

/** Keys whose value differs between two value maps. */
export function changedKeys(fields, from, to) {
  return fields.filter((f) => !same(from?.[f], to?.[f]));
}
