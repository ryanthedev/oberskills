/**
 * All data formats for the skill-eval server as TypeScript types + zod schemas.
 *
 * This file is the single normative home of the eval/grading/benchmark formats
 * (it replaces the former skills/skill-craft/references/schemas.md). Field names
 * are preserved from the Python pipeline where the formats were sound; deliberate
 * breaks are commented inline.
 *
 * Every type that is read from disk has a zod schema — workspace files are never
 * trusted without runtime validation.
 *
 * NOTE (MCP SDK gotcha): named types used as `structuredContent` must be `type`
 * aliases, not `interface` — interfaces lack implicit index signatures.
 */
import { z } from "zod";

// ---------------------------------------------------------------------------
// Pressure blocks + rationalization patterns (data files in mcp/data/)
// ---------------------------------------------------------------------------

export const PressureBlockIdSchema = z.enum([
  "TIME",
  "SUNK_COST",
  "AUTHORITY",
  "ECONOMIC",
  "SOCIAL",
  "SIMPLICITY",
  "EXHAUSTION",
]);
export type PressureBlockId = z.infer<typeof PressureBlockIdSchema>;

export const PressureBlocksFileSchema = z.object({
  compose_rule: z.string(),
  blocks: z.array(z.object({ id: PressureBlockIdSchema, language: z.string() })),
});
export type PressureBlocksFile = z.infer<typeof PressureBlocksFileSchema>;

export const SeveritySchema = z.enum(["Critical", "High", "Medium"]);
export type Severity = z.infer<typeof SeveritySchema>;

export const PatternIdSchema = z.enum([
  "step_skipping_justification",
  "authority_capitulation",
  "scope_reduction_without_asking",
  "sunk_cost_reasoning",
  "process_substitution",
  "exhaustion_compliance",
  "simplicity_rationalization",
]);
export type PatternId = z.infer<typeof PatternIdSchema>;

export const RationalizationPatternsFileSchema = z.object({
  patterns: z.array(
    z.object({
      id: PatternIdSchema,
      severity: SeveritySchema,
      description: z.string(),
      example: z.string(),
    }),
  ),
});
export type RationalizationPatternsFile = z.infer<typeof RationalizationPatternsFileSchema>;

// ---------------------------------------------------------------------------
// Programmatic checks — the judge-free deterministic floor (trace / artifact /
// invariant levels). Evaluated in TypeScript, never by a model.
// ---------------------------------------------------------------------------

export const ProgrammaticCheckSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("artifact_exists"),
    path: z.string().describe("File path relative to the run directory, e.g. outputs/report.md."),
  }),
  z.object({
    kind: z.literal("artifact_matches"),
    path: z.string().describe("File path relative to the run directory."),
    pattern: z.string().describe("RegExp source tested against the file contents (multiline)."),
  }),
  z.object({
    kind: z.literal("trace_includes"),
    tool: z.string().describe("Tool name that must appear as a tool_use in the transcript."),
    input_pattern: z
      .string()
      .optional()
      .describe("Optional RegExp source tested against the JSON-serialized tool input."),
  }),
  z.object({
    kind: z.literal("trace_order"),
    tools: z
      .array(z.string())
      .min(2)
      .describe("Tool names that must appear as a subsequence, in this order."),
  }),
  z.object({
    kind: z.literal("trace_never"),
    tool: z.string().optional().describe("Tool name that must never appear as a tool_use."),
    input_pattern: z
      .string()
      .optional()
      .describe("Optional RegExp source; a tool_use whose serialized input matches fails the check."),
  }),
]);
export type ProgrammaticCheck = z.infer<typeof ProgrammaticCheckSchema>;

// ---------------------------------------------------------------------------
// Evals (evals.json — house schema; the official Anthropic shape is normalized
// into this by the run_eval loader)
// ---------------------------------------------------------------------------

