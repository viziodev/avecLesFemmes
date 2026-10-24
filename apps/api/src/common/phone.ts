export function normalizePhone(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const compact = value.trim().replace(/[\s().-]/g, '');
  if (/^\d{9}$/.test(compact)) return '+221' + compact;
  return compact.startsWith('00') ? '+' + compact.slice(2) : compact;
}
