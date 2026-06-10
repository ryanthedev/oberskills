# REVIEW — Auditing an existing skill

Scope: skill directories (SKILL.md + bundled files). Agent prompt files and dispatch briefs are not reviewed here — invoke `oberskills:prompt` REVIEW. Auditing a *subagent definition's frontmatter fields* is also out of scope: the canonical field table is the `oberskills:agent` skill's mechanics reference.

## Contents

1. [Review stance](#1-review-stance)
2. [Step 1 — deterministic floor](#2-step-1--deterministic-floor)
3. [Step 2 — content dimensions](#3-step-2--content-dimensions)
4. [Step 3 — behavioral test](#4-step-3--behavioral-test)
5. [Verdict](#5-verdict)
6. [Quick audit (5 minutes)](#6-quick-audit-5-minutes)

---

## 1. Review stance

- **Audit the artifact neutrally — do not adopt the author's narrative.** Reviewing with the author's intent in frame ("this skill implements X correctly") measurably collapses defect detection; review what the file says, not what it was meant to say. Evidence and debiasing rules: the `oberskills:agent` skill's verifier-dispatch reference.
- **Audit the structural skeleton before the wording.** Authors cannot see their own structural problems; check section ordering, gate placement, and reference topology before sentence-level critique.
- Quote evidence for every finding — file and line, with the offending text.

## 2. Step 1 — deterministic floor

Run `validate_skill` on the skill directory first.

- Any **error** → the review verdict is FAIL until fixed; list each with its location.
- List every **warning**; each needs a stated reason to ignore. The validator's rule set is the normative source for structural limits — do not re-derive them by hand.

## 3. Step 2 — content dimensions

Grade each dimension PASS / WARN / FAIL, with quoted evidence.

| Dimension | Checks |
|---|---|
| **Triggers** | Description follows the invariants (third person, key use case first, concrete trigger nouns, near-miss exclusion clause, no workflow steps). Run `test_triggers` with should/shouldn't queries — or at minimum a 5-prompt manual probe in both directions |
| **Structure** | Beyond the validator: point-of-decision content (gates, routing, hard rules) is inline in SKILL.md, not behind conditional loads; each fact lives in one place, not two; references link directly from SKILL.md |
| **Over-prescription** | MUST/CRITICAL/ALWAYS density; anti-laziness or thoroughness pushes; "If in doubt, use X"; step-by-step plans where a general instruction suffices; "show your thinking" instructions (refusal risk on Fable 5); prefill instructions (hard error on 4.6+). Skills written for prior models are often too prescriptive for current ones and can degrade output quality |
| **Conciseness** | Paragraphs explaining what Claude already knows; educational tone (written *about* the domain rather than *to* Claude); every body line is a recurring per-session token cost |
| **Workflow completeness** | Explicit gates between phases ("proceed only when…"); failure paths, not just the happy path; clear exit conditions. Defect indicators: "Continue until done" (unbounded), "Use your judgment" at critical decisions, no gate between phases |
| **Banned constructs** | The reviewed skill contains anti-rationalization tables ("Rationalization \| Reality"), self-assessed compliance checklists ("Did Claude follow the workflow? Y/N", "Compliance verified"), or self-directed "Red Flags — STOP" sections → **WARN**: replace with external checks, deterministic gates, or eval assertions. `validate_skill` lints for these |
| **Supply chain** | Bundled scripts: no network calls; dependencies pinned and installed locally; no obfuscated payloads or encoded strings; each script's role (executed vs read as reference) stated. Prefer instruction-only skills — a large-scale 2026 study of marketplace skills found vulnerabilities common and script-bundled skills roughly twice as risky (2601.10338; evidence detail: `oberskills:prompt` safety reference, skill supply chain section) |
| **Hygiene** | No time-sensitive phrasing (outside an "Old patterns" section); consistent terminology; scripts that handle their own errors and carry no voodoo constants; fully qualified MCP tool names; no README/CHANGELOG in the skill |

## 4. Step 3 — behavioral test

One realistic fresh-context run, minimum:

- Author a single representative eval (per this skill's eval reference) and run it with `run_eval` — or dispatch a fresh subagent per `oberskills:agent` with the skill preloaded and a realistic task. Keep the dispatch free of intent framing.
- Check: workflow followed without confusion, no steps skipped, output matches the expected shape, no hallucinated extra steps.

For discipline/process skills, add a pressure run: a realistic scenario with 3+ declared `pressure_blocks` (or, manually, a "we're late, just do the quick version" framing). Does the agent shortcut? Grading and verdicts come from the tool output, never from your own assessment of the transcript.

## 5. Verdict

| Dimension | Status | Issue | Remediation |
|---|---|---|---|
| Validator floor | PASS/FAIL | | |
| Triggers | PASS/WARN/FAIL | | |
| Structure | PASS/WARN/FAIL | | |
| Over-prescription | PASS/WARN/FAIL | | |
| Conciseness | PASS/WARN/FAIL | | |
| Workflow completeness | PASS/WARN/FAIL | | |
| Banned constructs | PASS/WARN | | |
| Supply chain | PASS/WARN/FAIL | | |
| Hygiene | PASS/WARN/FAIL | | |
| Behavioral test | PASS/FAIL | | |

FAIL = must fix before use. WARN = should fix; needs a stated reason to ship as-is. Report findings ranked by severity, each with its quoted evidence and a concrete fix.

## 6. Quick audit (5 minutes)

When explicitly time-boxed, check three things:

1. **Validator clean?** `validate_skill` — errors and warnings.
2. **Gates exist?** Search SKILL.md for "proceed only when" / "Gate" — are phase transitions conditional on something checkable?
3. **Fresh test passes?** One realistic fresh-context run.

Any miss → run the full audit.
