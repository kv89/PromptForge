import { PromptStatus } from "@/types/prompt";

export type BadgeVariant = "blue" | "green" | "amber" | "red" | "gray";

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
}

const VARIANT_STYLES: Record<BadgeVariant, string> = {
  blue: "bg-brand-50 text-brand-900",
  green: "bg-green-100 text-green-700",
  amber: "bg-amber-100 text-amber-700",
  red: "bg-red-100 text-red-700",
  gray: "bg-gray-100 text-gray-700",
};

const STATUS_VARIANTS: Record<PromptStatus, BadgeVariant> = {
  [PromptStatus.DRAFT]: "gray",
  [PromptStatus.ACTIVE]: "green",
  [PromptStatus.ARCHIVED]: "amber",
  [PromptStatus.DEPRECATED]: "red",
};

/**
 * Picks a sensible variant when one is not supplied: known PromptStatus values
 * map to status colors, and anything else (e.g. a use case name) defaults to
 * the brand "blue" treatment.
 */
function resolveVariant(label: string): BadgeVariant {
  return STATUS_VARIANTS[label as PromptStatus] ?? "blue";
}

export function Badge({ label, variant }: BadgeProps) {
  const resolved = variant ?? resolveVariant(label);
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${VARIANT_STYLES[resolved]}`}
    >
      {label}
    </span>
  );
}
