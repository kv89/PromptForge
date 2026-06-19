import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { PromptCard } from "@/components/PromptCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { SkeletonCard } from "@/components/ui/SkeletonCard";
import { usePromptList, useUseCaseList } from "@/hooks/usePrompts";
import { PromptStatus } from "@/types/prompt";

export function PromptsListPage() {
  const navigate = useNavigate();
  const [useCaseSlug, setUseCaseSlug] = useState("");
  const [status, setStatus] = useState("");

  const useCasesQuery = useUseCaseList();
  const promptsQuery = usePromptList({
    use_case: useCaseSlug || undefined,
    status: status || undefined,
  });

  const prompts = promptsQuery.data ?? [];

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold text-gray-900">Prompt Library</h2>
        <Link
          to="/prompts/new"
          className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-900"
        >
          New Prompt
        </Link>
      </div>

      <div className="mb-6 flex flex-wrap gap-3">
        <select
          value={useCaseSlug}
          onChange={(e) => setUseCaseSlug(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">All use cases</option>
          {useCasesQuery.data?.map((uc) => (
            <option key={uc.id} value={uc.slug}>
              {uc.name}
            </option>
          ))}
        </select>

        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">All statuses</option>
          {Object.values(PromptStatus).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {promptsQuery.isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : promptsQuery.isError ? (
        <ErrorBanner message="Failed to load prompts. Please try again." />
      ) : prompts.length === 0 ? (
        <EmptyState
          title="No prompts yet."
          description="Create your first prompt to start building and versioning."
          actionLabel="Create your first prompt"
          onAction={() => navigate("/prompts/new")}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {prompts.map((prompt) => (
            <PromptCard key={prompt.id} prompt={prompt} />
          ))}
        </div>
      )}
    </div>
  );
}
