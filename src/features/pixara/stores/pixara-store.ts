import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import type { GeneratedImage, ImageGenParams } from "../types/pixara";

export type ImageServerStatus = "stopped" | "starting" | "ready" | "error";

interface PixaraState {
  // Server state
  serverStatus: ImageServerStatus;

  // Generation state
  isGenerating: boolean;
  error: string | null;

  // Gallery
  images: GeneratedImage[];
  selectedImage: GeneratedImage | null;

  // Images directory path
  imagesDir: string | null;

  // Parameters (persisted in store for UX)
  params: ImageGenParams;

  // Actions
  startServer: (
    modelPath: string,
    components?: [string, string][],
    serverFlags?: string[],
  ) => Promise<void>;
  stopServer: () => Promise<void>;
  generate: () => Promise<void>;
  loadImages: () => Promise<void>;
  deleteImage: (id: string) => Promise<void>;
  setSelectedImage: (img: GeneratedImage | null) => void;
  updateParams: (partial: Partial<ImageGenParams>) => void;
  loadImagesDir: () => Promise<void>;
  setServerStatus: (status: ImageServerStatus) => void;
}

export const usePixaraStore = create<PixaraState>((set, get) => ({
  serverStatus: "stopped",
  isGenerating: false,
  error: null,
  images: [],
  selectedImage: null,
  imagesDir: null,

  params: {
    prompt: "",
    negative_prompt: "",
    width: 512,
    height: 512,
    steps: 20,
    cfg_scale: 7.0,
    seed: -1,
    sampling_method: "euler_a",
  },

  startServer: async (
    modelPath: string,
    components: [string, string][] = [],
    serverFlags: string[] = [],
  ) => {
    try {
      set({ serverStatus: "starting", error: null });
      await invoke("start_image_server", {
        modelPath,
        components,
        serverFlags,
      });
      set({ serverStatus: "ready" });
    } catch (error) {
      console.error("Failed to start image server:", error);
      set({ serverStatus: "error", error: String(error) });
    }
  },

  stopServer: async () => {
    try {
      await invoke("stop_image_server");
      set({ serverStatus: "stopped" });
    } catch (error) {
      console.error("Failed to stop image server:", error);
    }
  },

  generate: async () => {
    const { params } = get();
    if (!params.prompt.trim()) return;

    try {
      set({ isGenerating: true, error: null });
      const image = await invoke<GeneratedImage>("generate_image", { params });
      set((state) => ({
        isGenerating: false,
        images: [...state.images, image],
        selectedImage: image,
      }));
    } catch (error) {
      console.error("Image generation failed:", error);
      set({ isGenerating: false, error: String(error) });
    }
  },

  loadImages: async () => {
    try {
      const images = await invoke<GeneratedImage[]>("list_generated_images");
      set({ images });
    } catch (error) {
      console.error("Failed to load images:", error);
    }
  },

  deleteImage: async (id: string) => {
    try {
      await invoke("delete_generated_image", { imageId: id });
      set((state) => ({
        images: state.images.filter((img) => img.id !== id),
        selectedImage:
          state.selectedImage?.id === id ? null : state.selectedImage,
      }));
    } catch (error) {
      console.error("Failed to delete image:", error);
    }
  },

  setSelectedImage: (img) => set({ selectedImage: img }),

  updateParams: (partial) =>
    set((state) => ({
      params: { ...state.params, ...partial },
    })),

  loadImagesDir: async () => {
    try {
      const dir = await invoke<string>("get_images_directory");
      set({ imagesDir: dir });
    } catch (error) {
      console.error("Failed to get images directory:", error);
    }
  },

  setServerStatus: (status) => set({ serverStatus: status }),
}));
