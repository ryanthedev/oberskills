# oberskills

Advanced Claude Code skills for debugging, prompt engineering, agent dispatch, planning, and execution.

## Skill Chain

The skills chain together to enforce quality at every step:

```
oberplan ──→ oberexec ──→ oberagent ──→ oberprompt
   │            │             │             │
   │            │             │             └── Prompt engineering principles
   │            │             │                 (constraint budget, validation)
   │            │             │
   │            │             └── Agent dispatch validation
   │            │                 (Step 1: invoke oberprompt)
   │            │
   │            └── Phase execution with checkpoints
   │                (identify skills → invoke oberagent)
   │
   └── Planning orchestration
       (lens selection, requirements, plan structure)
```

**The chain is explicit:** oberexec identifies skills and invokes oberagent. oberagent invokes oberprompt before writing any agent prompt. Each dispatch is a fresh decision point.

## Skills

| Skill | Purpose | Triggers |
|-------|---------|----------|
| **oberdebug** | Hypothesis-driven debugging with evidence-based root cause analysis | bugs, errors, "not working", test failures |
| **oberprompt** | Research-backed prompt engineering for LLM systems | writing prompts, system messages, "prompt not working" |
| **oberagent** | Enforces oberprompt principles before agent dispatch | Task tool, agent dispatch, subagent |
| **oberplan** | Meta-planning with lens skills and checkpoints | "build", "create", "implement", "plan for" |
| **oberexec** | Subagent-driven plan executor with code reviews | "execute the plan", "run the plan" |
| **oberweb** | Multi-dimensional web search with parallel subagents | "research this", "comprehensive search", web research |

## Installation

```bash
# Add the RTD marketplace
/plugin marketplace add ryanthedev/rtd-claude-inn

# Install the plugin
/plugin install oberskills@rtd

# Update to latest
/plugin update oberskills@rtd
```

## How It Works

### oberplan
Creates structured plans with agent assignments, dependencies, and validation criteria. Loads domain-specific "lens skills" based on user intent.

### oberexec
Executes plans phase-by-phase. Before each dispatch:
1. Identifies which skills the phase needs
2. Invokes oberagent with the skills list
3. Dispatches the agent
4. Runs checkpoint validation (code review)
5. Commits on success

### oberagent
Gates every agent dispatch. Workflow:
1. **Invoke oberprompt** (mandatory)
2. Define agent purpose (outcome, not actions)
3. Select agent type
4. Identify applicable skills
5. Write prompt
6. Validate with checklist

### oberprompt
Provides prompt engineering principles:
- Model capability tiers and constraint budgets
- Progressive disclosure (start simple)
- Anti-patterns to avoid
- Validation checklist

### oberweb
Multi-dimensional web search:
1. Analyzes query to identify search dimensions (docs, tutorials, discussions, etc.)
2. Dispatches parallel haiku agents for each dimension
3. Synthesizes results into concise summary
4. Returns relevant findings + source URLs
5. Preserves main agent context

### oberdebug
Hypothesis-driven debugging:
1. Infer issue from symptoms
2. Check reproduction, logs, git history
3. Propose debug instrumentation
4. Analyze results
5. Loop until evidence confirms root cause

## Examples

| Example | Demonstrates |
|---------|--------------|
| [oberplan-window-picker](examples/oberplan-window-picker.md) | Full skill chain: oberplan → oberexec → oberagent → oberprompt |
| [oberagent-code-review](examples/oberagent-code-review.md) | Checklist validation, skill inheritance, outcome-focused prompting |

## Demo

A launchd service wouldn't start after changing deploy paths. oberdebug diagnosed it by dispatching parallel agents to check logs, verify binary paths, and analyze service behavior:

![Evidence synthesis and root cause](assets/oberdebug-demo-3.png)

Root cause: The Makefile's `run` target deleted the app bundle right after `dev` deployed it. Found with evidence, not guessing.

## Version

Current version: **1.11.0**

## License

MIT
