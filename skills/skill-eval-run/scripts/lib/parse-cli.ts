import { parseArgs } from "jsr:@std/cli/parse-args";

export type CLIResult<T> =
  | { success: true; flags: T }
  | { success: false; message: string; code: number };

export interface ParseCLIOptions {
  strings?: string[];
  booleans?: string[];
  required?: string[];
  defaults?: Record<string, unknown>;
  helpText: string;
}

export function parseCLI(
  options: ParseCLIOptions,
): { success: true; parsed: Record<string, unknown> } | { success: false; message: string; code: number } {
  const parsed = parseArgs(Deno.args, {
    string: options.strings ?? [],
    boolean: [...(options.booleans ?? []), "help"],
    alias: { h: "help" },
    default: options.defaults ?? {},
  });

  if (parsed.help) {
    console.error(options.helpText);
    Deno.exit(0);
  }

  const missing = (options.required ?? []).filter((k) => !parsed[k]);
  if (missing.length > 0) {
    return { success: false, message: `Missing required flags: ${missing.join(", ")}`, code: 2 };
  }

  return { success: true, parsed };
}
