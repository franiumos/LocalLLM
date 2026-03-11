import { useState, useRef, useEffect } from "react";
import { Monitor, Cpu, Stack, CaretRight } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { useSettingsStore } from "@/features/settings/stores/settings-store";

interface LoadModeMenuProps {
  onSelect: (gpuLayers: number) => void;
  onClose: () => void;
  /** When true, renders inline without absolute positioning or outside-click handler (for use inside another dropdown). */
  inline?: boolean;
}

export function LoadModeMenu({ onSelect, onClose, inline }: LoadModeMenuProps) {
  const [showSlider, setShowSlider] = useState(false);
  const globalGpuStack = useSettingsStore(
    (s) => s.settings?.hardware.gpu_layers ?? -1,
  );
  const [sliderValue, setSliderValue] = useState(
    globalGpuStack > 0 ? globalGpuStack : 40,
  );
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (inline) return;
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose, inline]);

  return (
    <div
      ref={ref}
      className={
        inline
          ? ""
          : "absolute right-0 top-full z-50 mt-1 w-64 rounded-lg border border-border bg-background p-1 shadow-lg"
      }
    >
      <button
        type="button"
        onClick={() => onSelect(-1)}
        className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-xs transition-colors hover:bg-muted"
      >
        <Monitor size={14} className="shrink-0 text-primary" />
        <div>
          <p className="font-medium text-foreground">VRAM only</p>
          <p className="text-[10px] text-muted-foreground">
            Fastest, all layers on GPU
          </p>
        </div>
      </button>

      <button
        type="button"
        onClick={() => onSelect(0)}
        className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-xs transition-colors hover:bg-muted"
      >
        <Cpu size={14} className="shrink-0 text-primary" />
        <div>
          <p className="font-medium text-foreground">RAM only</p>
          <p className="text-[10px] text-muted-foreground">
            CPU only, no GPU needed
          </p>
        </div>
      </button>

      <button
        type="button"
        onClick={() => setShowSlider(!showSlider)}
        className={cn(
          "flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-xs transition-colors hover:bg-muted",
          showSlider && "bg-muted",
        )}
      >
        <Stack size={14} className="shrink-0 text-primary" />
        <div className="flex-1">
          <p className="font-medium text-foreground">Both VRAM & RAM</p>
          <p className="text-[10px] text-muted-foreground">
            Partial GPU offloading
          </p>
        </div>
        <CaretRight
          size={12}
          className={cn(
            "shrink-0 text-muted-foreground transition-transform",
            showSlider && "rotate-90",
          )}
        />
      </button>

      {showSlider && (
        <div className="mx-1 mt-1 rounded-md border border-border bg-muted/50 p-3">
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">GPU Layers</span>
            <span className="font-medium text-foreground">{sliderValue}</span>
          </div>
          <input
            type="range"
            min={1}
            max={99}
            step={1}
            value={sliderValue}
            onChange={(e) => setSliderValue(Number(e.target.value))}
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-border accent-primary"
          />
          <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
            <span>More RAM</span>
            <span>More VRAM</span>
          </div>
          <button
            type="button"
            onClick={() => onSelect(sliderValue)}
            className="mt-3 w-full rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Load with {sliderValue} GPU layers
          </button>
        </div>
      )}
    </div>
  );
}
