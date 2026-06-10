# Skills: Programming the AI

> Presentation outline — skills as applications we create to make AI agents more successful at tasks.

---

## 1. What Are Skills?

Skills are software we write to program the AI. They make agents more successful at accomplishing tasks — from deterministic operations (take a screenshot) to open-ended exploration (find missing edge cases).

A skill is a markdown file with YAML frontmatter. The description tells the agent when to use it, the body tells it how.

```
skill-name/
├── SKILL.md           # Metadata + instructions
├── references/        # Detailed content loaded on demand
├── scripts/           # Executable code
└── assets/            # Templates, fonts, output resources
```

**The Agent Skills open standard** (agentskills.io) makes skills portable across 20+ tools — Claude Code, Codex, Gemini CLI, Copilot, Cursor, Windsurf.

---

## 2. Skill Patterns

When creating a new skill, the first question is: what kind of application am I building? Eight patterns have emerged.

### Router

**What you're programming the AI to do:** Pick the right path.

Classifies input, dispatches to one handler. Reveals instructions conditionally based on the route taken.

**Highlight:** `web-research` — infers depth mode (scan/brief/breadth/deep) from the user's query, loads different reference files per mode, dispatches different numbers of search agents.

| User Signal                    | Mode      |
|--------------------------------|-----------|
| "quick", "is there", "syntax"  | scan      |
| "research", "how to", default  | brief     |
| "survey", "compare", "options" | breadth   |
| "deep dive", "report"          | deep      |

---

### Workflow

**What you're programming the AI to do:** Sequence work.

Fixed or dynamic steps with explicit gates between them. Ranges from predetermined pipelines to adaptive orchestration.

**Highlight:** `build` — dispatches a build-agent per phase from the plan, runs post-gate review after each, loops on failure. Gate policy adapts by phase risk (first/last phase → Full review, simple phase → Minimal).

```
Plan → Phase 1 → Gate → Phase 2 → Gate → ... → Done
         ↑                  ↑
     build-agent        post-gate
         ↑___FAIL___↗
```

---

### Validator

**What you're programming the AI to do:** Check work against criteria.

Ranges from simple pass/fail gates to multi-dimensional reviews with evidence gathering and feedback loops.

**Highlight:** `post-gate-agent` — reviews implementation against 5 correctness dimensions, verifies every done-when item from the plan, produces a detailed review with PASS/FAIL verdict. Loads Reference Frame skills as checklists — the agent provides the evaluation process, the skills provide the criteria.

---

### Transformer

**What you're programming the AI to do:** Apply rules to input, produce output.

Single pass. No routing, no delegation — just structured transformation governed by a ruleset.

**Highlight:** `write` — Strunk's surface rules + research-backed AI pattern detection (em-dashes, aidiolect, burstiness, voice). User's prose goes in, human-sounding prose comes out.

---

### Diagnostic

**What you're programming the AI to do:** Classify a problem, select a remedy.

The classification IS the work, not just a dispatch decision. Builds a fault taxonomy, tests hypotheses, maximizes information gain.

**Highlight:** `clarify` — diagnoses the request itself. Classifies ambiguity type, generates competing hypotheses, selects maximally informative questions. Meta-diagnostic: the problem is "I don't know what the problem is."

---

### Tool Wrapper

**What you're programming the AI to do:** Use an external tool properly.

Zero domain logic in the skill. All value is semantic bridging — translating natural language into the right tool call with the right parameters.

**Highlight:** `penman` — 37 lines. "Make this look good in Slack" becomes the right MCP call. Without the skill, the user needs to know the MCP exists, its parameter names, and the platform options. The skill makes the tool discoverable and usable.

```
User → pen.md (skill) → penman MCP (tool) → clipboard
         ↑                    ↑
    Semantic layer         Actual work
```

---

### Reference Frame

**What you're programming the AI to do:** Think with a framework.

Not a workflow — a lens. Loads structured knowledge (decision tables, classification rubrics, principle hierarchies) that shapes all downstream reasoning for the rest of the session.

**Highlight:** `design-for-ai` — one skill, no workflow. Typography, color theory, composition, and proportions loaded into context. Changes how the agent thinks about every design decision.

---

### Facilitator

**What you're programming the AI to do:** Help the human think.

No dispatch, no transformation, no classification of a known problem. Pure conversational scaffolding: ask → listen → reflect → ask deeper. The output is discovered requirements that didn't exist before the conversation.

**Highlight:** `research` — Socratic discovery. The only pattern no framework literature (Anthropic, LangChain, OpenAI) has named, because they focus on agent-does-work patterns, not agent-helps-human-think patterns.

---

### Choosing a Pattern

| Question | Pattern |
|----------|---------|
| Does the task need input classified before acting? | Router |
| Is it multi-step with dependencies? | Workflow |
| Does it need to verify output quality? | Validator |
| Is it rules → input → output in one pass? | Transformer |
| Does it diagnose problems? | Diagnostic |
| Does it make an external tool usable? | Tool Wrapper |
| Does it load a mental model into context? | Reference Frame |
| Does it help the user articulate what they want? | Facilitator |

Most real skills combine 2-3 patterns. `web-research` is Router + Workflow. `post-gate-agent` is Validator + Reference Frame. The patterns are composable building blocks, not exclusive categories.

---

## 3. Craft — Writing Effective Skills

Five principles backed by research.

### 3.1 Progressive Disclosure (3-Level Loading)

**Research:** MEM1 (2025) — selective loading produces 3.5x better performance at 3.7x less memory. NoLiMa (ICML 2025) — 11/13 models drop below 50% baseline at 32K tokens.

**Anthropic:** SKILL.md under 500 lines. Compaction preserves first 5,000 tokens per skill, 25,000 budget across all loaded skills.

