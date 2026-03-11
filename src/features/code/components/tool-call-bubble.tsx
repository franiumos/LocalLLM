import { useState } from "react";
import type { ComponentType } from "react";
import {
  FileText,
  FolderOpen,
  Terminal,
  PencilSimple,
  CaretDown,
  CaretRight,
  Check,
  X,
} from "@phosphor-icons/react";
import type { IconProps } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/features/chat/types/chat";

const TOOL_ICONS: Record<string, ComponentType<IconProps>> = {
  read_file: FileText,
  write_file: PencilSimple,
  list_directory: FolderOpen,
  run_command: Terminal,
};

const TOOL_LABELS: Record<string, string> = {
  read_file: "Reading file",
  write_file: "Writing file",
  list_directory: "Listing directory",
  run_command: "Running command",
};

function getToolSummary(name: string, args: string): string {
  try {
    const parsed = JSON.parse(args);
    if (name === "read_file" || name === "write_file") return parsed.path ?? "";
    if (name === "list_directory") return parsed.path ?? ".";
    if (name === "run_command") return parsed.command ?? "";
  } catch {
    // ignore
  }
  return "";
}

export function ToolCallBubble({ message }: { message: ChatMessage }) {
  const [expanded, setExpanded] = useState(false);

  if (!message.toolCalls || message.toolCalls.length === 0) return null;

  return (
    <div className="flex w-full justify-start">
      <div className="max-w-[75%] space-y-1">
        {message.toolCalls.map((tc) => {
          const Icon = TOOL_ICONS[tc.name] ?? Terminal;
          const label = TOOL_LABELS[tc.name] ?? tc.name;
          const summary = getToolSummary(tc.name, tc.arguments);

          return (
            <div
              key={tc.id}
              className="rounded-lg border border-border bg-muted/50 px-3 py-2 text-xs"
            >
              <button
                onClick={() => setExpanded(!expanded)}
                className="flex w-full items-center gap-2 text-left"
              >
                <Icon size={14} className="shrink-0 text-primary" />
                <span className="font-medium text-foreground">{label}</span>
                <span className="truncate text-muted-foreground">
                  {summary}
                </span>
                <span className="ml-auto shrink-0">
                  {expanded ? (
                    <CaretDown size={12} className="text-muted-foreground" />
                  ) : (
                    <CaretRight size={12} className="text-muted-foreground" />
                  )}
                </span>
              </button>
              {expanded && (
                <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded bg-background p-2 text-[11px] text-muted-foreground">
                  {tc.arguments}
                </pre>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ToolResultBubble({ message }: { message: ChatMessage }) {
  const [expanded, setExpanded] = useState(false);

  if (!message.toolResult) return null;

  const { name, content, isError } = message.toolResult;
  const Icon = TOOL_ICONS[name] ?? Terminal;

  return (
    <div className="flex w-full justify-start">
      <div className="max-w-[75%]">
        <div
          className={cn(
            "rounded-lg border px-3 py-2 text-xs",
            isError
              ? "border-destructive/30 bg-destructive/5"
              : "border-success/30 bg-success/5",
          )}
        >
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex w-full items-center gap-2 text-left"
          >
            {isError ? (
              <X size={14} className="shrink-0 text-destructive" />
            ) : (
              <Check size={14} className="shrink-0 text-success" />
            )}
            <Icon size={12} className="shrink-0 text-muted-foreground" />
            <span className="font-medium text-foreground">
              {isError ? "Failed" : "Done"}
            </span>
            <span className="truncate text-muted-foreground">{name}</span>
            <span className="ml-auto shrink-0">
              {expanded ? (
                <CaretDown size={12} className="text-muted-foreground" />
              ) : (
                <CaretRight size={12} className="text-muted-foreground" />
              )}
            </span>
          </button>
          {expanded && (
            <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded bg-background p-2 text-[11px] text-muted-foreground">
              {content}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
