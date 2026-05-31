export async function resolveModel(provided?: string): Promise<string> {
  if (provided) return provided;

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