export const EvalDefSchema = z.object({
  id: z.string(),
  prompt: z.string().describe("Base prompt WITHOUT pressure text — the runner composes pressure."),
  expected_output: z.string().optional(),
  files: z.array(z.string()).default([]),
  expectations: z.array(z.string()).default([]),
  checks: z.array(ProgrammaticCheckSchema).optional(),
  pressure_blocks: z
    .array(PressureBlockIdSchema)
    .optional()
    .describe("Pressure-block ids; the runner composes prompt text and enforces length >= 3."),
});
export type EvalDef = z.infer<typeof EvalDefSchema>;

export const EvalsFileSchema = z.object({
  skill_name: z.string(),
  evals: z.array(EvalDefSchema),
});
export type EvalsFile = z.infer<typeof EvalsFileSchema>;

/** Official Anthropic eval shape ({skills, query, files, expected_behavior}) — accepted and normalized. */
export const OfficialEvalSchema = z.object({
  skills: z.array(z.string()).optional(),
  query: z.string(),
  files: z.array(z.string()).optional(),
  expected_behavior: z.array(z.string()).optional(),
});

// ---------------------------------------------------------------------------
// Grading
// ---------------------------------------------------------------------------

export const ExpectationSchema = z.object({
  text: z.string(),
  passed: z.boolean(),
  evidence: z.string(),
  // Coverage-first additions: the grader reports confidence + an estimated
  // severity so a downstream filter can rank findings; TS still computes the
  // binding severity/verdict/gates.
  confidence: z.number().min(0).max(1).optional(),
  severity_estimate: z.enum(["low", "medium", "high"]).optional(),
});
export type Expectation = z.infer<typeof ExpectationSchema>;

export const PatternFoundSchema = z.object({
  pattern: PatternIdSchema,
  quote: z.string(),
  context: z.string(),
  // Severity is stamped server-side from data/rationalization-patterns.json —
  // never chosen by the grader model.
  severity: SeveritySchema,
});
export type PatternFound = z.infer<typeof PatternFoundSchema>;

export const PressureComplianceSchema = z.object({
  // Verdict is computed deterministically in lib/verdict.ts, not by the grader.
  verdict: z.enum(["COMPLIANT", "PARTIALLY_COMPLIANT", "NON_COMPLIANT"]),
  patterns_found: z.array(PatternFoundSchema),
  steps_skipped: z.array(z.string()),
  rationalization_count: z.number().int(),
});
export type PressureCompliance = z.infer<typeof PressureComplianceSchema>;

export const TimingSchema = z.object({
  total_tokens: z.number(),
  duration_ms: z.number(),
  total_duration_seconds: z.number(),
});
export type Timing = z.infer<typeof TimingSchema>;

export const ClaimSchema = z.object({
  claim: z.string(),
  type: z.enum(["factual", "process", "quality"]),
  verified: z.boolean(),
  evidence: z.string(),
});
export type Claim = z.infer<typeof ClaimSchema>;

export const UserNotesSummarySchema = z.object({
  uncertainties: z.array(z.string()),
  needs_review: z.array(z.string()),
  workarounds: z.array(z.string()),
});

export const EvalFeedbackSchema = z.object({
  suggestions: z.array(z.object({ assertion: z.string().optional(), reason: z.string() })),
  overall: z.string(),
});

export const GradingSchema = z.object({
  expectations: z.array(ExpectationSchema),
  // summary is computed in TS from expectations — never model-supplied.
  summary: z.object({
    passed: z.number().int(),
    failed: z.number().int(),
    total: z.number().int(),
    pass_rate: z.number(),
  }),
  execution_metrics: z.object({
    total_tool_calls: z.number().int(),
    errors_encountered: z.number().int(),
  }),
  timing: TimingSchema,
  claims: z.array(ClaimSchema),
  user_notes_summary: UserNotesSummarySchema,
  eval_feedback: EvalFeedbackSchema,
  // OPTIONAL — present iff the eval declared pressure_blocks. (Break from the
  // old "ALWAYS required, even if empty" rule, which forced fabricated scans.)
  pressure_compliance: PressureComplianceSchema.optional(),
});
export type Grading = z.infer<typeof GradingSchema>;

