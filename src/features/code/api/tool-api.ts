import { invoke } from "@tauri-apps/api/core";

export interface ToolExecResult {
  success: boolean;
  output: string;
}

export async function executeTool(
  toolName: string,
  args: string,
  workingDirectory: string,
): Promise<ToolExecResult> {
  return invoke<ToolExecResult>("execute_tool", {
    toolName,
    arguments: args,
    workingDirectory,
  });
}
