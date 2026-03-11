import { invoke } from "@tauri-apps/api/core";
import type { LocalModel } from "../types/model";

export async function listLocalModels(): Promise<LocalModel[]> {
  return invoke("list_local_models");
}

export async function deleteModel(filename: string): Promise<void> {
  return invoke("delete_model", { filename });
}

export async function getStorageUsage(): Promise<[number, number]> {
  return invoke("get_storage_usage");
}
