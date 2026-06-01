import path from "node:path";

export type ParsedSource =
  | { type: "local"; path: string }
  | { type: "git-url"; url: string }
  | { type: "git-ssh"; url: string };

export function parseSource(input: string): ParsedSource {
  const trimmed = input.trim();

  if (isLocalPath(trimmed)) {
    return { type: "local", path: trimmed };
  }

  if (isGitSsh(trimmed)) {
    return { type: "git-ssh", url: trimmed };
  }

  if (isGitUrl(trimmed)) {
    return { type: "git-url", url: trimmed };
  }

  if (trimmed.startsWith("./") || trimmed.startsWith("../")) {
    throw new Error("Absolute path required. Relative paths are not supported.");
  }

  throw new Error(`Unsupported source format: "${trimmed}". Use an absolute path, git URL, or git SSH.`);
}

function isLocalPath(input: string): boolean {
  if (path.isAbsolute(input)) return true;
  if (/^[A-Za-z]:[/\\]/.test(input)) return true;
  return false;
}

function isGitSsh(input: string): boolean {
  return /^git@[^:]+:.+/.test(input);
}

function isGitUrl(input: string): boolean {
  return /^https?:\/\/.+/.test(input);
}
