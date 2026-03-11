import { FolderOpen } from "@phosphor-icons/react";
import { open } from "@tauri-apps/plugin-dialog";

interface WorkingDirIndicatorProps {
  workingDirectory?: string;
  onSelect: (path: string) => void;
}

export function WorkingDirIndicator({
  workingDirectory,
  onSelect,
}: WorkingDirIndicatorProps) {
  const handleSelect = async () => {
    const selected = await open({
      directory: true,
      multiple: false,
      title: "Select project folder",
    });
    if (selected && typeof selected === "string") {
      onSelect(selected);
    }
  };

  if (!workingDirectory) {
    return (
      <button
        onClick={handleSelect}
        className="flex items-center gap-1.5 rounded-md bg-warning/10 px-2.5 py-1 text-xs text-warning transition-colors hover:bg-warning/20"
      >
        <FolderOpen size={12} />
        Select folder
      </button>
    );
  }

  const shortPath =
    workingDirectory.length > 30
      ? "..." + workingDirectory.slice(-27)
      : workingDirectory;

  return (
    <button
      onClick={handleSelect}
      className="flex items-center gap-1.5 rounded-md bg-muted px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      title={workingDirectory}
    >
      <FolderOpen size={12} className="shrink-0" />
      <span className="truncate">{shortPath}</span>
    </button>
  );
}
