export function constructAgentMessage(
  prompt: string,
  outputDir: string,
  skillPath: string | undefined,
): string {
  const instruction = skillPath
    ? `Read ${skillPath} and use it to complete the following task.`
    : "Execute the following task without consulting any skill. Use only your default behavior.";

  return `${instruction}

Write output files to: ${outputDir}

${prompt}`;
}
