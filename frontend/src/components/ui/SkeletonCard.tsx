/** Pulsing placeholder that matches the dimensions of a PromptCard. */
export function SkeletonCard() {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="h-5 w-2/3 animate-pulse rounded bg-gray-200" />
        <div className="h-5 w-14 animate-pulse rounded-full bg-gray-100" />
      </div>
      <div className="h-4 w-full animate-pulse rounded bg-gray-100" />
      <div className="h-4 w-1/2 animate-pulse rounded bg-gray-100" />
      <div className="h-5 w-24 animate-pulse rounded-full bg-gray-100" />
      <div className="mt-auto flex items-center justify-between">
        <div className="h-3 w-8 animate-pulse rounded bg-gray-100" />
        <div className="h-3 w-28 animate-pulse rounded bg-gray-100" />
      </div>
    </div>
  );
}
