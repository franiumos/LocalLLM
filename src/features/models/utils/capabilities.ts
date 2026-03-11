import { getCatalogModels } from "@/features/library/api/catalog-api";
import type { CatalogModel, LocalModel } from "@/features/models/types/model";
import type { AppMode, ModelCapability } from "@/lib/types";

export function resolveCapabilities(filename: string): ModelCapability[] {
  const entry = resolveCatalogEntry(filename);
  return entry ? ((entry.capabilities ?? []) as ModelCapability[]) : [];
}

/** Look up the catalog model entry for a given filename. */
export function resolveCatalogEntry(
  filename: string,
): CatalogModel | undefined {
  const catalog = getCatalogModels();
  for (const model of catalog) {
    for (const file of model.files) {
      if (file.filename === filename) {
        return model;
      }
    }
  }
  return undefined;
}

/** Returns true if a filename is a component file (not a loadable model). */
export function isComponentFile(filename: string): boolean {
  const catalog = getCatalogModels();
  for (const model of catalog) {
    if (!model.components) continue;
    for (const comp of model.components) {
      const localName = comp.filename.split("/").pop()!;
      if (localName === filename) return true;
    }
  }
  return false;
}

export function getModelsForMode(
  localModels: LocalModel[],
  mode: AppMode,
): LocalModel[] {
  // Always filter out component files (text encoders, VAEs, etc.)
  const filtered = localModels.filter((m) => !isComponentFile(m.filename));

  if (mode === "chat") return filtered;

  if (mode === "pixara") {
    return filtered.filter((m) =>
      resolveCapabilities(m.filename).includes("image_generation"),
    );
  }

  if (mode === "code") {
    // Show all LLM models for code mode (exclude image gen models)
    return filtered.filter(
      (m) => !resolveCapabilities(m.filename).includes("image_generation"),
    );
  }

  return filtered;
}

export function isImageGenerationModel(filename: string): boolean {
  return resolveCapabilities(filename).includes("image_generation");
}

export function modelSupportsVision(filename: string): boolean {
  return resolveCapabilities(filename).includes("vision");
}

export function modelSupportsToolUse(filename: string): boolean {
  return resolveCapabilities(filename).includes("tool_use");
}
