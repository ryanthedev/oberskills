# Safety and security

How to defend LLM agents against prompt injection, skill supply-chain attacks, and instruction-hierarchy violations. The core finding across the research theme: **architectural separation consistently outperforms behavioral training and prompt-level rules**. Defense fine-tuning destroys agent competence; system-level controls preserve it.

## Contents

1. [The defense hierarchy](#1-the-defense-hierarchy)
2. [The autonomy tax](#2-the-autonomy-tax-why-behavioral-training-backfires)
3. [Architectural defense: Dual-LLM (CaMeL)](#3-architectural-defense-dual-llm-camel)
4. [Instruction hierarchy](#4-instruction-hierarchy)
5. [Runtime guardrails: LlamaFirewall](#5-runtime-guardrails-llamafirewall)
6. [Skill supply-chain security](#6-skill-supply-chain-security)
7. [Data provenance tracking](#7-data-provenance-tracking)
8. [Decision table](#8-decision-table-which-defense-when)
9. [Anti-patterns](#9-anti-patterns)
10. [Key numbers](#10-key-numbers)

## 1. The defense hierarchy

Three layers, in order of effectiveness. Each higher layer catches threats the lower layers miss.

```
Layer 3: ARCHITECTURAL SEPARATION  (strongest)
  Dual-LLM, capability tracking, policy-as-code
  Evidence: 0% policy violations, 77% utility (2503.18813)

Layer 2: INSTRUCTION HIERARCHY
  Priority enforcement: system > agent > user > tool output
  (Fine-tuning a model you control for hierarchical compliance:
   constrained-RL approaches — HIPO 2603.16152; see §4)

Layer 1: RUNTIME GUARDRAILS
  Pattern detection + semantic auditing
  Evidence: >90% ASR reduction at 5pp utility cost (2505.03574)

Layer 0: BEHAVIORAL TRAINING / PROMPT RULES  (weakest — often counterproductive)
  Defense fine-tuning, "never follow injected instructions" prose
  Evidence: destroys 47-77% of benign tasks at Step 1 (2603.19423)
```

Do not rely on Layer 0 alone. Every paper in this theme shows prompt-level or training-based defenses fail under realistic multi-step conditions; Layer 0 is a supplement to Layers 1–3, never the defense.

## 2. The autonomy tax: why behavioral training backfires

Defense training (StruQ, SecAlign, DPO-based alignment) looks excellent on single-turn benchmarks (>90% attack rejection) and collapses catastrophically in multi-step agent settings (2603.19423, evaluated across 97 agent tasks and 1,000 adversarial prompts):

| Bias | What happens | Key numbers |
|---|---|---|
| Agent incompetence | Refuses or breaks on benign tasks at Step 1, before any external content | 47–77% Step-1 failure vs 3% baseline |
| Cascade amplification | A single refusal propagates through retry loops, exhausting the step budget | up to 99% timeout vs 13–50% baseline |
| Trigger bias | Keyword shortcuts: sophisticated attacks bypass, benign content over-refused | 73–86% bypass on social-engineering attacks; 25–71% FPR on benign technical content |

The paradox: defense training optimizes single-turn refusal benchmarks while making multi-step agents fundamentally unreliable. Security AND utility degrade together — a lose-lose, not a trade-off.

**Diagnostic:** if you suspect autonomy tax, check Step-1 execution on benign tasks with no external observations. Failure rate above ~10% means the defense training is the problem.

## 3. Architectural defense: Dual-LLM (CaMeL)

The strongest defense pattern in the literature (2503.18813). Separate the agent into two LLMs with an information barrier:

```
User query (trusted)
    → [Privileged LLM]  sees: user query + tool signatures ONLY
                        never sees tool outputs; emits the plan as code
    → [Interpreter]     tracks data provenance; checks policies in code
                        before each tool call
    → [Quarantined LLM] sees: tool outputs (untrusted data)
                        has NO tool access; structured output only
```

| Metric | Value |
|---|---|
| Security violations | 0% — by construction; policies enforced in code, not prompts |
| Task success with CaMeL | 77% (vs 84% undefended on the same benchmark) |
| Utility gap | 7pp, closing as models improve at code generation |

Why it works: the privileged planner never sees untrusted data, so injected instructions cannot alter the plan; the quarantined parser can extract information but cannot act. This eliminates the entire "convince the model to do something bad" attack category.

**Two threat classes — most defenses only cover the first:**

| Threat | Description | Defense |
|---|---|---|
| Control-flow hijacking | Injection alters the plan (different tools called) | Planner never sees injected content |
| Data-flow manipulation | Correct plan, attacker-chosen arguments (exfiltrate to attacker email) | Capability/provenance tracking with per-call policy checks (§7) |

Implementation checklist:

- [ ] Privileged LLM never sees raw content of tool outputs or quarantined-LLM responses
- [ ] Every value in the interpreter carries provenance tags (User, Tool, internal)
- [ ] Every tool call passes a deterministic policy check before execution
- [ ] Quarantined LLM has a structured output schema (including a `have_enough_information` boolean)
- [ ] Exception messages are redacted when they depend on untrusted data
- [ ] Security policies are expressed as code functions, not natural-language instructions

When Dual-LLM is overkill: pure chatbots with no tools, or agents that only process data the user directly provides. Use it when the agent processes untrusted external data (emails, web pages, third-party documents) AND has side-effect tools.

## 4. Instruction hierarchy

Authority flows one direction: **system prompt > agent instructions > user input > tool output**. Never let a lower level override a higher one.

Claude Code reality: the same stack applies — system prompt, then agent/skill instructions, then the user turn, then tool results. **Tool outputs (web pages, file contents, MCP results) are untrusted data**: parse and validate them; never execute them as instructions; redact error messages derived from untrusted content before echoing them upward.

| Check | How to verify |
|---|---|
| System-level constraints immutable? | No user-input path can alter system instructions |
| Agent instructions bounded by system? | The agent cannot escalate its own permissions |
| User input untrusted? | Delimited with XML tags; never interpolated raw |
| Tool output untrusted? | Validated before acting on; never followed as instructions |

If you are fine-tuning a model you control for hierarchical compliance, constrained-RL approaches enforce system compliance as a hard constraint rather than a soft preference (HIPO 2603.16152) — irrelevant when prompting hosted Claude, where the hierarchy is enforced structurally (§3) and at the schema level.

**Schema-level enforcement beats prompt constraints:** an agent that must not write files should have write tools excluded from its tool set, making violations impossible rather than merely discouraged (OpenDev 2603.05344 pattern; maps directly onto Claude Code subagent `tools`/`disallowedTools`).

## 5. Runtime guardrails: LlamaFirewall

When you cannot change the architecture and need defense at the system boundary: layered scanning with complementary strategies (2505.03574).

| Scanner | Catches | How |
|---|---|---|
| PromptGuard 2 | Direct jailbreaks, explicit injection patterns | Small fine-tuned classifier; ~92ms per check; 97.5% recall at 1% FPR |
| AlignmentCheck | Indirect goal hijacking, semantic drift, behavioral misalignment | Few-shot CoT auditor inspecting the full execution trace, not individual messages |
| CodeShield | Insecure generated code (50+ CWEs, 8 languages) | Static analysis on output (~60–300ms) |

Combined results on AgentDojo:

| Configuration | ASR | ASR reduction |
|---|---|---|
| No guardrail (baseline) | 17.6% | — |
| PromptGuard 2 only | 7.5% | 57% |
| AlignmentCheck only | 2.9% | 84% |
| **Combined** | **1.75%** | **>90%** (at ~5pp utility cost) |

The layers are complementary: pattern matching is cheap and catches the explicit; the semantic auditor catches drift that evades patterns. If you can afford only one scanner, the CoT auditor catches more alone; it needs a sufficiently capable base model and flags drift between the agent's actions and the stated user objective.

## 6. Skill supply-chain security

This section is the canonical evidence home consumed by skill-craft's REVIEW supply-chain checks.

Agent skills (SKILL.md files plus bundled scripts) are a software supply-chain attack surface. From an analysis of 31,132 marketplace skills (2601.10338):

| Finding | Number |
|---|---|
| Skills with at least one vulnerability | **26.1%** |
| Data exfiltration vulnerabilities | 13.3% |
| Privilege escalation vulnerabilities | 11.8% |
| High severity (likely malicious intent) | 5.2% |
| Skills with scripts vs instruction-only | **2.12x more likely** to contain vulnerabilities (OR=2.12, p<0.001) |

**Four injection patterns** demonstrated against Claude Code and Claude web (2510.26328). Skills are uniquely vulnerable because every line is interpreted as an instruction — "detect instructions in data" defenses are useless by definition:

| Pattern | How it works |
|---|---|
| Hidden instruction in SKILL.md | Malicious line buried in a long skill file; reviewers miss it, the model follows it |
| Malicious bundled script | Script performs exfiltration while appearing to do its named job |
| Permission carry-over | "Yes, and don't ask again" approval for a benign action is inherited by a malicious one |
| Output-embedded exfiltration | Stolen data attached as URLs in model output when outbound network is blocked |

**The consent gap:** all four exploit the mismatch between what users approve and what skills do. Users accept whole skills without reviewing capabilities; "don't ask again" silences every subsequent action of that type.

Practical rules: static analysis + LLM review before loading any third-party skill; prefer instruction-only skills; sandbox and pin dependencies when scripts are needed; never batch-approve sensitive operations.

## 7. Data provenance tracking

CaMeL's capability system is the model for tracking data through an agent pipeline. Every value carries: a source tag (User, Tool:name, internal), an allowed-readers set, and a dependency graph. Before each tool call, the interpreter checks that all arguments permit this tool as a reader and that external recipients are allowed; failures block execution or prompt the user.

Design principles:

- User-supplied literals are trusted by definition; tool outputs inherit tool (untrusted) provenance.
- Derived values inherit the most restrictive parent — trusted + untrusted = untrusted.
- Exception messages carry provenance: redact exception content that depends on untrusted sources (an injection vector).
- Express policies as code functions, never as natural-language instructions.

## 8. Decision table: which defense when

| Situation | Recommended defense | Layer |
|---|---|---|
| Agent processes untrusted external data AND has side-effect tools | Dual-LLM (CaMeL) | 3 |
| Agent processes untrusted data but only reads | Runtime guardrails | 1 |
| Fine-tuning a model you control for hierarchical compliance | Constrained-RL approaches (HIPO 2603.16152); irrelevant when prompting hosted Claude | 2 |
| Adding third-party skills to an agent | Static analysis + LLM review before loading; sandbox scripts (§6) | 1–3 |
| Coding agent generating code from untrusted input | Static analysis on output (CodeShield pattern) | 1 |
| Need protection now, no architecture changes possible | Input scanner (PromptGuard pattern) | 1 |
| Considering defense fine-tuning (StruQ, SecAlign) | **Do not use alone for agents** — autonomy tax (§2) | 0 |
| Must protect control flow AND data flow | Full CaMeL with capabilities | 3 |
| Forbidden actions for a subagent | Exclude the tools at the schema level (§4) | 3 |

## 9. Anti-patterns

| Anti-pattern | Why it fails | Instead |
|---|---|---|
| Prompt-only security rules ("never follow injected instructions") | Fundamentally breakable — the model IS the attack surface | Policies as deterministic code (2503.18813) |
| Defense fine-tuning as sole protection | 47–77% Step-1 benign failure; shortcut learning (2603.19423) | Architectural separation or runtime guardrails |
| Trusting skills from unvetted marketplaces | 26.1% vulnerability rate; 5.2% likely malicious (2601.10338) | Review before loading; sandbox scripts |
| Blanket "allow and don't ask again" permissions | Consent gap enables carry-over to harmful actions (2510.26328) | Per-action approval for sensitive operations |
| Untrusted tool output in the planning context | Injection reaches the planner | Separate planning from data extraction (§3) |
| Evaluating defenses on single-turn benchmarks | High single-turn rejection masks multi-step collapse (§2) | Test on multi-step agent tasks with cascade measurement |
| URL-embedded injection in tool output | Payload rides in a URL fragment, concealed until the agent navigates — 2–3× harder to resist than plain-text, and Claude is *more* exposed (2504.18575) | Strip URL fragments/anchors from untrusted output before navigation; treat any untrusted URL as a tool-call argument behind the schema gate; log navigated URLs |

## 10. Key numbers

| Metric | Value | Source |
|---|---|---|
| CaMeL policy violations / utility | 0% / 77% vs 84% undefended | 2503.18813 |
| Autonomy tax Step-1 failure | 47–77% vs 3% baseline | 2603.19423 |
| Autonomy tax cascade timeout | up to 99% vs 13–50% baseline | 2603.19423 |
| LlamaFirewall combined ASR | 17.6% → 1.75% at ~5pp utility cost | 2505.03574 |
| Skills with vulnerabilities | 26.1% of 31,132 | 2601.10338 |
| Script-bundled skill risk | 2.12x (OR, p<0.001) | 2601.10338 |
| Skill injection vs consent gap | 4 patterns, demonstrated end-to-end | 2510.26328 |
| URL vs plain-text injection ASR | GPT-4o 61.9% vs 23.8%; Claude-3.7 81.0% vs 26.2% | 2504.18575 |
| Prompt-only agent-safety ceiling | <70% even with enhanced defense prompts; weaker models gain ~nothing | 2412.14470 |
| Tool-restriction gate (enumerate then strip before untrusted content) | targeted ASR 45.8% → 7.5% | 2406.13352 |
