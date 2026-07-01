import type { McpVariable } from "./mcp-discovery.js";

/**
 * Resolve each declared variable to its final value, using this priority:
 *   1. `cliEnv` (from --env KEY=VALUE flags) — highest
 *   2. `process.env` (with cross-platform case-insensitive fallback)
 *   3. the variable's `default` (only when not required)
 *
 * A required variable with no resolvable value throws — the caller should
 * surface this as a clear error so the user knows which value is missing.
 */
export function resolveVariableValues(
  variables: McpVariable[],
  cliEnv?: Record<string, string>,
): Record<string, string> {
  const resolved: Record<string, string> = {};

  for (const v of variables) {
    const name = v.name;
    if (!name) continue;

    // 1. --env flag value
    if (cliEnv && name in cliEnv) {
      resolved[name] = cliEnv[name];
      continue;
    }

    // 2. process.env — exact key first, then case-insensitive (Windows etc.)
    const fromEnv = readEnvCaseAware(name);
    if (fromEnv !== undefined) {
      resolved[name] = fromEnv;
      continue;
    }

    // 3. default (only meaningful for optional vars)
    if (v.default !== undefined && v.default !== null) {
      resolved[name] = String(v.default);
      continue;
    }

    // No value available
    if (v.required) {
      throw new Error(
        `Missing required MCP variable "${name}". Provide it via --env ${name}=<value> or set the ${name} environment variable.`,
      );
    }
    // Optional + no default: leave unresolved; the placeholder stays in place.
  }

  return resolved;
}

/**
 * Recursively replace `{{VAR}}` substrings inside every string value of the
 * config object. Supports placeholders embedded within a larger string (e.g.
 * `https://cnb:{{CNB_TOKEN}}@pypi.cnb.cool/...`). Returns a deep copy; the
 * input is never mutated. Unresolved placeholders (no matching value) are left
 * as-is so optional variables without a value don't break the install.
 */
export function substituteVariables<T>(obj: T, values: Record<string, string>): T {
  if (typeof obj === "string") {
    return replacePlaceholders(obj, values) as unknown as T;
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => substituteVariables(item, values)) as unknown as T;
  }
  if (obj !== null && typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(obj)) {
      result[key] = substituteVariables(val, values);
    }
    return result as unknown as T;
  }
  return obj;
}

function replacePlaceholders(str: string, values: Record<string, string>): string {
  // Match {{VAR_NAME}} where VAR_NAME is a known variable. Unknown {{...}}
  // patterns are left untouched (not our variable, don't guess).
  return str.replace(/\{\{(\w+)\}\}/g, (match, name: string) => {
    return name in values ? values[name] : match;
  });
}

/**
 * Read an environment variable, falling back to a case-insensitive lookup.
 * On Windows env var names are case-insensitive; on POSIX they are not, but
 * users frequently get the casing wrong, so we tolerate both.
 */
function readEnvCaseAware(name: string): string | undefined {
  if (process.env[name] !== undefined) return process.env[name];

  const lower = name.toLowerCase();
  for (const [key, val] of Object.entries(process.env)) {
    if (key.toLowerCase() === lower) return val;
  }
  return undefined;
}
