import { useEffect, useState } from "react";
import {
  Image,
  CircleNotch,
  MagicWand,
  Trash,
  CaretDown,
  CaretUp,
  Shuffle,
} from "@phosphor-icons/react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { usePixaraStore } from "@/features/pixara/stores/pixara-store";
import { useModelStore } from "@/features/models/stores/model-store";
import { ModelSwitcher } from "@/features/models/components/model-switcher";
import type { GeneratedImage } from "@/features/pixara/types/pixara";

export function PixaraView() {
  const {
    isGenerating,
    error,
    images,
    selectedImage,
    params,
    serverStatus,
    generate,
    loadImages,
    loadImagesDir,
    deleteImage,
    setSelectedImage,
    updateParams,
  } = usePixaraStore();

  const activeModel = useModelStore((s) => s.activeModel);
  const modelServerStatus = useModelStore((s) => s.serverStatus);
  const isImageModel = useModelStore((s) => s.isImageModel);

  const isReady =
    activeModel !== null &&
    modelServerStatus === "ready" &&
    isImageModel &&
    serverStatus === "ready";

  const [showParams, setShowParams] = useState(false);

  // Load images and directory on mount
  useEffect(() => {
    loadImages();
    loadImagesDir();
  }, [loadImages, loadImagesDir]);

  const handleGenerate = () => {
    if (!params.prompt.trim() || isGenerating || !isReady) return;
    generate();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleGenerate();
    }
  };

  const handleDeleteImage = (e: React.MouseEvent, img: GeneratedImage) => {
    e.stopPropagation();
    deleteImage(img.id);
  };

  const randomizeSeed = () => {
    updateParams({ seed: Math.floor(Math.random() * 2147483647) });
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header bar */}
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-2">
        <ModelSwitcher />
        <span className="text-xs text-muted-foreground">
          {modelServerStatus === "starting"
            ? "Loading model..."
            : isReady
              ? "Ready"
              : "Load an image model"}
        </span>
      </div>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Image display area */}
        <div className="flex flex-1 items-center justify-center overflow-auto bg-background/50 p-4">
          {isGenerating ? (
            <div className="flex flex-col items-center gap-4 text-muted-foreground">
              <CircleNotch size={48} className="animate-spin text-primary" />
              <p className="text-sm">Generating image...</p>
              <p className="text-xs text-muted-foreground">
                This may take a while depending on model size and settings
              </p>
            </div>
          ) : selectedImage ? (
            <div className="flex flex-col items-center gap-3">
              <img
                src={convertFileSrc(selectedImage.filepath)}
                alt={selectedImage.prompt}
                className="max-h-[50vh] max-w-full rounded-lg object-contain shadow-lg"
              />
              <div className="max-w-md text-center">
                <p className="text-xs text-muted-foreground">
                  {selectedImage.prompt}
                </p>
                <p className="mt-1 text-[10px] text-muted-foreground/60">
                  {selectedImage.width}x{selectedImage.height} &middot;{" "}
                  {selectedImage.steps} steps &middot; CFG{" "}
                  {selectedImage.cfg_scale} &middot; Seed {selectedImage.seed}
                </p>
              </div>
            </div>
          ) : !isReady ? (
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
              <div className="rounded-2xl bg-muted p-4">
                <Image size={48} weight="light" />
              </div>
              <h2 className="text-xl font-semibold text-foreground">
                Image Generation
              </h2>
              <p className="max-w-md text-center text-sm leading-relaxed">
                {modelServerStatus === "starting"
                  ? "Loading model..."
                  : "Load an image generation model to start creating images."}
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
              <div className="rounded-2xl bg-muted p-4">
                <MagicWand size={48} weight="light" />
              </div>
              <p className="text-sm">
                Enter a prompt below and click Generate
              </p>
            </div>
          )}
        </div>

        {/* Parameters panel (collapsible) */}
        {showParams && (
          <div className="shrink-0 border-t border-border bg-muted/30 px-4 py-3">
            <div className="mx-auto grid max-w-2xl grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
              {/* Negative prompt */}
              <div className="col-span-2 sm:col-span-3">
                <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Negative Prompt
                </label>
                <input
                  type="text"
                  value={params.negative_prompt}
                  onChange={(e) =>
                    updateParams({ negative_prompt: e.target.value })
                  }
                  placeholder="Things to avoid..."
                  className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground"
                />
              </div>

              {/* Width */}
              <div>
                <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Width
                </label>
                <select
                  value={params.width}
                  onChange={(e) =>
                    updateParams({ width: Number(e.target.value) })
                  }
                  className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground"
                >
                  <option value={256}>256</option>
                  <option value={384}>384</option>
                  <option value={512}>512</option>
                  <option value={640}>640</option>
                  <option value={768}>768</option>
                  <option value={1024}>1024</option>
                </select>
              </div>

              {/* Height */}
              <div>
                <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Height
                </label>
                <select
                  value={params.height}
                  onChange={(e) =>
                    updateParams({ height: Number(e.target.value) })
                  }
                  className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground"
                >
                  <option value={256}>256</option>
                  <option value={384}>384</option>
                  <option value={512}>512</option>
                  <option value={640}>640</option>
                  <option value={768}>768</option>
                  <option value={1024}>1024</option>
                </select>
              </div>

              {/* Steps */}
              <div>
                <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Steps
                </label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={params.steps}
                  onChange={(e) =>
                    updateParams({ steps: Number(e.target.value) })
                  }
                  className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground"
                />
              </div>

              {/* CFG Scale */}
              <div>
                <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  CFG Scale
                </label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  step={0.5}
                  value={params.cfg_scale}
                  onChange={(e) =>
                    updateParams({ cfg_scale: Number(e.target.value) })
                  }
                  className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground"
                />
              </div>

              {/* Seed */}
              <div>
                <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Seed
                </label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={-1}
                    value={params.seed}
                    onChange={(e) =>
                      updateParams({ seed: Number(e.target.value) })
                    }
                    className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground"
                  />
                  <button
                    onClick={randomizeSeed}
                    className="shrink-0 rounded-lg border border-border bg-background p-1.5 text-muted-foreground transition-colors hover:text-foreground"
                    title="Random seed"
                  >
                    <Shuffle size={12} />
                  </button>
                </div>
              </div>

              {/* Sampling Method */}
              <div>
                <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Sampler
                </label>
                <select
                  value={params.sampling_method}
                  onChange={(e) =>
                    updateParams({ sampling_method: e.target.value })
                  }
                  className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground"
                >
                  <option value="euler_a">Euler A</option>
                  <option value="euler">Euler</option>
                  <option value="heun">Heun</option>
                  <option value="dpm2">DPM2</option>
                  <option value="dpm++2s_a">DPM++ 2S A</option>
                  <option value="dpm++2m">DPM++ 2M</option>
                  <option value="dpm++2mv2">DPM++ 2M v2</option>
                  <option value="lcm">LCM</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Prompt input bar */}
        <div className="shrink-0 border-t border-border bg-background px-4 py-3">
          <div className="mx-auto flex max-w-2xl items-end gap-2">
            <div className="flex flex-1 flex-col gap-2">
              <textarea
                value={params.prompt}
                onChange={(e) => updateParams({ prompt: e.target.value })}
                onKeyDown={handleKeyDown}
                placeholder="Describe the image you want to generate..."
                rows={2}
                disabled={!isReady || isGenerating}
                className="w-full resize-none rounded-xl border border-border bg-muted px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
            <div className="flex flex-col gap-1">
              {/* Settings toggle */}
              <button
                onClick={() => setShowParams(!showParams)}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                title={showParams ? "Hide settings" : "Show settings"}
              >
                {showParams ? (
                  <CaretDown size={16} />
                ) : (
                  <CaretUp size={16} />
                )}
              </button>
              {/* Generate button */}
              {isGenerating ? (
                <button
                  disabled
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground"
                  title="Generating..."
                >
                  <CircleNotch size={16} className="animate-spin" />
                </button>
              ) : (
                <button
                  onClick={handleGenerate}
                  disabled={
                    !isReady || !params.prompt.trim() || isGenerating
                  }
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-colors hover:bg-primary/80 disabled:cursor-not-allowed disabled:opacity-50"
                  title="Generate image"
                >
                  <MagicWand size={16} />
                </button>
              )}
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="mx-auto mt-2 max-w-2xl rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          )}
        </div>

        {/* Gallery strip */}
        {images.length > 0 && (
          <div className="shrink-0 border-t border-border bg-muted/30 px-4 py-2">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {images.map((img) => (
                <GalleryThumbnail
                  key={img.id}
                  image={img}
                  isSelected={selectedImage?.id === img.id}
                  onSelect={() => setSelectedImage(img)}
                  onDelete={(e) => handleDeleteImage(e, img)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function GalleryThumbnail({
  image,
  isSelected,
  onSelect,
  onDelete,
}: {
  image: GeneratedImage;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: (e: React.MouseEvent) => void;
}) {
  return (
    <div
      onClick={onSelect}
      className={`group relative shrink-0 cursor-pointer overflow-hidden rounded-lg border-2 transition-all ${
        isSelected
          ? "border-primary shadow-md"
          : "border-transparent hover:border-border"
      }`}
    >
      <img
        src={convertFileSrc(image.filepath)}
        alt={image.prompt}
        className="h-16 w-16 object-cover"
      />
      {/* Delete button */}
      <button
        onClick={onDelete}
        className="absolute right-0.5 top-0.5 hidden rounded-full bg-background/80 p-0.5 text-destructive transition-colors hover:bg-destructive hover:text-destructive-foreground group-hover:block"
        title="Delete image"
      >
        <Trash size={10} />
      </button>
    </div>
  );
}
