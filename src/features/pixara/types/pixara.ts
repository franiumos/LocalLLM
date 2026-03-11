export interface GeneratedImage {
  id: string;
  filename: string;
  prompt: string;
  negative_prompt: string;
  width: number;
  height: number;
  steps: number;
  cfg_scale: number;
  seed: number;
  model_filename: string;
  created_at: string;
  filepath: string;
}

export interface ImageGenParams {
  prompt: string;
  negative_prompt: string;
  width: number;
  height: number;
  steps: number;
  cfg_scale: number;
  seed: number;
  sampling_method: string;
}
