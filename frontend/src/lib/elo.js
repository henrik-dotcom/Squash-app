export function validateScore(s1, s2) {
  const n1 = parseInt(s1), n2 = parseInt(s2);
  if (isNaN(n1) || isNaN(n2) || n1 < 0 || n2 < 0) return false;
  return Math.max(n1, n2) >= 11 && Math.abs(n1 - n2) >= 2;
}

export function calcEloPreview(rA, rB, won, mc) {
  const k = rA >= 2000 ? 10 : mc >= 30 ? 20 : 40;
  const exp = 1 / (1 + Math.pow(10, (rB - rA) / 400));
  return +(rA + k * ((won ? 1 : 0) - exp)).toFixed(1);
}
