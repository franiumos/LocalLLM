import { useChatStore } from "@/features/chat/stores/chat-store";

export function ContextIndicator() {
  const contextTokens = useChatStore((s) => s.contextTokens);
  const contextLimit = useChatStore((s) => s.contextLimit);

  if (contextLimit === 0) return null;

  const ratio = Math.min(contextTokens / contextLimit, 1);
  const percentage = Math.round(ratio * 100);

  const size = 28;
  const strokeWidth = 3;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const filled = circumference * ratio;

  const color =
    ratio < 0.6
      ? "var(--color-success, #22c55e)"
      : ratio < 0.85
        ? "var(--color-warning, #eab308)"
        : "var(--color-destructive, #ef4444)";

  return (
    <div
      className="flex items-center gap-1.5"
      title={`${contextTokens.toLocaleString()} / ${contextLimit.toLocaleString()} tokens`}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-border)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={circumference - filled}
          strokeLinecap="round"
          className="transition-all duration-500"
        />
      </svg>
      <span className="text-xs text-muted-foreground">{percentage}%</span>
    </div>
  );
}
