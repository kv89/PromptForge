import { Link } from "react-router-dom";
import { useRubrics } from "@/hooks/useEvals";
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDateTime } from "@/lib/format";

export function RubricsListPage() {
  const { data: rubrics, isLoading } = useRubrics();

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Rubrics</h2>
          <p className="text-gray-500 text-sm mt-1">
            Scoring criteria used to evaluate prompt outputs.
          </p>
        </div>
        <Link
          to="/rubrics/new"
          className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-900"
        >
          + New Rubric
        </Link>
      </div>

      {!rubrics || rubrics.length === 0 ? (
        <EmptyState
          title="No rubrics yet"
          description="Create a rubric to define custom scoring criteria"
          actionLabel="Create rubric"
          onAction={() => window.location.assign("/rubrics/new")}
        />
      ) : (
        <div className="space-y-3">
          {rubrics.map((rubric) => (
            <div
              key={rubric.id}
              className="rounded-lg border border-gray-200 bg-white p-4 space-y-2"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-gray-900">{rubric.name}</p>
                    {rubric.is_default && (
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                        default
                      </span>
                    )}
                  </div>
                  {rubric.description && (
                    <p className="text-sm text-gray-500 mt-0.5">
                      {rubric.description}
                    </p>
                  )}
                </div>
                <span className="text-xs text-gray-400 flex-shrink-0">
                  {rubric.is_default
                    ? "built-in"
                    : formatDateTime(rubric.created_at)}
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                {rubric.criteria.map((c) => (
                  <span
                    key={c.name}
                    className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-md"
                  >
                    {c.label}{" "}
                    <span className="text-gray-400">
                      {Math.round(c.weight * 100)}%
                    </span>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}