import { useState, useRef, useCallback, type KeyboardEvent } from "react";
import { PaperPlaneRight, Square, Paperclip, X, Warning } from "@phosphor-icons/react";
import { open } from "@tauri-apps/plugin-dialog";
import { readTextFile, readFile } from "@tauri-apps/plugin-fs";
import { cn } from "@/lib/utils";
import type { FileAttachment } from "@/features/chat/types/chat";

interface MessageInputProps {
  onSend: (content: string, attachments?: FileAttachment[]) => void;
  onStop: () => void;
  isStreaming: boolean;
  disabled?: boolean;
  placeholder?: string;
  supportsVision?: boolean;
}

const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".svg"];

const TEXT_EXTENSIONS = [
  // Common text
  ".txt", ".md", ".markdown", ".rst", ".log",
  // Web
  ".html", ".htm", ".css", ".scss", ".sass", ".less",
  // JavaScript/TypeScript
  ".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs",
  // Data formats
  ".json", ".csv", ".xml", ".yaml", ".yml", ".toml", ".ini", ".cfg", ".conf",
  // Systems programming
  ".c", ".cpp", ".cc", ".cxx", ".h", ".hpp", ".hxx", ".rs", ".go", ".zig",
  // JVM
  ".java", ".kt", ".kts", ".scala", ".groovy", ".gradle",
  // .NET
  ".cs", ".fs", ".vb", ".csproj", ".sln",
  // Scripting
  ".py", ".rb", ".php", ".lua", ".r", ".pl", ".pm",
  // Mobile
  ".swift", ".m", ".mm", ".dart",
  // Shell
  ".sh", ".bash", ".zsh", ".fish", ".bat", ".ps1", ".psm1", ".cmd",
  // Functional
  ".hs", ".ml", ".ex", ".exs", ".erl", ".clj", ".elm", ".nim",
  // Frontend frameworks
  ".vue", ".svelte", ".astro",
  // Database
  ".sql", ".prisma", ".graphql", ".gql",
  // DevOps / Config
  ".dockerfile", ".tf", ".hcl", ".proto",
  ".env", ".env.local", ".env.example",
  ".gitignore", ".gitattributes", ".editorconfig",
  // Build
  ".cmake", ".makefile", ".mk",
];

function isImageFile(filename: string): boolean {
  const lower = filename.toLowerCase();
  return IMAGE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

function getMimeType(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".bmp")) return "image/bmp";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  return "application/octet-stream";
}

function filenameFromPath(path: string): string {
  return path.split(/[/\\]/).pop() ?? path;
}

// Build extension list without dots for the file dialog
const TEXT_FILTER_EXTS = TEXT_EXTENSIONS.map((e) => e.slice(1));
const IMAGE_FILTER_EXTS = IMAGE_EXTENSIONS.map((e) => e.slice(1));

export function MessageInput({
  onSend,
  onStop,
  isStreaming,
  disabled,
  placeholder,
  supportsVision,
}: MessageInputProps) {
  const [value, setValue] = useState("");
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const [imageWarning, setImageWarning] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    const lineHeight = 24;
    const maxHeight = lineHeight * 6;
    textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
  }, []);

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if ((!trimmed && attachments.length === 0) || isStreaming || disabled) return;
    onSend(trimmed, attachments.length > 0 ? attachments : undefined);
    setValue("");
    setAttachments([]);
    setImageWarning(false);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [value, attachments, isStreaming, disabled, onSend]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleAttach = async () => {
    const filters = [
      {
        name: "All Supported",
        extensions: [...TEXT_FILTER_EXTS, ...IMAGE_FILTER_EXTS],
      },
      { name: "Source Code & Text", extensions: TEXT_FILTER_EXTS },
      { name: "Images", extensions: IMAGE_FILTER_EXTS },
      { name: "All Files", extensions: ["*"] },
    ];

    const selected = await open({
      multiple: true,
      title: "Attach files",
      filters,
    });

    if (!selected) return;
    const paths = Array.isArray(selected) ? selected : [selected];

    let hasImage = false;

    for (const filePath of paths) {
      if (typeof filePath !== "string") continue;
      const name = filenameFromPath(filePath);

      try {
        if (isImageFile(name)) {
          hasImage = true;
          const bytes = await readFile(filePath);
          const base64 = btoa(
            Array.from(bytes)
              .map((b) => String.fromCharCode(b))
              .join(""),
          );
          setAttachments((prev) => [
            ...prev,
            { name, type: "image", content: base64, mimeType: getMimeType(name) },
          ]);
        } else {
          const text = await readTextFile(filePath);
          setAttachments((prev) => [
            ...prev,
            { name, type: "text", content: text },
          ]);
        }
      } catch (error) {
        console.error("Failed to read file:", error);
      }
    }

    // Show warning if images attached to non-vision model
    if (hasImage && !supportsVision) {
      setImageWarning(true);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => {
      const updated = prev.filter((_, i) => i !== index);
      // Clear image warning if no more images
      if (!updated.some((a) => a.type === "image")) {
        setImageWarning(false);
      }
      return updated;
    });
  };

  return (
    <div className="border-t border-border px-4 py-3">
      {/* Image compatibility warning */}
      {imageWarning && (
        <div className="mx-auto mb-2 flex max-w-3xl items-center gap-2 rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning">
          <Warning size={14} className="shrink-0" />
          Current model doesn't support images — images will be sent as filename only.
        </div>
      )}

      {/* Attachment chips */}
      {attachments.length > 0 && (
        <div className="mx-auto mb-2 flex max-w-3xl flex-wrap gap-1.5">
          {attachments.map((att, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs text-foreground"
            >
              {att.name}
              <button
                onClick={() => removeAttachment(i)}
                className="ml-0.5 rounded-full p-0.5 hover:bg-accent"
              >
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="mx-auto flex max-w-3xl items-end gap-2">
        <button
          onClick={handleAttach}
          disabled={isStreaming || disabled}
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors",
            "text-muted-foreground hover:bg-muted hover:text-foreground",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
          aria-label="Attach file"
          title="Attach files"
        >
          <Paperclip size={16} />
        </button>

        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            adjustHeight();
          }}
          onKeyDown={handleKeyDown}
          placeholder={
            placeholder ??
            (disabled ? "Load a model to start chatting..." : "Type a message...")
          }
          disabled={isStreaming || disabled}
          rows={1}
          className={cn(
            "flex-1 resize-none rounded-xl border border-border bg-muted px-4 py-3 text-sm text-foreground",
            "placeholder:text-muted-foreground",
            "focus:outline-none focus:ring-1 focus:ring-primary",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
        />

        {isStreaming ? (
          <button
            onClick={onStop}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-destructive text-white transition-colors hover:bg-destructive/80"
            aria-label="Stop generating"
          >
            <Square size={16} />
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={(!value.trim() && attachments.length === 0) || disabled}
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors",
              "bg-primary text-primary-foreground hover:bg-primary/80",
              "disabled:cursor-not-allowed disabled:opacity-50",
            )}
            aria-label="Send message"
          >
            <PaperPlaneRight size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
