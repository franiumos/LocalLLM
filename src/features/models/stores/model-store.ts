import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import type { LocalModel } from "@/features/models/types/model";
import { useSettingsStore } from "@/features/settings/stores/settings-store";
import { resolveCapabilities, resolveCatalogEntry } from "@/features/models/utils/capabilities";
import { usePixaraStore } from "@/features/pixara/stores/pixara-store";

export type ServerStatus = "stopped" | "starting" | "ready" | "error";

interface ModelState {
  activeModel: string | null;
  loadingModel: string | null;
  serverStatus: ServerStatus;
  isImageModel: boolean;
  localModels: LocalModel[];
  loadModel: (modelPath: string, gpuLayersOverride?: number) => Promise<void>;
  unloadModel: () => Promise<void>;
  setServerStatus: (status: ServerStatus) => void;
  refreshLocalModels: () => Promise<void>;
}

export const useModelStore = create<ModelState>((set, get) => ({
  activeModel: null,
  loadingModel: null,
  serverStatus: "stopped",
  isImageModel: false,
  localModels: [],

  loadModel: async (modelPath: string, gpuLayersOverride?: number) => {
    try {
      set({ serverStatus: "starting", loadingModel: modelPath });

      // Determine if this is an image generation model
      const filename = modelPath.split(/[/\\]/).pop() ?? "";
      const caps = resolveCapabilities(filename);
      const isImageGen = caps.includes("image_generation");

      if (isImageGen) {
        // Image generation model — use sd-server instead of llama-server
        console.log("[model-store] Loading image model via sd-server:", modelPath);

        // Stop llama-server if running
        try { await invoke("stop_server"); } catch { /* ignore */ }

        // Look up catalog entry for components + server flags + defaults
        const catalogEntry = resolveCatalogEntry(filename);

        // Resolve component paths (stored flat in the models directory)
        const modelsDir = modelPath.substring(
          0,
          modelPath.lastIndexOf(filename) - 1,
        );
        const components: [string, string][] = (
          catalogEntry?.components ?? []
        ).map((c) => {
          const localName = c.filename.split("/").pop()!;
          // Use the same separator as the models directory path
          const sep = modelsDir.includes("\\") ? "\\" : "/";
          return [c.type, `${modelsDir}${sep}${localName}`] as [string, string];
        });

        const serverFlags = catalogEntry?.server_flags ?? [];

        console.log("[model-store] Image model components:", components);
        console.log("[model-store] Image model server flags:", serverFlags);

        // Apply optimal defaults for this model
        if (catalogEntry?.defaults) {
          const d = catalogEntry.defaults;
          usePixaraStore.getState().updateParams({
            cfg_scale: d.cfg_scale ?? 7.0,
            steps: d.steps ?? 20,
            sampling_method: d.sampling_method ?? "euler_a",
            width: d.width ?? 512,
            height: d.height ?? 512,
          });
        }

        // Start sd-server with components and flags
        await usePixaraStore
          .getState()
          .startServer(modelPath, components, serverFlags);
        set({ activeModel: modelPath, loadingModel: null, serverStatus: "ready", isImageModel: true });
      } else {
        // LLM model — use llama-server
        console.log("[model-store] Loading LLM model via llama-server:", modelPath);

        // Stop sd-server if running
        try { await usePixaraStore.getState().stopServer(); } catch { /* ignore */ }

        // Ensure settings are loaded before starting server
        let s = useSettingsStore.getState().settings;
        if (!s) {
          await useSettingsStore.getState().loadSettings();
          s = useSettingsStore.getState().settings;
        }

        const gpuLayers = gpuLayersOverride !== undefined
          ? gpuLayersOverride
          : (s?.hardware.gpu_layers ?? -1);
        const contextSize = s?.inference.context_size ?? 4096;
        const threads = s?.hardware.threads ?? 0;
        const flashAttention = s?.hardware.flash_attention ?? true;

        console.log("[model-store] Starting llama-server:", {
          modelPath,
          gpuLayers,
          contextSize,
          threads,
          flashAttention,
        });

        await invoke("start_server", {
          modelPath,
          gpuLayers,
          contextSize,
          threads,
          flashAttention,
        });
        set({ activeModel: modelPath, loadingModel: null, serverStatus: "ready", isImageModel: false });
      }
    } catch (error) {
      console.error("Failed to load model:", error);
      set({ serverStatus: "error", loadingModel: null });
    }
  },

  unloadModel: async () => {
    try {
      const { isImageModel } = get();
      if (isImageModel) {
        await usePixaraStore.getState().stopServer();
      } else {
        await invoke("stop_server");
      }
      set({ activeModel: null, serverStatus: "stopped", isImageModel: false });
    } catch (error) {
      console.error("Failed to unload model:", error);
    }
  },

  setServerStatus: (status: ServerStatus) => {
    set({ serverStatus: status });
  },

  refreshLocalModels: async () => {
    try {
      const models = await invoke<LocalModel[]>("list_local_models");
      set({ localModels: models });
    } catch (error) {
      console.error("Failed to refresh local models:", error);
    }
  },
}));
