/**
 * Precision Financial Mathematics Utilities
 * Prevents JavaScript binary floating point precision leakage
 */

export function round2(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

export function safeAdd(a: number, b: number): number {
  return round2(round2(a) + round2(b));
}

export function safeSub(a: number, b: number): number {
  return round2(round2(a) - round2(b));
}

export function safeMul(a: number, b: number): number {
  return round2(round2(a) * round2(b));
}

export function safeDiv(a: number, b: number): number {
  if (b === 0) return 0;
  return round2(round2(a) / round2(b));
}

export function safePercent(amount: number, percent: number): number {
  return round2((round2(amount) * round2(percent)) / 100);
}
