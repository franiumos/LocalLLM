import { invoke } from "@tauri-apps/api/core";
import type { AppSettings, SystemInfo } from "../stores/settings-store";

export async function getSettings(): Promise<AppSettings> {
  return invoke("get_settings");
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  return invoke("save_settings_cmd", { settings });
}

export async function getSystemInfo(): Promise<SystemInfo> {
  return invoke("get_system_info");
}

export async function moveModelsDirectory(
  oldDir: string,
  newDir: string,
): Promise<void> {
  return invoke("move_models_directory", { oldDir, newDir });
}
