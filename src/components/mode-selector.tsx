import { ChatCircle, Code, Image } from "@phosphor-icons/react";
import type { IconProps } from "@phosphor-icons/react";
import type { ComponentType } from "react";
import { cn } from "@/lib/utils";
import { useModeStore } from "@/stores/mode-store";
import type { AppMode } from "@/lib/types";

const modes: { key: AppMode; label: string; icon: ComponentType<IconProps> }[] = [
  { key: "chat", label: "Chat", icon: ChatCircle },
  { key: "code", label: "Code", icon: Code },
  { key: "pixara", label: "Pixara", icon: Image },
];

export function ModeSelector() {
  const activeMode = useModeStore((s) => s.activeMode);
  const setMode = useModeStore((s) => s.setMode);

  return (
    <div className="mx-auto flex w-fit items-center gap-0.5 rounded-xl bg-muted p-1">
      {modes.map(({ key, label, icon: Icon }) => (
        <button
          key={key}
          onClick={() => setMode(key)}
          className={cn(
            "flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-medium transition-all",
            activeMode === key
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Icon size={14} />
          {label}
        </button>
      ))}
    </div>
  );
}
