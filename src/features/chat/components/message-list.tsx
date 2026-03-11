import { useEffect, useRef } from "react";
import type { ChatMessage } from "@/features/chat/types/chat";
import { MessageBubble } from "@/features/chat/components/message-bubble";
import {
  ToolCallBubble,
  ToolResultBubble,
} from "@/features/code/components/tool-call-bubble";

interface MessageListProps {
  messages: ChatMessage[];
  isStreaming: boolean;
}

export function MessageList({ messages, isStreaming }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        {messages.map((message, index) => {
          // Tool call message (assistant with toolCalls)
          if (message.role === "assistant" && message.toolCalls && message.toolCalls.length > 0) {
            return <ToolCallBubble key={message.id} message={message} />;
          }

          // Tool result message
          if (message.role === "tool" && message.toolResult) {
            return <ToolResultBubble key={message.id} message={message} />;
          }

          // Regular user/assistant message
          return (
            <MessageBubble
              key={message.id}
              message={message}
              isStreaming={
                isStreaming &&
                index === messages.length - 1 &&
                message.role === "assistant"
              }
            />
          );
        })}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
