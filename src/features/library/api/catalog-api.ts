import catalogData from "../../../../catalog/models.json";
import type { CatalogModel } from "@/features/models/types/model";

export function getCatalogModels(): CatalogModel[] {
  return catalogData as CatalogModel[];
}

export function getDownloadUrl(repo: string, filename: string): string {
  return `https://huggingface.co/${repo}/resolve/main/${filename}`;
}
