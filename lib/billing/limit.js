// lib/billing/limit.js

// Per-month limits by plan
export const MONTHLY_LIMITS = { basic: 100, pro: 1000, elite: Infinity };

export function limitForPlan(plan) {
  const key = String(plan || '').toLowerCase();
  const val = MONTHLY_LIMITS[key];
  // 0 => no access
  return val != null ? val : 0;
}

// UTC month key; monthly reset (e.g., '2025-09')
export function monthKey(date = new Date()) {
  // Using ISO string ensures UTC; first 7 chars are 'YYYY-MM'
  return date.toISOString().slice(0, 7);
}
