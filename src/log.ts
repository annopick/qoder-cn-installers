// Lightweight debug diagnostics gated behind a module-level verbose flag.
// Output goes to stderr so it never pollutes normal stdout (e.g. --json).

let verbose = false;

export function setVerbose(v: boolean): void {
  verbose = v;
}

export function debug(msg: string): void {
  if (verbose) console.error(`[debug] ${msg}`);
}
