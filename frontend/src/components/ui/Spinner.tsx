interface SpinnerProps {
  /** Tailwind sizing/spacing classes for the spinner element (default h-8 w-8). */
  className?: string;
}

/** A simple, centered loading spinner. */
export function Spinner({ className = "h-8 w-8" }: SpinnerProps) {
  return (
    <div className="flex items-center justify-center">
      <div
        className={`animate-spin rounded-full border-2 border-brand-500 border-t-transparent ${className}`}
        role="status"
        aria-label="Loading"
      />
    </div>
  );
}
