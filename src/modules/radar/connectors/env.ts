import type { RadarConnectorEnv } from "./port";

/**
 * Environment names Radar understands. The filter keeps every other secret
 * out of the connector layer and lets the status screen report issues by name.
 */
export const RADAR_ENV_NAMES = [
  "RADAR_API_ENABLED",
  "RADAR_API_BASE_URL",
  "RADAR_API_TOKEN",
  "RADAR_FEED_ENABLED",
  "RADAR_FEED_URL",
  "RADAR_FEED_TOKEN",
  "RADAR_CRON_SECRET",
] as const;

export type RadarEnvName = (typeof RADAR_ENV_NAMES)[number];
export type RadarEnvIssueCode = "boolean" | "url";

/** Only the variable name and a stable code. Values are never reported. */
export interface RadarEnvIssue {
  readonly name: RadarEnvName;
  readonly code: RadarEnvIssueCode;
}

export interface RadarEnvReport {
  readonly env: RadarConnectorEnv;
  readonly issues: readonly RadarEnvIssue[];
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

/**
 * Validates the Radar subset of the environment without throwing.
 *
 * A malformed optional variable must not take the app down; it is reported on
 * the status screen and the connector stays disabled.
 */
export function readRadarConnectorEnv(
  source: Readonly<Record<string, string | undefined>>,
): RadarEnvReport {
  const env: Record<string, string> = {};
  const issues: RadarEnvIssue[] = [];

  for (const name of RADAR_ENV_NAMES) {
    const value = source[name]?.trim();
    if (value === undefined || value === "") continue;

    if (name.endsWith("_ENABLED") && value !== "true" && value !== "false") {
      issues.push({ name, code: "boolean" });
      continue;
    }
    if (name.endsWith("_URL") && !isHttpUrl(value)) {
      issues.push({ name, code: "url" });
      continue;
    }

    env[name] = value;
  }

  return { env, issues };
}
