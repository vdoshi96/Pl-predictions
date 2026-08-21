export type MetricDirection = "ascending" | "descending";

export type BoundaryTieWarning = Readonly<{
  boundaryRank: number;
  direction: MetricDirection;
  tiedCount: number;
  tiedValue: number;
}>;

function sortedValues(
  rows: readonly { metricValue: number }[],
  direction: MetricDirection,
): number[] {
  return rows
    .map((row) => row.metricValue)
    .sort((left, right) =>
      direction === "descending" ? right - left : left - right,
    );
}

export function findBoundaryTieWarnings(
  rows: readonly { metricValue: number }[],
  boundaryRank: number,
  direction: MetricDirection,
): BoundaryTieWarning[] {
  if (boundaryRank < 1 || rows.length === 0) return [];
  const values = sortedValues(rows, direction);
  const warnings: BoundaryTieWarning[] = [];
  let index = 0;
  while (index < values.length) {
    const tiedValue = values[index];
    let end = index;
    while (end < values.length && values[end] === tiedValue) end += 1;
    const startRank = index + 1;
    if (startRank <= boundaryRank && boundaryRank < end) {
      warnings.push({
        boundaryRank,
        direction,
        tiedCount: end - index,
        tiedValue,
      });
    }
    index = end;
  }
  return warnings;
}

export function evaluateCoverage(
  rows: readonly { metricValue: number }[],
  requiredRank: number,
): Readonly<{
  complete: boolean;
  coveredThroughRank: number;
  shortfall: number;
}> {
  const coveredThroughRank = Math.min(requiredRank, rows.length);
  return {
    complete: rows.length >= requiredRank,
    coveredThroughRank,
    shortfall: Math.max(0, requiredRank - rows.length),
  };
}