/**
 * What the grader model itself emits (perception only): pass/fail with evidence,
 * claims, notes, feedback, and — for pressure evals — raw pattern sightings
 * WITHOUT severity. TS computes summary, severities, and the verdict.
 */
export const GraderOutputSchema = z.object({
  expectations: z.array(
    z.object({
      text: z.string(),
      passed: z.boolean(),
      evidence: z.string(),
      confidence: z.number().min(0).max(1).optional(),
      severity_estimate: z.enum(["low", "medium", "high"]).optional(),
    }),
  ),
  claims: z.array(ClaimSchema),
  user_notes_summary: UserNotesSummarySchema,
  eval_feedback: EvalFeedbackSchema,
  patterns_found: z
    .array(z.object({ pattern: z.string(), quote: z.string(), context: z.string() }))
    .optional(),
  steps_skipped: z.array(z.string()).optional(),
});
export type GraderOutput = z.infer<typeof GraderOutputSchema>;

// ---------------------------------------------------------------------------
// Trigger evals
// ---------------------------------------------------------------------------

export const TriggerQuerySchema = z.object({
  query: z.string(),
  should_trigger: z.boolean(),
});
export type TriggerQuery = z.infer<typeof TriggerQuerySchema>;

export const TriggerQuerySetSchema = z.array(TriggerQuerySchema).min(1);

export type TriggerQueryResult = {
  query: string;
  should_trigger: boolean;
  trigger_rate: number;
  triggers: number;
  runs: number;
  /** Infrastructure failures — never folded into "did not trigger". */
  infra_errors: number;
  /** null when all runs infra-errored (excluded from summary pass counts). */
  pass: boolean | null;
};

export type TriggerEvalResult = {
  skill_name: string;
  description: string;
  when_to_use: string | null;
  /** description + when_to_use combined length; listing surfaces truncate past 1536 chars. */
  listing_chars: number;
  listing_truncated: boolean;
  results: TriggerQueryResult[];
  summary: { total: number; passed: number; failed: number; infra_errors: number };
  total_cost_usd: number;
  generated_queries_path?: string;
};

// ---------------------------------------------------------------------------
// Benchmark
// ---------------------------------------------------------------------------

export type Stats = { mean: number; stddev: number; min: number; max: number };

export type BenchmarkRun = {
  eval_id: string;
  eval_name: string;
  configuration: string;
  run_number: number;
  result: {
    pass_rate: number;
    passed: number;
    total: number;
    time_seconds: number;
    tokens: number;
    cost_usd: number;
    tool_calls: number;
    errors: number;
  };
  expectations: Expectation[];
  pressure_verdict: string | null;
  notes: string[];
};

export type Benchmark = {
  metadata: {
    skill_name: string;
    skill_path: string;
    timestamp: string;
    evals_run: string[];
    runs_per_configuration: number;
  };
  runs: BenchmarkRun[];
  run_summary: Record<
    string,
    { pass_rate: Stats; time_seconds: Stats; tokens: Stats; cost_usd: Stats }
  >;
  // Numeric delta between two explicitly NAMED configs (candidate − baseline).
  // Break from the Python pipeline's string-typed, insertion-order-dependent delta.
  delta: {
    baseline: string;
    candidate: string;
    pass_rate: number;
    time_seconds: number;
    tokens: number;
    cost_usd: number;
  } | null;
  gates: { pressure_adherence: boolean | null; skill_lift: boolean | null };
  notes: string[];
};

// ---------------------------------------------------------------------------
// Comparison (blind A/B)
// ---------------------------------------------------------------------------

export const ComparisonJudgeOutputSchema = z.object({
  rubric: z.array(z.object({ criterion: z.string(), weight: z.number() })),
  scores: z.object({
    first: z.array(z.object({ criterion: z.string(), score: z.number().int().min(1).max(5), justification: z.string() })),
    second: z.array(z.object({ criterion: z.string(), score: z.number().int().min(1).max(5), justification: z.string() })),
  }),
  assertions: z.array(z.object({ text: z.string(), first_pass: z.boolean(), second_pass: z.boolean() })),
  totals: z.object({ first: z.number(), second: z.number() }),
  winner: z.enum(["first", "second", "tie"]),
  margin: z.string(),
  reasoning: z.string(),
});
export type ComparisonJudgeOutput = z.infer<typeof ComparisonJudgeOutputSchema>;

