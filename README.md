# oberskills

A Claude Code plugin with advanced workflow skills.

## Installation

```bash
# Add the RTD marketplace
/plugin marketplace add ryanthedev/rtd-claude-inn

# Install the plugin
/plugin install oberskills@rtd
```

## Skills

### oberdebug

Hypothesis-driven debugging with evidence-based root cause analysis.

**Flow:** Infer issue → Check reproduction → Check logs → Check git → Propose debug instrumentation → User runs → Analyze → Loop until confirmed → Output root cause with evidence

**Triggers:** bugs, errors, "not working", debugging, test failures

#### Demo

A launchd service wouldn't start after changing deploy paths. oberdebug diagnosed it by dispatching parallel agents to check logs, verify binary paths, and analyze service behavior:

![Issue statement, reproduction, and parallel agent dispatch](assets/oberdebug-demo.png)

![Agents investigating](assets/oberdebug-demo-2.png)

![Evidence synthesis and root cause](assets/oberdebug-demo-3.png)

Root cause: The Makefile's `run` target deleted the app bundle right after `dev` deployed it. Found with evidence, not guessing.

---

### oberprompt

Research-backed prompt engineering for LLM systems (80+ papers synthesized).

**Key insight:** Prompt effectiveness varies dramatically with model capability. What works for GPT-3.5 may harm GPT-4+.

**Covers:**
- Model capability tiers and constraint budgets
- Technique selection (CoT, few-shot, zero-shot)
- Prompt architecture and progressive disclosure
- Anti-patterns (Constraint Handcuffs, Position Neglect)
- Validation checklist (mandatory before shipping)

**Triggers:** writing prompts, system messages, agent instructions, "prompt not working", hallucinations

---

### oberagent

Meta-skill that enforces oberprompt principles before dispatching agents.

**Flow:** Define outcome → Select agent type → Apply constraint budget → Write outcome-focused prompt → Validate with checklist

**Key rules:**
- Agent prompts should be ≤3 sentences
- Focus on OUTCOME, not step-by-step instructions
- Start simple, add constraints only on failure

**Triggers:** Task tool, agent dispatch, subagent, parallel agents

---

### oberplan

Meta-skill that orchestrates planning by loading domain-specific lens skills, clarifying requirements, and producing agent-executable plans.

**Flow:** Lens selection → Requirements clarification → Plan construction (with checkpoints) → User confirmation → Final review → Output → Execution handoff

**Key features:**
- Loads domain-specific "lens skills" based on user intent (frontend-design, code-foundations, etc.)
- Enforces mandatory checkpoints after every implementation phase
- Requires capability proofs before visual/rendering work
- Produces structured plans with agent assignments, dependencies, and validation criteria

**Triggers:** "build", "create", "implement", "add feature", "design", "plan for", "how should we approach"

#### Demo

User describes a UI behavior change for a picker window. oberplan activates, selects a lens (or determines none fits), then explores the codebase to understand the current implementation before constructing a plan:

```
❯ can we please come up with a new plan. Right now my picker is working
  really well, but I would like a tweak. today when I type and the options
  reduce the entire window shifts and gets smaller. If the number of items
  changes, I would like the windows x/y position to change. I would like
  for it to just shrink.

  two ways to do this. The window size is fixed and we just hide options,
  or to shrink the window from the bottom up and left the top position
  pinned. That way my eyes always know where I typed my text.

⏺ I'll help you plan this picker window behavior change. Let me invoke
  the planning skill to properly scope this.

⏺ Skill(oberskills:oberplan)
  ⎿  Successfully loaded skill

⏺ I'll plan this picker window behavior change. Let me start by
  understanding the current implementation.

  Phase 1: Lens Selection

  LENS SELECTED: None (macOS/Swift window management - no specific lens skill)
  RATIONALE: This is native macOS window geometry management, not general frontend
  APPROACH: Direct codebase exploration + architectural planning

  Let me explore the current picker implementation to understand how
  window sizing works.

⏺ Explore(Explore picker window sizing)
  ⎿  Found 31 lines across 4 files...
```

oberplan then continues through requirements clarification, plan construction with checkpoints, user confirmation, and final review before handing off to oberexec for execution.

---

### oberexec

Subagent-driven plan executor that orchestrates implementation phases with checkpoints and code reviews.

**Flow:** Plan validation → Phase dispatch → Checkpoint validation → Progress update → Loop until complete → Final validation

**Key features:**
- Context-saving: implementation agents return FILE NAMES ONLY
- Code review subagent after every implementation phase
- Max 2 revision cycles per phase before escalating to user
- Integration review after all phases complete

**Triggers:** "execute the plan", "run the plan", "implement the plan", "start execution"

---

## Examples

Real-world transcripts showing how skills work together:

| Example | Demonstrates |
|---------|--------------|
| [oberplan-window-picker](examples/oberplan-window-picker.md) | Full oberplan workflow: lens selection, requirements clarification, plan construction, bootstrap prompt generation, and the complete skill chain (oberplan → oberexec → oberagent → oberprompt → code-foundations) |
| [oberagent-code-review](examples/oberagent-code-review.md) | oberagent checklist validation, skill inheritance via explicit instruction, outcome-focused prompting, and structured return format |

---

## Updating

```bash
/plugin update oberskills@rtd
```

## License

MIT
