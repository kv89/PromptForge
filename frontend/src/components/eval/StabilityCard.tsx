import type { StabilityResult } from "@/types/prompt";

interface Props {
  result: StabilityResult;
}

function MiniBar({ score }: { score: number }) {
  const pct = Math.min(100, Math.max(0, score));
  const color =
    pct >= 75 ? "bg-green-500" : pct >= 50 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-24 rounded-full bg-gray-200">
        <div
          className={`h-2 rounded-full ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-gray-600 font-mono w-10">{score}</span>
    </div>
  );
}

export function StabilityCard({ result }: Props) {
  const indexColor =
    result.stability_index >= 80
      ? "text-green-600"
      : result.stability_index >= 60
      ? "text-amber-600"
      : "text-red-600";

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Stability Test · {result.runs} runs
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            v{result.version_number}
          </p>
        </div>
        <div className="text-right">
          <p className={`text-3xl font-bold ${indexColor}`}>
            {result.stability_index}
            <span className="text-base font-normal text-gray-400">/100</span>
          </p>
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              result.is_stable
                ? "bg-green-100 text-green-700"
                : "bg-red-100 text-red-700"
            }`}
          >
            {result.is_stable ? "✓ Stable" : "✗ Unstable"}
          </span>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Avg score", value: result.avg_score },
          { label: "Min score", value: result.min_score },
          { label: "Max score", value: result.max_score },
          { label: "Std dev", value: result.std_dev },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="rounded-md bg-gray-50 border border-gray-200 p-3 text-center"
          >
            <p className="text-xs text-gray-500 mb-1">{label}</p>
            <p className="text-sm font-semibold text-gray-800">{value}</p>
          </div>
        ))}
      </div>

      {/* Score distribution */}
      <div>
        <p className="text-sm font-semibold text-gray-700 mb-2">
          Score per run
        </p>
        <div className="space-y-1.5">
          {result.scores.map((score, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="text-xs text-gray-400 w-10">Run {i + 1}</span>
              <MiniBar score={score} />
            </div>
          ))}
        </div>
      </div>

      {/* Interpretation */}
      <div className="rounded-md bg-gray-50 border border-gray-200 p-3">
        <p className="text-xs font-semibold text-gray-500 mb-1">
          What this means
        </p>
        <p className="text-sm text-gray-700">
          {result.is_stable
            ? `This prompt produces consistent results (std dev ${result.std_dev} < 5.0). ` +
              `It is ready to be promoted to stable.`
            : `This prompt is inconsistent (std dev ${result.std_dev} ≥ 5.0). ` +
              `Consider making the instructions more explicit to reduce variance.`}
        </p>
      </div>
    </div>
  );
}