import { useState } from "react";
import type { EvalResult, Prompt } from "@/types/prompt";
import { ImprovementDrawer } from "@/components/eval/ImprovementDrawer";

interface Props {
  eval: EvalResult;
  prompt?: Prompt;
}

function ScoreBar({ score, max = 10 }: { score: number; max?: number }) {
  const pct = (score / max) * 100;
  const color =
    pct >= 75 ? "bg-green-500" : pct >= 50 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="h-2 w-full rounded-full bg-gray-200">
      <div
        className={`h-2 rounded-full ${color} transition-all`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function EvalResultCard({ eval: evalResult, prompt }: Props) {
  const [selectedImprovements, setSelectedImprovements] = useState<string[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const scoreColor =
    evalResult.overall_score >= 75
      ? "text-green-600"
      : evalResult.overall_score >= 50
      ? "text-amber-600"
      : "text-red-600";

  const toggleImprovement = (imp: string) => {
    setSelectedImprovements((prev) =>
      prev.includes(imp) ? prev.filter((i) => i !== imp) : [...prev, imp]
    );
  };

  return (
    <>
      <div className="rounded-lg border border-gray-200 bg-white p-5 space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              AI Evaluation · {evalResult.rubric_name}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              Judge: {evalResult.judge_model}
            </p>
          </div>
          <div className="text-right">
            <p className={`text-3xl font-bold ${scoreColor}`}>
              {evalResult.overall_score}
              <span className="text-base font-normal text-gray-400">/100</span>
            </p>
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                evalResult.passed
                  ? "bg-green-100 text-green-700"
                  : "bg-red-100 text-red-700"
              }`}
            >
              {evalResult.passed ? "✓ Passed" : "✗ Failed"}
            </span>
          </div>
        </div>

        {/* Criterion breakdown */}
        <div className="space-y-4">
          <p className="text-sm font-semibold text-gray-700">
            Rubric breakdown
          </p>
          {evalResult.criterion_scores.map((c) => (
            <div key={c.name} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-gray-700">{c.label}</span>
                <span className="text-gray-500">
                  {c.score}/10
                  <span className="text-gray-400 text-xs ml-1">
                    · {Math.round(c.weight * 100)}%
                  </span>
                </span>
              </div>
              <ScoreBar score={c.score} />
              <p className="text-xs text-gray-500">{c.rationale}</p>
              {c.suggestions.length > 0 && (
                <ul className="mt-1 space-y-0.5">
                  {c.suggestions.map((s, i) => (
                    <li key={i} className="text-xs text-gray-400 flex gap-1">
                      <span>→</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="rounded-md bg-gray-50 border border-gray-200 p-3">
          <p className="text-xs font-semibold text-gray-500 mb-1">
            Judge summary
          </p>
          <p className="text-sm text-gray-700 leading-relaxed">
            {evalResult.summary}
          </p>
        </div>

        {/* Top improvements with checkboxes */}
        {evalResult.top_improvements.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-gray-700">
                Top improvements
              </p>
              <p className="text-xs text-gray-400">
                Select to apply
              </p>
            </div>
            <ol className="space-y-2">
              {evalResult.top_improvements.map((tip, i) => (
                <li
                  key={i}
                  onClick={() => toggleImprovement(tip)}
                  className={`flex gap-3 text-sm cursor-pointer rounded-md px-2 py-1.5 transition-colors ${
                    selectedImprovements.includes(tip)
                      ? "bg-brand-50 border border-brand-200"
                      : "hover:bg-gray-50 border border-transparent"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedImprovements.includes(tip)}
                    onChange={() => toggleImprovement(tip)}
                    onClick={(e) => e.stopPropagation()}
                    className="mt-0.5 accent-brand-500 flex-shrink-0"
                  />
                  <span className="text-gray-700">{tip}</span>
                </li>
              ))}
            </ol>

            {/* Apply button */}
            {selectedImprovements.length > 0 && prompt && (
              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                className="mt-3 w-full rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-900"
              >
                ✨ Apply {selectedImprovements.length} selected improvement
                {selectedImprovements.length !== 1 ? "s" : ""}
              </button>
            )}

            {selectedImprovements.length > 0 && !prompt && (
              <p className="mt-2 text-xs text-gray-400 text-center">
                Open from a prompt page to apply improvements
              </p>
            )}
          </div>
        )}
      </div>

      {/* Improvement drawer */}
      {prompt && (
        <ImprovementDrawer
          isOpen={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          prompt={prompt}
          evalResult={evalResult}
          selectedImprovements={selectedImprovements}
        />
      )}
    </>
  );
}