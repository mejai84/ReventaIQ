const MILLISECONDS_PER_DAY = 86_400_000;

export function timestampToMilliseconds(value: string, name: string): number {
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) {
    throw new RangeError(`${name} must be a valid ISO date-time`);
  }
  return milliseconds;
}

export function isExpired(expiresAt: string | undefined, evaluatedAt: string): boolean {
  if (expiresAt === undefined) {
    return false;
  }
  return (
    timestampToMilliseconds(expiresAt, "expiresAt") <
    timestampToMilliseconds(evaluatedAt, "evaluatedAt")
  );
}

export function ageInDays(observedAt: string, evaluatedAt: string): number {
  return (
    (timestampToMilliseconds(evaluatedAt, "evaluatedAt") -
      timestampToMilliseconds(observedAt, "observedAt")) /
    MILLISECONDS_PER_DAY
  );
}
