// The API speaks snake_case (same as the database); the app uses camelCase.
// This is the ONLY place that converts (CONTEXT §8).

export const toCamelKey = (k) => k.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
export const toSnakeKey = (k) => k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype;
}

function convert(value, keyFn) {
  if (Array.isArray(value)) return value.map((v) => convert(v, keyFn));
  if (!isPlainObject(value)) return value;
  const out = {};
  for (const [k, v] of Object.entries(value)) out[keyFn(k)] = convert(v, keyFn);
  return out;
}

export const toCamel = (value) => convert(value, toCamelKey);
export const toSnake = (value) => convert(value, toSnakeKey);

/** Error field paths: "items.2.due_date" → "items.2.dueDate" */
export const camelPath = (path) => String(path).split('.').map(toCamelKey).join('.');
