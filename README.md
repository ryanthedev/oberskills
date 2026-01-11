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

## Updating

```bash
/plugin update oberskills@rtd
```

## License

MIT
