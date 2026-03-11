import type { AppMode } from "@/lib/types";

export interface ToolCall {
  id: string;
  name: string;
  arguments: string;
}

export interface ToolResult {
  toolCallId: string;
  name: string;
  content: string;
  isError?: boolean;
}

export interface FileAttachment {
  name: string;
  type: "text" | "image";
  content: string;
  mimeType?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  createdAt: Date;
  toolCalls?: ToolCall[];
  toolResult?: ToolResult;
  attachments?: FileAttachment[];
  imageUrl?: string;
}

export interface Conversation {
  id: string;
  title: string;
  modelId: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
  mode: AppMode;
  workingDirectory?: string;
}