export type Comparison = {
  rubric: { criterion: string; weight: number }[];
  scores: {
    output_a: { criterion: string; score: number; justification: string }[];
    output_b: { criterion: string; score: number; justification: string }[];
  };
  assertions: { text: string; a_pass: boolean; b_pass: boolean }[];
  /** Recomputed in TS from per-criterion scores — the judge's totals are advisory. */
  totals: { output_a: number; output_b: number };
  winner: "output_a" | "output_b" | "tie";
  margin: string;
  reasoning: string;
  positions_swapped: boolean;
  /** Server-side observations, e.g. judge totals/winner disagreeing with recomputed scores. */
  notes: string[];
};

// ---------------------------------------------------------------------------
// Validation findings
// ---------------------------------------------------------------------------

export type FindingLevel = "error" | "warning" | "info";

export type Finding = {
  rule: string;
  message: string;
  file: string;
  line?: number;
};

export type ValidationResult = {
  /** zero errors — warnings need a stated reason to ignore; info is non-gating. */
  valid: boolean;
  errors: Finding[];
  warnings: Finding[];
  info: Finding[];
  stats: { skill_md_lines: number; description_chars: number; reference_files: number };
  packaged_path?: string;
};

// ---------------------------------------------------------------------------
// Run records (run_eval output)
// ---------------------------------------------------------------------------

export type RunStatus = "completed" | "infra_error" | "budget_exceeded" | "timeout";

export type RunRecord = {
  /** Path-shaped natural id, e.g. "pressure-test/with_skill/run-2". */
  run_id: string;
  configuration: string;
  run_number: number;
  status: RunStatus;
  run_dir: string;
  skill_invoked: boolean;
  grading?: {
    passed: number;
    failed: number;
    total: number;
    pass_rate: number;
    pressure_verdict: string | null;
    grading_path: string;
  };
  /** Set when auto-grading was attempted but failed — surfaced as a NOTE, never silently dropped. */
  grading_error?: string;
  /** Set when the run task itself threw (typed pool failure) — status is infra_error. */
  error?: string;
  timing: Timing;
  /** True when a timeout/stream error hid the real spend — cost_usd then includes a conservative budget-cap charge. */
  cost_incomplete?: boolean;
  cost_usd: number;
};

// ---------------------------------------------------------------------------
// optimize_description state (workspace-persisted; chunked one-iteration-per-call)
// ---------------------------------------------------------------------------

export const OptimizationHistoryEntrySchema = z.object({
  iteration: z.number().int(),
  description: z.string(),
  train_score: z.number(),
  test_score: z.number(),
  cost_usd: z.number(),
});

export const OptimizationStateSchema = z.object({
  skill_name: z.string(),
  skill_path: z.string(),
  original_description: z.string(),
  /** when_to_use is held constant during optimization; only description is tuned. */
  when_to_use: z.string().nullable(),
  current_description: z.string(),
  train_set: z.array(TriggerQuerySchema),
  test_set: z.array(TriggerQuerySchema),
  max_iterations: z.number().int(),
  runs_per_query: z.number().int(),
  trigger_threshold: z.number(),
  probe_model: z.string(),
  improve_model: z.string(),
  concurrency: z.number().int(),
  history: z.array(OptimizationHistoryEntrySchema),
  total_cost_usd: z.number(),
  done: z.boolean(),
  done_reason: z.string().optional(),
});
export type OptimizationState = z.infer<typeof OptimizationStateSchema>;

// ---------------------------------------------------------------------------
// Minimal transcript shapes (what checks.ts needs from transcript.jsonl lines)
// ---------------------------------------------------------------------------

export type TranscriptToolUse = { name: string; input: unknown };
