import type { ListingCandidate, RadarSourceMode } from "../domain";

/**
 * Radar connector boundary.
 *
 * A connector never reads `process.env` by itself and never receives a URL or a
 * credential from a form. The caller injects a filtered environment, so the
 * status screen can report missing names without ever touching their values.
 */

export type RadarConnectorEnv = Readonly<Record<string, string | undefined>>;

export type RadarConnectorState = "CONFIGURED" | "DISABLED" | "MISSING_CREDENTIALS" | "UNSUPPORTED";

export interface RadarConnectorStatus {
  readonly state: RadarConnectorState;
  /** Variable names only. Never their values. */
  readonly missingEnvVars: readonly string[];
  readonly requiresCredentials: boolean;
}

export interface RadarConnectorQuery {
  readonly sourceKey: string;
  readonly requestedAt: string;
  readonly limit: number;
}

export interface RadarConnectorDefinition {
  readonly key: string;
  readonly mode: RadarSourceMode;
  readonly label: string;
  readonly description: string;
  /** False until a real provider contract is implemented and approved. */
  readonly implemented: boolean;
  readonly requiresCredentials: boolean;
  /** Variable names only. */
  readonly requiredEnvVars: readonly string[];
  /** Optional explicit switch that must be exactly `true`. */
  readonly enableEnvVar?: string;
  /** Modes that are deliberately unsupported, such as public web scraping. */
  readonly unsupported?: boolean;
  readonly testOnly?: boolean;
}

export interface RadarConnector extends RadarConnectorDefinition {
  describe(env: RadarConnectorEnv): RadarConnectorStatus;
  fetchCandidates(query: RadarConnectorQuery, env: RadarConnectorEnv): Promise<readonly ListingCandidate[]>;
}

export type RadarConnectorErrorCode = "missing-credentials" | "disabled" | "unsupported" | "not-implemented";

export class RadarConnectorUnavailableError extends Error {
  readonly code: RadarConnectorErrorCode;
  readonly missingEnvVars: readonly string[];

  constructor(code: RadarConnectorErrorCode, message: string, missingEnvVars: readonly string[] = []) {
    super(message);
    this.name = "RadarConnectorUnavailableError";
    this.code = code;
    this.missingEnvVars = missingEnvVars;
  }
}

export function isEnvEnabled(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === "true";
}

export function describeConnector(definition: RadarConnectorDefinition, env: RadarConnectorEnv): RadarConnectorStatus {
  if (definition.unsupported === true) {
    return { state: "UNSUPPORTED", missingEnvVars: [], requiresCredentials: definition.requiresCredentials };
  }

  const missingEnvVars = definition.requiredEnvVars.filter((name) => {
    const value = env[name];
    return value === undefined || value.trim().length === 0;
  });
  if (missingEnvVars.length > 0) {
    return { state: "MISSING_CREDENTIALS", missingEnvVars, requiresCredentials: true };
  }

  if (definition.enableEnvVar !== undefined && !isEnvEnabled(env[definition.enableEnvVar])) {
    return { state: "DISABLED", missingEnvVars: [], requiresCredentials: definition.requiresCredentials };
  }

  return { state: "CONFIGURED", missingEnvVars: [], requiresCredentials: definition.requiresCredentials };
}

function assertConnectorReady(definition: RadarConnectorDefinition, env: RadarConnectorEnv): void {
  const status = describeConnector(definition, env);
  if (status.state === "MISSING_CREDENTIALS") {
    throw new RadarConnectorUnavailableError(
      "missing-credentials",
      `Connector ${definition.key} is missing environment variables: ${status.missingEnvVars.join(", ")}`,
      status.missingEnvVars,
    );
  }
  if (status.state === "DISABLED") {
    throw new RadarConnectorUnavailableError("disabled", `Connector ${definition.key} is disabled`);
  }
  if (status.state === "UNSUPPORTED") {
    throw new RadarConnectorUnavailableError("unsupported", `Connector ${definition.mode} is not supported`);
  }
  if (!definition.implemented) {
    throw new RadarConnectorUnavailableError("not-implemented", `Connector ${definition.key} has no provider yet`);
  }
}

export function createConnector(
  definition: RadarConnectorDefinition,
  fetchCandidates: (query: RadarConnectorQuery, env: RadarConnectorEnv) => Promise<readonly ListingCandidate[]>,
): RadarConnector {
  return {
    ...definition,
    describe: (env) => describeConnector(definition, env),
    fetchCandidates: async (query, env) => {
      assertConnectorReady(definition, env);
      return fetchCandidates(query, env);
    },
  };
}
