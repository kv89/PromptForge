interface EmptyStateProps {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-gray-300 bg-white py-16 text-center">
      <p className="text-base font-medium text-gray-900">{title}</p>
      {description ? (
        <p className="max-w-sm text-sm text-gray-500">{description}</p>
      ) : null}
      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="mt-1 rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-900"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
