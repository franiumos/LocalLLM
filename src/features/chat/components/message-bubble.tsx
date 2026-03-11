import { useState } from "react";
import { Copy, Check, FileText, Image } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/features/chat/types/chat";
import Markdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import { StreamingIndicator } from "@/features/chat/components/streaming-indicator";

interface MessageBubbleProps {
  message: ChatMessage;
  isStreaming?: boolean;
}

export function MessageBubble({ message, isStreaming }: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";
  const isAssistant = message.role === "assistant";

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={cn(
        "group flex w-full",
        isUser ? "justify-end" : "justify-start",
      )}
    >
      <div
        className={cn(
          "relative max-w-[75%] px-4 py-3",
          isUser
            ? "rounded-2xl bg-primary text-primary-foreground"
            : "rounded-2xl bg-muted text-foreground",
        )}
      >
        <div className="mb-1 text-[10px] font-medium uppercase tracking-wider opacity-50">
          {isUser ? "You" : "Assistant"}
        </div>

        {/* Attachments */}
        {isUser && message.attachments && message.attachments.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {message.attachments.map((att, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 rounded-md bg-primary-foreground/20 px-2 py-0.5 text-[10px]"
              >
                {att.type === "image" ? (
                  <Image size={10} />
                ) : (
                  <FileText size={10} />
                )}
                {att.name}
              </span>
            ))}
          </div>
        )}

        {isAssistant ? (
          <div className="prose prose-invert max-w-none overflow-hidden text-sm leading-relaxed [&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-background [&_pre]:p-3 [&_code]:rounded [&_code]:bg-background [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-xs">
            {message.content ? (
              <Markdown rehypePlugins={[rehypeHighlight]}>
                {message.content}
              </Markdown>
            ) : isStreaming ? (
              <StreamingIndicator />
            ) : null}
          </div>
        ) : (
          <p className="whitespace-pre-wrap text-sm leading-relaxed">
            {message.content}
          </p>
        )}

        {isAssistant && message.content && (
          <button
            onClick={handleCopy}
            className="absolute -bottom-3 right-2 rounded-md bg-border p-1 opacity-0 transition-opacity group-hover:opacity-100"
            aria-label="Copy message"
          >
            {copied ? (
              <Check size={12} className="text-success" />
            ) : (
              <Copy size={12} className="text-muted-foreground" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}
