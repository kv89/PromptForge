import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { EvalResultCard } from "@/components/eval/EvalResultCard";
import type { EvalResult, Run, Prompt } from "@/types/prompt";


interface Props {
  run: Run;
  evalResult?: EvalResult | null;
  onEvaluate?: () => void;
  isEvaluating?: boolean;
  prompt?: Prompt;
}

export function RunResultCard({
  run,
  evalResult,
  onEvaluate,
  isEvaluating,
  prompt,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [showRendered, setShowRendered] = useState(false);
  const [showEval, setShowEval] = useState(true);

  const handleCopy = () => {
    if (!run.output) return;
    navigator.clipboard.writeText(run.output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const statusVariant =
    run.status === "COMPLETED"
      ? "green"
      : run.status === "FAILED"
      ? "red"
      : "amber";

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-4">

        {/* Header row */}
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Badge label={run.status} variant={statusVariant} />
          <Badge label={`v${run.version_number}`} variant="blue" />
          <span className="text-gray-500">{run.model}</span>
          <span className="text-gray-400">·</span>
          <span className="text-gray-500">
            {Math.round(run.latency_ms)}ms
          </span>
          <span className="text-gray-400">·</span>
          <span className="text-gray-500">
            {run.total_tokens} tokens
            <span className="text-gray-400 text-xs ml-1">
              ({run.prompt_tokens} in / {run.completion_tokens} out)
            </span>
          </span>
          {run.overall_score != null && (
            <>
              <span className="text-gray-400">·</span>
              <span
                className={`font-semibold text-sm ${
                  run.overall_score >= 75
                    ? "text-green-600"
                    : run.overall_score >= 50
                    ? "text-amber-600"
                    : "text-red-600"
                }`}
              >
                Score: {run.overall_score}/100
              </span>
            </>
          )}
        </div>

        {/* Error state */}
        {run.status === "FAILED" && run.error && (
          <div className="rounded-md bg-red-50 border border-red-200 p-3">
            <p className="text-sm text-red-700 font-medium">Run failed</p>
            <p className="text-sm text-red-600 mt-1">{run.error}</p>
          </div>
        )}

        {/* Output */}
        {run.status === "COMPLETED" && run.output && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Output
              </span>
              <button
                type="button"
                onClick={handleCopy}
                className="text-xs text-brand-500 hover:text-brand-900 transition-colors"
              >
                {copied ? "✓ Copied!" : "Copy output"}
              </button>
            </div>
            <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg border border-gray-200 bg-gray-900 p-4 font-mono text-sm text-gray-100 max-h-96">
              {run.output}
            </pre>
          </div>
        )}

        {/* Rendered prompt toggle */}
        <div>
          <button
            type="button"
            onClick={() => setShowRendered((v) => !v)}
            className="text-xs text-gray-400 hover:text-gray-600 underline"
          >
            {showRendered ? "Hide rendered prompt" : "View rendered prompt"}
          </button>
          {showRendered && (
            <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-lg border border-gray-200 bg-gray-50 p-3 font-mono text-xs text-gray-700 max-h-48">
              {run.rendered_prompt}
            </pre>
          )}
        </div>

        {/* Manual evaluate button — shown when no eval result yet */}
        {run.status === "COMPLETED" && !evalResult && onEvaluate && (
          <button
            type="button"
            onClick={onEvaluate}
            disabled={isEvaluating}
            className="text-xs text-brand-500 hover:text-brand-900 underline disabled:opacity-50"
          >
            {isEvaluating ? "Evaluating…" : "▶ Evaluate this run"}
          </button>
        )}
      </div>

      {/* Eval result */}
      {evalResult && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setShowEval((v) => !v)}
              className="text-xs text-gray-400 hover:text-gray-600 underline"
            >
              {showEval ? "Hide evaluation" : "Show evaluation"}
            </button>
          </div>
          {showEval && <EvalResultCard eval={evalResult} prompt={prompt} />}
        </div>
      )}
    </div>
  );
}