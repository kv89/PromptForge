import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/Badge";
import { formatDateTime } from "@/lib/format";
import type { Prompt } from "@/types/prompt";

export function PromptCard({ prompt }: { prompt: Prompt }) {
  return (
    <Link
      to={`/prompts/${prompt.id}`}
      className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-gray-900">{prompt.name}</h3>
        <Badge label={prompt.status} />
      </div>

      <p className="line-clamp-2 text-sm text-gray-500">
        {prompt.description || "No description"}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <Badge label={prompt.use_case_name} variant="blue" />
      </div>

      <div className="mt-auto flex items-center justify-between text-xs text-gray-400">
        <span>v{prompt.current_version}</span>
        <span>Updated {formatDateTime(prompt.updated_at)}</span>
      </div>
    </Link>
  );
}
