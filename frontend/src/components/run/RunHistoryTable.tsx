import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { RunResultCard } from "./RunResultCard";
import { usePromptRuns, useRun } from "@/hooks/useRuns";
import { formatDateTime } from "@/lib/format";

interface ExpandedRowProps {
  runId: string;
}

function ExpandedRow({ runId }: ExpandedRowProps) {
  const { data: run, isLoading } = useRun(runId);
  if (isLoading) {
    return (
      <div className="flex justify-center py-4">
        <Spinner />
      </div>
    );
  }
  if (!run) return null;
  return (
    <div className="px-4 pb-4">
      <RunResultCard run={run} evalResult={(run as any).eval_result ?? null} />
    </div>
  );
}

interface Props {
  promptId: string;
}

export function RunHistoryTable({ promptId }: Props) {
  const { data: runs, isLoading } = usePromptRuns(promptId);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const statusVariant = (status: string) => {
    if (status === "COMPLETED") return "green";
    if (status === "FAILED") return "red";
    return "amber";
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-12 rounded-lg bg-gray-100 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!runs || runs.length === 0) {
    return (
      <EmptyState
        title="No runs yet"
        description="Run this prompt to see results here"
      />
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            {["#", "Version", "Model", "Status", "Tokens", "Latency", "Score", "Date"].map(
              (h) => (
                <th
                  key={h}
                  className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide"
                >
                  {h}
                </th>
              )
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {runs.map((run, idx) => (
            <>
              <tr
                key={run.id}
                onClick={() =>
                  setExpandedId(expandedId === run.id ? null : run.id)
                }
                className="cursor-pointer hover:bg-gray-50 transition-colors"
              >
                <td className="px-4 py-3 text-gray-400">{idx + 1}</td>
                <td className="px-4 py-3 font-medium">v{run.version_number}</td>
                <td className="px-4 py-3 text-gray-500 font-mono text-xs">
                  {run.model}
                </td>
                <td className="px-4 py-3">
                  <Badge label={run.status} variant={statusVariant(run.status)} />
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {run.total_tokens.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {Math.round(run.latency_ms)}ms
                </td>
                <td className="px-4 py-3 text-gray-400">
                  {run.overall_score != null ? run.overall_score : "—"}
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs">
                  {formatDateTime(run.created_at)}
                </td>
              </tr>
              {expandedId === run.id && (
                <tr key={`${run.id}-expanded`}>
                  <td colSpan={8} className="bg-gray-50">
                    <ExpandedRow runId={run.id} />
                  </td>
                </tr>
              )}
            </>
          ))}
        </tbody>
      </table>
    </div>
  );
}