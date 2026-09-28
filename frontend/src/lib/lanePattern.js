// World Rowing "chevron" lane pattern.
// Best seed always gets lane 3, then 4, then 2, then 5, then 1, then 6.
// Take the first N elements for an N-crews race (extends with 7, 8...).
export const LANE_PATTERN = [3, 4, 2, 5, 1, 6, 7, 8];

export function getLaneNumbers(n) {
  const count = Math.max(1, Math.min(Number(n) || 1, LANE_PATTERN.length));
  return LANE_PATTERN.slice(0, count);
}
