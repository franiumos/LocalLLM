import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useModelStore, type ServerStatus } from "@/features/models/stores/model-store";
import { useDownloadStore, type DownloadProgress } from "@/features/models/stores/download-store";

let unlisteners: UnlistenFn[] = [];

export async function initEventListeners(): Promise<void> {
  const unlistenServer = await listen<{ status: ServerStatus }>(
    "server:status",
    (event) => {
      useModelStore.getState().setServerStatus(event.payload.status);
    },
  );
  unlisteners.push(unlistenServer);

  const unlistenProgress = await listen<DownloadProgress>(
    "download:progress",
    (event) => {
      useDownloadStore.getState().updateProgress(event.payload);
    },
  );
  unlisteners.push(unlistenProgress);

  const unlistenComplete = await listen<{ id: string }>(
    "download:complete",
    (event) => {
      useDownloadStore.getState().markComplete(event.payload.id);
    },
  );
  unlisteners.push(unlistenComplete);

  const unlistenFailed = await listen<{ id: string; filename: string }>(
    "download:failed",
    (event) => {
      useDownloadStore.getState().markFailed(event.payload.id, event.payload.filename);
    },
  );
  unlisteners.push(unlistenFailed);
}

export function cleanupEventListeners(): void {
  for (const unlisten of unlisteners) {
    unlisten();
  }
  unlisteners = [];
}
