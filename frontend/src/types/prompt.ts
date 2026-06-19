/**
 * TypeScript interfaces mirroring the backend Pydantic models.
 *
 * Note: use cases are dynamic, user-defined documents fetched from the API
 * (`GET /use-cases`) — there is intentionally NO hardcoded use case enum. Any
 * component needing a use case picker must load the options from the API.
 */

export enum PromptStatus {
  DRAFT = "DRAFT",
  ACTIVE = "ACTIVE",
  ARCHIVED = "ARCHIVED",
  DEPRECATED = "DEPRECATED",
}

export interface PromptVariable {
  name: string;
  description: string;
  example_value: string;
  required: boolean;
}

export interface PromptVersion {
  version_number: number;
  content: string;
  variables: PromptVariable[];
  created_at: string;
  created_by: string;
  change_note: string | null;
  is_stable: boolean;
  tags: string[];
}

export interface Prompt {
  id: string | null;
  name: string;
  description: string;
  use_case_id: string;
  use_case_slug: string;
  use_case_name: string;
  status: PromptStatus;
  current_version: number;
  versions: PromptVersion[];
  owner_uid: string;
  owner_email: string;
  created_at: string;
  updated_at: string;
}

export interface PromptCreate {
  name: string;
  description: string;
  use_case_id: string;
  initial_content: string;
  variables?: PromptVariable[];
  tags?: string[];
}

export interface PromptUpdate {
  content: string;
  variables?: PromptVariable[];
  change_note: string | null;
  tags?: string[];
}

export interface UseCase {
  id: string | null;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  created_by: string;
  created_at: string;
  prompt_count: number;
}

export interface UseCaseCreate {
  name: string;
  description: string | null;
  icon: string | null;
}

export interface UseCaseResponse extends UseCase {
  id: string;
}

// ── Run types ────────────────────────────────────────────────────────────────

export type RunStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";

export interface RunRequest {
  prompt_id: string;
  version_number: number;
  variables: Record<string, string>;
  temperature?: number;
  max_tokens?: number;
  model?: string;
}

export interface Run {
  id: string;
  prompt_id: string;
  prompt_name: string;
  version_number: number;
  rendered_prompt: string;
  variables: Record<string, string>;
  model: string;
  temperature: number;
  max_tokens: number;
  status: RunStatus;
  output: string | null;
  error: string | null;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  latency_ms: number;
  created_at: string;
  completed_at: string | null;
  owner_uid: string;
  overall_score: number | null;
}

export interface RunSummary {
  id: string;
  prompt_id: string;
  prompt_name: string;
  version_number: number;
  model: string;
  status: RunStatus;
  overall_score: number | null;
  latency_ms: number;
  total_tokens: number;
  created_at: string;
}

// ── Eval types ───────────────────────────────────────────────────────────────

export interface RubricCriterion {
  name: string;
  label: string;
  description: string;
  weight: number;
}

export interface Rubric {
  id: string;
  name: string;
  description: string;
  use_case_id: string | null;
  criteria: RubricCriterion[];
  created_by: string;
  created_at: string;
  is_default: boolean;
}

export interface RubricCreate {
  name: string;
  description?: string;
  use_case_id?: string;
  criteria: RubricCriterion[];
}

export interface CriterionScore {
  name: string;
  label: string;
  score: number;
  weight: number;
  weighted_score: number;
  rationale: string;
  suggestions: string[];
}

export interface EvalResult {
  id: string;
  run_id: string;
  prompt_id: string;
  version_number: number;
  rubric_id: string;
  rubric_name: string;
  judge_model: string;
  overall_score: number;
  passed: boolean;
  pass_threshold: number;
  criterion_scores: CriterionScore[];
  summary: string;
  top_improvements: string[];
  latency_ms: number;
  created_at: string;
  owner_uid: string;
}

export interface RunWithEval extends Run {
  eval_result: EvalResult | null;
}

export interface StabilityResult {
  prompt_id: string;
  version_number: number;
  runs: number;
  scores: number[];
  avg_score: number;
  std_dev: number;
  stability_index: number;
  min_score: number;
  max_score: number;
  is_stable: boolean;
  run_ids: string[];
}

export interface ImprovePromptRequest {
  prompt_id: string;
  version_number: number;
  selected_improvements: string[];
  mode: "surgical" | "holistic";
}

export interface ImprovePromptResponse {
  rewritten_prompt: string;
  mode: string;
}