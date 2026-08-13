export function calculateCrap(complexity: number, coverage: number | null): number | null {
  if (!Number.isInteger(complexity) || complexity < 1) {
    throw new RangeError("Complexity must be an integer greater than or equal to 1");
  }
  if (coverage === null) {
    return null;
  }
  if (!Number.isFinite(coverage) || coverage < 0 || coverage > 1) {
    throw new RangeError("Coverage must be between 0 and 1");
  }

  return complexity ** 2 * (1 - coverage) ** 3 + complexity;
}
