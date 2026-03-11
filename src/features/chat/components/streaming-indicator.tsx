export function StreamingIndicator() {
  return (
    <div className="flex items-center gap-1 px-1 py-2">
      <div className="h-2 w-2 animate-pulse rounded-full bg-primary [animation-delay:0ms]" />
      <div className="h-2 w-2 animate-pulse rounded-full bg-primary [animation-delay:150ms]" />
      <div className="h-2 w-2 animate-pulse rounded-full bg-primary [animation-delay:300ms]" />
    </div>
  );
}
