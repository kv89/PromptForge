import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useCreateRubric } from "@/hooks/useEvals";
import { useUseCaseList } from "@/hooks/usePrompts";
import type { RubricCriterion } from "@/types/prompt";

const DEFAULT_CRITERIA: RubricCriterion[] = [
  { name: "relevance", label: "Relevance", description: "The output directly addresses what the prompt asked for.", weight: 0.25 },
  { name: "accuracy", label: "Accuracy", description: "Facts and technical details are correct.", weight: 0.25 },
  { name: "completeness", label: "Completeness", description: "All parts of the request are covered.", weight: 0.20 },
  { name: "clarity", label: "Clarity", description: "The output is clear and well structured.", weight: 0.15 },
  { name: "format", label: "Format", description: "The output follows the format requested.", weight: 0.15 },
];

function weightTotal(criteria: RubricCriterion[]): number {
  return Math.round(criteria.reduce((s, c) => s + c.weight, 0) * 100) / 100;
}

export function RubricBuilderPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedUseCaseId = searchParams.get("use_case_id") ?? undefined;

  const useCasesQuery = useUseCaseList();
  const createRubric = useCreateRubric();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [useCaseId, setUseCaseId] = useState(preselectedUseCaseId ?? "");
  const [criteria, setCriteria] = useState<RubricCriterion[]>(DEFAULT_CRITERIA);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const total = weightTotal(criteria);
  const weightOk = total >= 0.99 && total <= 1.01;

  const updateCriterion = (
    index: number,
    field: keyof RubricCriterion,
    value: string | number
  ) => {
    setCriteria((prev) =>
      prev.map((c, i) =>
        i === index ? { ...c, [field]: value } : c
      )
    );
  };

  const addCriterion = () => {
    setCriteria((prev) => [
      ...prev,
      { name: "", label: "", description: "", weight: 0 },
    ]);
  };

  const removeCriterion = (index: number) => {
    setCriteria((prev) => prev.filter((_, i) => i !== index));
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "Name is required";
    if (criteria.length === 0) e.criteria = "At least one criterion is required";
    criteria.forEach((c, i) => {
      if (!c.name.trim()) e[`cname_${i}`] = "Required";
      if (!c.label.trim()) e[`clabel_${i}`] = "Required";
      if (c.weight <= 0) e[`cweight_${i}`] = "Must be > 0";
    });
    if (!weightOk) e.weight = `Weights must sum to 1.0 (currently ${total})`;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    createRubric.mutate(
      {
        name,
        description,
        use_case_id: useCaseId || undefined,
        criteria,
      },
      { onSuccess: () => navigate("/rubrics") }
    );
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Create Rubric</h2>
        <p className="text-gray-500 text-sm mt-1">
          Define custom scoring criteria for evaluating prompt outputs.
        </p>
      </div>

      {/* Basic info */}
      <div className="rounded-lg border border-gray-200 bg-white p-5 space-y-4">
        <h3 className="font-semibold text-gray-700">Basic Information</h3>

        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">
            Rubric name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. TF Code Quality Rubric"
            className={`w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 ${
              errors.name ? "border-red-400" : "border-gray-300"
            }`}
          />
          {errors.name && (
            <p className="text-xs text-red-500 mt-1">{errors.name}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What is this rubric for?"
            rows={2}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">
            Use case (optional)
          </label>
          <select
            value={useCaseId}
            onChange={(e) => setUseCaseId(e.target.value)}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">All use cases (generic rubric)</option>
            {useCasesQuery.data?.map((uc) => (
              <option key={uc.id} value={uc.id}>
                {uc.name}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-400 mt-1">
            If set, this rubric auto-applies to all prompts in that use case.
          </p>
        </div>
      </div>

      {/* Criteria */}
      <div className="rounded-lg border border-gray-200 bg-white p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-700">Scoring Criteria</h3>
          <div className="flex items-center gap-3">
            <span
              className={`text-sm font-mono font-medium ${
                weightOk ? "text-green-600" : "text-red-500"
              }`}
            >
              Total weight: {total}
              {weightOk ? " ✓" : " (must = 1.0)"}
            </span>
            <button
              type="button"
              onClick={addCriterion}
              className="rounded-md bg-brand-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-900"
            >
              + Add criterion
            </button>
          </div>
        </div>

        {errors.criteria && (
          <p className="text-xs text-red-500">{errors.criteria}</p>
        )}
        {errors.weight && (
          <p className="text-xs text-red-500">{errors.weight}</p>
        )}

        <div className="space-y-4">
          {criteria.map((c, i) => (
            <div
              key={i}
              className="rounded-md border border-gray-200 p-4 space-y-3 bg-gray-50"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500 uppercase">
                  Criterion {i + 1}
                </span>
                {criteria.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeCriterion(i)}
                    className="text-xs text-red-400 hover:text-red-600"
                  >
                    Remove
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Name (slug) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={c.name}
                    onChange={(e) =>
                      updateCriterion(
                        i,
                        "name",
                        e.target.value.toLowerCase().replace(/\s+/g, "_")
                      )
                    }
                    placeholder="e.g. valid_syntax"
                    className={`w-full rounded-md border px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 ${
                      errors[`cname_${i}`] ? "border-red-400" : "border-gray-300"
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Label <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={c.label}
                    onChange={(e) => updateCriterion(i, "label", e.target.value)}
                    placeholder="e.g. Valid Syntax"
                    className={`w-full rounded-md border px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 ${
                      errors[`clabel_${i}`] ? "border-red-400" : "border-gray-300"
                    }`}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Description — what the judge checks
                </label>
                <input
                  type="text"
                  value={c.description}
                  onChange={(e) =>
                    updateCriterion(i, "description", e.target.value)
                  }
                  placeholder="e.g. The output is syntactically valid HCL"
                  className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Weight (0.0 – 1.0) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min={0}
                  max={1}
                  step={0.05}
                  value={c.weight}
                  onChange={(e) =>
                    updateCriterion(i, "weight", parseFloat(e.target.value) || 0)
                  }
                  className={`w-32 rounded-md border px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 ${
                    errors[`cweight_${i}`] ? "border-red-400" : "border-gray-300"
                  }`}
                />
                <span className="text-xs text-gray-400 ml-2">
                  = {Math.round(c.weight * 100)}% of overall score
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Submit */}
      <div className="flex gap-3 justify-end">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={createRubric.isPending}
          className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-900 disabled:opacity-50"
        >
          {createRubric.isPending ? "Creating…" : "Create Rubric"}
        </button>
      </div>
    </div>
  );
}