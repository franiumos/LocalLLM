import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { useToastStore } from "@/components/ui/toast";

export interface DownloadProgress {
  id: string;
  filename: string;
  bytes_downloaded: number;
  total_bytes: number;
  speed_bps: number;
  eta_seconds: number;
  status: "queued" | "downloading" | "paused" | "complete" | "failed";
}

interface DownloadState {
  downloads: Record<string, DownloadProgress>;
  startDownload: (url: string, filename: string) => Promise<string>;
  pauseDownload: (id: string) => Promise<void>;
  resumeDownload: (id: string) => Promise<void>;
  cancelDownload: (id: string) => Promise<void>;
  updateProgress: (progress: DownloadProgress) => void;
  markComplete: (id: string) => void;
  markFailed: (id: string, filename: string) => void;
  removeDownload: (id: string) => void;
}

export const useDownloadStore = create<DownloadState>((set, get) => ({
  downloads: {},

  startDownload: async (url: string, filename: string) => {
    const id = await invoke<string>("start_download", { url, filename });
    set((state) => ({
      downloads: {
        ...state.downloads,
        [id]: {
          id,
          filename,
          bytes_downloaded: 0,
          total_bytes: 0,
          speed_bps: 0,
          eta_seconds: 0,
          status: "queued",
        },
      },
    }));
    return id;
  },

  pauseDownload: async (id: string) => {
    await invoke("pause_download", { downloadId: id });
    const dl = get().downloads[id];
    if (dl) {
      set((state) => ({
        downloads: {
          ...state.downloads,
          [id]: { ...dl, status: "paused" },
        },
      }));
    }
  },

  resumeDownload: async (id: string) => {
    await invoke("resume_download", { downloadId: id });
    const dl = get().downloads[id];
    if (dl) {
      set((state) => ({
        downloads: {
          ...state.downloads,
          [id]: { ...dl, status: "downloading" },
        },
      }));
    }
  },

  cancelDownload: async (id: string) => {
    await invoke("cancel_download", { downloadId: id });
    set((state) => {
      const { [id]: _, ...rest } = state.downloads;
      return { downloads: rest };
    });
  },

  updateProgress: (progress: DownloadProgress) => {
    set((state) => ({
      downloads: {
        ...state.downloads,
        [progress.id]: progress,
      },
    }));
  },

  markComplete: (id: string) => {
    const dl = get().downloads[id];
    if (dl) {
      set((state) => ({
        downloads: {
          ...state.downloads,
          [id]: { ...dl, status: "complete" },
        },
      }));
      useToastStore.getState().addToast(`Download complete: ${dl.filename}`, "success");
      setTimeout(() => {
        get().removeDownload(id);
      }, 3000);
    }
  },

  markFailed: (id: string, filename: string) => {
    const dl = get().downloads[id];
    if (dl) {
      set((state) => ({
        downloads: {
          ...state.downloads,
          [id]: { ...dl, status: "failed" },
        },
      }));
    }
    useToastStore.getState().addToast(`Download failed: ${filename}`, "error");
  },

  removeDownload: (id: string) => {
    set((state) => {
      const { [id]: _, ...rest } = state.downloads;
      return { downloads: rest };
    });
  },
}));
