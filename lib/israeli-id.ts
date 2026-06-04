// Israeli ID (תעודת זהות) checksum validation.
// Algorithm: a 9-digit number where each digit is multiplied by an alternating
// 1/2 weight; products >= 10 are reduced by digit-sum; the total must be a
// multiple of 10. Pad with leading zeros if shorter than 9 digits.
export function validateIsraeliId(raw: string | null | undefined): boolean {
  if (!raw) return false;
  const digits = String(raw).replace(/\D/g, "");
  if (digits.length === 0 || digits.length > 9) return false;
  const padded = digits.padStart(9, "0");
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    let n = Number(padded[i]) * ((i % 2) + 1);
    if (n > 9) n -= 9;
    sum += n;
  }
  return sum % 10 === 0;
}

export function normalizeIsraeliId(raw: string | null | undefined): string {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (!digits) return "";
  return digits.padStart(9, "0");
}