```
Level 1: description (~100 tokens)    ← always in context
Level 2: SKILL.md body (<500 lines)   ← loaded on trigger
Level 3: references/ (unlimited)      ← loaded on demand
```

Keep the body lean. Heavy content goes in `references/`. Only load what the current task needs.

### 3.2 Structure Before Wording

**Research:** VISTA (2026) — wrong field ordering caused a 74 percentage-point accuracy drop. When LLMs self-reflect on failures, zero structural attributions across all configurations. LLMs cannot see their own structural problems.

**Validated ordering** (FSE 2025, production templates at Uber/Microsoft):

```
Role/Identity → Directive → Context/Workflow → Output Format → Constraints
```

Audit the skeleton first. Field ordering and section structure have larger effects than wording.

### 3.3 Tables for Decisions, Gates for Steps

**Research:** NLD-P (2026) — constraints embedded in prose "dissolve by paragraph three." FSE 2025 — explicit exclusion constraints took format-following from 40% to 100%. Mittal (2026) — each additional simultaneous constraint reduces compliance 2-21%.

Tables concentrate decisions into parseable structure. Gates (`## STOP`, `**Gate:**`) separate concerns so the model handles one constraint set at a time.

```markdown
# Prose (dissolves)
If the user wants a quick answer, use scan mode. If they want 
a standard research question, use brief mode...

# Table (holds)
| Signal        | Mode    |
|---------------|---------|
| "quick"       | scan    |
| "research"    | brief   |
| "deep dive"   | deep    |
```

### 3.4 Critical Rules at Beginning AND End

**Research:** Liu et al. (TACL 2024) — 30%+ accuracy drop when key information moves from position 1 to position 10. U-shaped attention curve: beginning and end get the most attention, middle gets least. Confirmed independently by OpenAI, Anthropic, and Google.

**Anthropic-specific:** Emphasis markers (`IMPORTANT`, `CRITICAL:`) measurably improve adherence in Claude.

Place your most important instructions where they'll actually be followed — the top and the bottom.

### 3.5 Separate Governance from Task

**Research:** NLD-P (2026) — monolithic prompts where constraints and task content are mashed together cause constraints to dissolve under model updates. HIPO (2026) — standard alignment can't enforce instruction hierarchy; priority must be explicit in structure.

Four distinct layers:

```
1. Identity:    role, context, operational scope
2. Constraints: behavioral rules, boundaries (independent)
3. Task:        the primary objective, isolated
4. Evaluation:  validation conditions, revision triggers
```

Never merge "what to do" with "how to behave" in a single paragraph.

---

## 4. Evaluation

**Skills exist to make the agent more successful at a task.** Test that it does the thing.

Manual testing is the current answer. Some skills are inherently easier to verify than others:

- A **Transformer** either produces the right output or it doesn't.
- A **Tool Wrapper** either calls the tool correctly or it doesn't.
- A **Facilitator** helping you think? You know it when you see it.

The key insight is understanding the goal:

| Task Type | Goal |
|-----------|------|
| **Deterministic** (screenshot, deploy) | Same result every time |
| **Guided** (code review, debugging) | Follows the methodology |
| **Exploratory** (edge cases, research) | Covers ground the agent wouldn't find alone |

Eval frameworks are emerging. If you have experience with one and want to demo, please do.

---

## 5. Distribution

### The Standard

Agent Skills (agentskills.io) gives portability. A SKILL.md works across Claude Code, Codex, Gemini CLI, Copilot, Cursor, and Windsurf. Distribution is a git repo.

```
Plugin marketplace  → /plugin install yourskill@marketplace
Git repo            → clone + point the agent at it
.skill file         → bundled package for sharing
```

### The Hard Problem

Distribution is genuinely hard. Skill complexity determines portability — the more powerful the pattern, the more platform-locked it becomes:

| Skill Pattern | Project skills | Plugin install | Cross-agent |
|---|---|---|---|
| Simple SKILL.md (Reference Frame, Transformer) | Works | Works | Works |
| Skills with `references/` | Works | Works | Varies |
| Skills with `scripts/` | Works | Needs deps | Unlikely |
| Skills with MCP servers | No | Plugin only | No |
| Skills using `${CLAUDE_PLUGIN_ROOT}` | No | Works | No |
| Claude-specific frontmatter (`hooks`, `context: fork`) | Works | Works | No |

The standard gives you portability for the simple patterns. The powerful patterns are still platform-locked. The standard will need to catch up to what skill authors are actually building.

---

## Sources

### Research Papers
- Modarressi et al., "NoLiMa: Long-Context Evaluation Beyond Literal Matching," ICML 2025. arXiv:2502.05167
- Zhou et al., "MEM1: Learning to Synergize Memory and Reasoning," 2025. arXiv:2506.15841
- Liu et al., "Lost in the Middle: How Language Models Use Long Contexts," TACL 2024
- Liu et al., "VISTA / Reflection in the Dark," 2026. arXiv:2603.18388
- NLD-P (Natural Language Design Patterns), 2026. arXiv:2602.22790
- Mittal, "Prospective Memory Failures in LLMs," 2026. arXiv:2603.23530
- "From Prompts to Templates," FSE 2025. arXiv:2504.02052
- Chen et al., "HIPO: Instruction Hierarchy via Constrained RL," 2026. arXiv:2603.16152

### Anthropic Official
- Extend Claude with skills — code.claude.com/docs/en/skills
- The Complete Guide to Building Skills for Claude (PDF)
- Equipping Agents for the Real World — anthropic.com/engineering

### Industry
- OpenAI GPT-4.1 / GPT-5 Prompting Guides
- Google Gemini Prompting Strategies
- Agent Skills Specification — agentskills.io
