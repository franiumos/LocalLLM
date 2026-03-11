export interface LocalModel {
  id: string;
  filename: string;
  filepath: string;
  size_bytes: number;
  quantization: string;
  downloaded_at: string;
}

export interface CatalogModelComponent {
  type: string; // "clip_l" | "clip_g" | "t5xxl" | "llm" | "vae"
  repo: string;
  filename: string;
  size_gb: number;
}

export interface CatalogModelDefaults {
  cfg_scale?: number;
  steps?: number;
  sampling_method?: string;
  width?: number;
  height?: number;
}

export interface CatalogModel {
  id: string;
  name: string;
  author: string;
  repo: string;
  description: string;
  parameters: string;
  category: string;
  recommended_quant: string;
  homepage?: string;
  capabilities?: string[];
  files: CatalogModelFile[];
  components?: CatalogModelComponent[];
  defaults?: CatalogModelDefaults;
  server_flags?: string[];
  performance_score?: number;
}

export interface CatalogModelFile {
  filename: string;
  size_gb: number;
  quant: string;
}
