async function listOpendModels(): Promise<string[]> {
  try {
    const cmd = new Deno.Command("opencode", {
      args: ["models"],
      stdout: "piped",
      stderr: "null",
    });
    const { success, stdout } = await cmd.output();
    if (!success) return [];
    const out = new TextDecoder().decode(stdout).trim();
    return out.split("\n").map((l) => l.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

function fuzzyMatch(provided: string, available: string[]): string | null {
  const lower = provided.toLowerCase();

  // exact match (case-insensitive)
  const exact = available.find((m) => m.toLowerCase() === lower);
  if (exact) return exact;

  // suffix match: match against the part after the last '/'
  for (const model of available) {
    const suffix = model.split("/").pop()?.toLowerCase();
    if (suffix === lower) return model;
    if (suffix?.includes(lower) || lower.includes(suffix)) return model;
  }

  // substring match on the full ID
  const sub = available.find((m) => m.toLowerCase().includes(lower));
  if (sub) return sub;

  return null;
}

export async function resolveModel(provided?: string): Promise<string> {
  if (!provided) {
    const envModel = Deno.env.get("OPENCODE_MODEL");
    if (envModel) return envModel;

    try {
      const cmd = new Deno.Command("opencode", {
        args: ["config", "get", "model"],
        stdout: "piped",
        stderr: "null",
      });
      const { success, stdout } = await cmd.output();
      if (success) {
        const model = new TextDecoder().decode(stdout).trim();
        if (model) return model;
      }
    } catch {
      // opencode CLI not available
    }

    console.error("Could not resolve model. Provide --model, set OPENCODE_MODEL, or configure a default model in opencode.");
    Deno.exit(1);
  }

  const available = await listOpendModels();
  if (available.length === 0) return provided;

  const match = fuzzyMatch(provided, available);
  if (match) {
    if (match !== provided) {
      console.error(`Model "${provided}" resolved to "${match}"`);
    }
    return match;
  }

  console.error(`Model "${provided}" not found among available models.`);
  console.error(`Available models:\n  ${available.join("\n  ")}`);
  console.error("Provide --model with a fully qualified model ID (e.g. opencode/gpt-4o).");
  Deno.exit(1);
}
