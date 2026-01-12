# Example: oberplan + code-foundations Window Picker CLI Integration

This example demonstrates how oberplan orchestrates a feature that integrates a telescope-style picker with a CLI tool for window management.

## Task Summary

**Request:** Integrate grid-picker with thegrid CLI to select and focus tiling windows.

**Skills Used:**
- `oberplan` - Meta-planning orchestration
- `code-foundations` - Code quality lens

**Context:** Building on previous work that created a telescope-style picker list, now hooking it up with thegrid CLI for a unified interface.

---

## Workflow Phases

### Phase 1: Skill Invocation & Lens Selection

```
User: can you help me come up with a new plan for a feature? make sure to use planning skill.

you can look at the previous commits on this branch, we have create a telescope style picker list. Now, I would like to hook it up with thegrid cli. So
that way we can have a single unified interface.

the first thing I would like to implement with thegrid cli and grid-picker, is being able to choose from a list of windows from all of the current
tiliable windows. When I pick a window, it should bring that window to focus for me, and shift my mouse and current focus to that window.

make sure to use code-foundations as a good base when coming up with this plan.

ultrathink
```

Claude's response:

```
Claude: I'll invoke the planning skill to help design this feature properly.

→ Skill(oberskills:oberplan)
  Successfully loaded skill

Phase 1: Lens Selection

LENS SELECTED: code-foundations
RATIONALE: This is a code construction task involving CLI integration, IPC
communication, and system-level functionality. Code-foundations provides the
right principles for clean construction.

Let me load the lens skill and explore the existing codebase to understand
what we're working with.

→ Skill(code-foundations:code-foundations)
  Successfully loaded skill
```

**Key:** oberplan immediately identified code-foundations as the appropriate lens for this construction task.

---

### Phase 2: Task Classification & Exploration

```
Claude: Task Classification: WRITE - Building new integration between
grid-picker and thegrid CLI.

Before proceeding with the full skill chain, I need to explore the codebase
to understand:
1. The existing picker implementation (from recent commits)
2. The thegrid CLI structure
3. How windows are currently managed

→ Bash(git log --oneline -10 fix/picker-code-review-issues)
  c659a57 fix(picker): improve visual design and fix window resizing
  59096dd feat(picker): add multi-line items with icons and rich text support
  21c50fc feat(picker): implement fuzzy list picker with filtering and keyboard navigation
  … +7 lines
```

**Key:** Before planning, Claude explored the git history to understand the existing picker implementation and its evolution.

---

### Phase 2: Requirements Clarification

After exploration, Claude summarized understanding and asked clarifying questions:

```
Claude: Now I have a clear picture of the codebase. Let me proceed to
Phase 2: Requirements Clarification.

Based on my exploration, I understand:
- grid-picker: Swift standalone app that reads JSON from stdin, displays
  fuzzy picker, outputs selection to stdout
- grid CLI: Go CLI using cobra, has focus.FocusWindow() and
  mouse.WarpToWindow() for window management
- WindowInfo: Contains ID, AppName, Title, Frame for all tileable windows

Before finalizing the plan, I have a few clarifying questions:
```

**Question 1: Command Naming**

```
┌──────────────────────────────────────────────────────────────────────────┐
│ How should the picker command be invoked? Should it be                   │
│ `thegrid picker windows` or just `thegrid picker` (with windows default)?│
├──────────────────────────────────────────────────────────────────────────┤
│ ❯ 1. thegrid pick windows                                                │
│      Subcommand structure allowing future pickers (pick layouts, etc.)   │
│   2. thegrid windows                                                     │
│      Direct command, simpler but less extensible                         │
│   3. thegrid pick                                                        │
│      Single command that defaults to windows picker                      │
│   4. Type something.                                                     │
└──────────────────────────────────────────────────────────────────────────┘
```

**Question 2: Display Format** *(answered)*

**Question 3: Hotkey Support**

```
┌──────────────────────────────────────────────────────────────────────────┐
│ ←  ☒ Command name  ☒ Display format  ☐ Hotkey support  ✔ Submit  →       │
├──────────────────────────────────────────────────────────────────────────┤
│ Should the picker also integrate with BFD (hotkey daemon) so it can be  │
│ triggered via keyboard shortcut?                                         │
├──────────────────────────────────────────────────────────────────────────┤
│ ❯ 1. Yes, plan for it                                                    │
│      Include BFD integration in the plan (e.g., ctrl-space to open)      │
│   2. CLI only for now                                                    │
│      Focus on CLI integration first, BFD can be added later              │
│   3. Type something.                                                     │
└──────────────────────────────────────────────────────────────────────────┘
```

**User Answers:**

```
User answered Claude's questions:
  · How should the picker command be invoked? → thegrid pick windows
  · What information should be displayed for each window? → App + Title (Recommended)
  · Should the picker integrate with BFD (hotkey daemon)? → Yes, plan for it
```

**Requirements Confirmation:**

```
Claude: REQUIREMENTS CONFIRMED:
- Outcome: User invokes thegrid pick windows, sees fuzzy list of tileable
  windows, selects one → window focuses + mouse warps to it
- Scope:
    - IN: CLI pick subcommand, windows subcommand, picker integration,
          focus + mouse warp, BFD hotkey
    - OUT: Other picker types (layouts, cells, spaces) - future work
- Display format: Title = window title, Subtitle = app name, Icon = app icon emoji
- Mode: Interactive (walking through phases)
```

**Key:** oberplan uses multi-question clarification with checkbox navigation (☐/☒) to gather all requirements before planning. After user answers, Claude confirms the requirements with explicit IN/OUT scope.

---

### Phase 3: Plan Construction

```
Claude: Let me present the plan phase by phase. I'll follow the
cc-construction-prerequisites principle: understand what exists, design
the interface, then implement.
```

**Generated Plan:**

```
Plan: Window Picker Integration

Objective: Integrate grid-picker with thegrid CLI to enable fuzzy window
selection that focuses the chosen window and warps the mouse cursor to it.

---
Phase 1: Add pick Command Structure to CLI

Objective: Create extensible command hierarchy for picker functionality
Agent: Implementation agent with Go/cobra expertise

Work:
1. Add new pickCmd parent command to grid-cli/cmd/grid/main.go
2. Create pick windows subcommand that will invoke the picker
3. Wire up standard flags (--json, --socket, --timeout)

Validation:
- thegrid pick --help displays help
- No compilation errors

---
Checkpoint: Build Gate
Type: Build/Lint Gate
Pass Criteria: go build ./... succeeds, no new lint warnings

---
Phase 2: Implement Window List Generation

Objective: Create function to generate picker-compatible JSON from tileable windows
Agent: Implementation agent with Go expertise

Work:
1. Create new file grid-cli/internal/picker/windows.go
2. Implement GenerateWindowItems(snap, exclusions) []PickerItem
3. Map WindowInfo → PickerItem with:
   - id: window ID as string
   - title: window title (or app name if title empty)
   - subtitle: app name / bundle ID
   - icon: emoji based on app (default "🪟")
   - metadata.windowId: original window ID

Validation: Unit test verifies JSON output matches picker schema

---
Checkpoint: Test Validation
Pass Criteria: go test ./internal/picker/... passes

---
Phase 3: Implement Picker Invocation

Objective: Wire pick windows command to invoke grid-picker with window list

Work:
1. In pickWindowsCmd.RunE:
   - Fetch server snapshot
   - Generate window items JSON
   - Locate grid-picker binary
   - Spawn grid-picker process with JSON piped to stdin
   - Parse stdout for selected item
2. Handle exit codes: 0 = selected, 1 = cancelled
3. Extract window ID from selection result

---
Checkpoint: Capability Proof
Type: Capability Proof
Proves: Picker can be invoked from CLI and selection returned

---
Phase 4: Implement Focus + Mouse Warp

Objective: Complete workflow by focusing selected window and warping mouse

Work:
1. After successful selection:
   - Call focus.FocusWindow(ctx, client, windowID)
   - Call mouse.WarpToWindow(ctx, client, windowID)
2. Handle errors gracefully (window may have closed)
3. Output result (JSON or human-readable based on --json flag)

---
Checkpoint: Integration Test
Pass Criteria:
- thegrid pick windows → select → window focuses
- Mouse cursor at center of selected window
- Works with windows on different displays

---
Phase 5: Add BFD Hotkey Integration

Objective: Enable triggering window picker via keyboard shortcut

Work:
1. Add example hotkey to bfd.yaml:
   hotkeys:
     ctrl-space: ${grid} pick windows
2. Test that BFD correctly spawns the picker
3. Document in README

---
Checkpoint: Code Review
Pass Criteria:
- No unnecessary abstractions
- Error handling follows existing patterns
- Logging uses jsonlog consistently
- No hardcoded paths (use xdg package)
- Comments explain "why" not "what"
```

**Execution Flow Diagram:**

```
Phase 1: Add pick command structure
    ↓
Checkpoint: Build Gate
    ↓
Phase 2: Implement window list generation
    ↓
Checkpoint: Test Validation
    ↓
Phase 3: Implement picker invocation
    ↓
Checkpoint: Capability Proof
    ↓
Phase 4: Focus + mouse warp
    ↓
Checkpoint: Integration Test
    ↓
Phase 5: BFD hotkey
    ↓
Checkpoint: Code Review
```

**Risk Register:**

```
┌───────────────────────────────────────────┬────────────┬─────────────────────────────────┐
│                   Risk                    │ Likelihood │           Mitigation            │
├───────────────────────────────────────────┼────────────┼─────────────────────────────────┤
│ grid-picker binary not found              │ Medium     │ Check multiple locations        │
│ Window closed between selection and focus │ Low        │ Handle error gracefully         │
│ Picker stdin/stdout parsing fails         │ Low        │ Use JSON strictly, test edges   │
│ App icons hard to determine               │ Medium     │ Use default icon "🪟" for MVP   │
└───────────────────────────────────────────┴────────────┴─────────────────────────────────┘
```

**Key:** The plan follows cc-construction-prerequisites principles with explicit phases, checkpoints after each phase, and a risk register. Each phase has clear inputs, outputs, and validation criteria.

```
Claude: Does this plan align with your expectations? Any phases you'd like
to adjust or expand?

✻ Cogitated for 1m 52s
```

*[User approves plan...]*

---

### Phase 6-10: Plan Finalization and Bootstrap

After user approval, oberplan executes the new phases:

**Plan Saved:**

```
PLAN SAVED:
- Location: ~/.local/state/oberplan/plans/thegrid-window-picker-2026-01-12.md
- Ready for: Fresh context execution
```

**Bootstrap Prompt Generated (via oberprompt):**

```
PLAN COMPLETE - READY FOR EXECUTION

Plan saved to: ~/.local/state/oberplan/plans/thegrid-window-picker-2026-01-12.md

To execute, open a fresh Claude Code session and paste this prompt:

─────────────────────────────────────────────────────────────────────────────
Navigate to: /Users/r/repos/theGrid

I need you to execute an approved implementation plan for adding a window
picker feature.

First, invoke the oberexec skill.

Then read the plan file at:
~/.local/state/oberplan/plans/thegrid-window-picker-2026-01-12.md

Execute the plan following oberexec's workflow:
- Start with Phase 0 to verify server capabilities
- Dispatch implementation agents phase by phase
- Run checkpoint reviews after each phase
- Track progress through all 6 phases (0-5)
- Complete final integration review

The plan has 6 phases and 4 checkpoints.

Required skills for agents: code-foundations

Begin execution now.
─────────────────────────────────────────────────────────────────────────────

Instructions:
1. Open a new Claude Code session
2. Navigate to /Users/r/repos/theGrid
3. Paste the bootstrap prompt above
4. oberexec will begin plan execution

Planning session complete.
```

**Key:** The bootstrap prompt is:
- Self-contained (no dependencies on prior conversation)
- Outcome-focused (what to do, not how)
- Minimal constraints (trusts oberexec to handle details)
- Specific enough to start immediately (file path, skill invocation, phase count)

---

## Key Patterns Demonstrated

### 1. Lens Selection Rationale
oberplan explicitly justifies why code-foundations was selected:
- CLI integration
- IPC communication
- System-level functionality

### 2. Context Gathering Before Planning
Rather than jumping into planning, Claude first:
1. Loaded the lens skill
2. Explored git history to understand recent work
3. Identified what needs to be understood (picker, CLI, window management)

### 3. Model Selection for Exploration (Emergent)

**Observed behavior (never instructed):** oberplan autonomously selected Sonnet 4.5 for the exploration phase:

```
→ Explore(Explore picker and CLI architecture) Sonnet 4.5
  Read 150 lines
  Found 190 lines
  Found 9 files
  +38 more tool uses
```

**Why this matters:**
- Opus context is expensive - save it for planning decisions
- Exploration is read-heavy, not reasoning-heavy
- Sonnet handles file discovery and pattern matching efficiently
- Emergent cost optimization without explicit instruction

### 4. Building on Previous Work
The task builds on prior commits, demonstrating incremental feature development with oberplan guiding each phase.

### 5. Multi-Question Clarification
oberplan batches related questions and uses checkbox navigation to gather all requirements before planning:
- Command naming preferences
- Display format choices
- Integration scope (BFD hotkey)

### 6. Structured Plan with Checkpoints
The plan includes:
- Clear phases with objectives and validation
- Build gates and capability proofs
- Risk register with mitigations
- Execution flow diagram

### 7. Fresh Context Handoff
Planning consumes context. oberplan:
- Saves the plan to a persistent file
- Generates a bootstrap prompt via oberprompt principles
- Ends the planning session cleanly
- User starts fresh for execution with full context budget

### 8. Full Skill Chain (oberplan → oberexec → oberagent → oberprompt → code-foundations)

During execution, all skills work together. Here's a checkpoint review subagent:

```
→ Task(Review: Phase 3 icon resolver)
  Prompt:
    First invoke the code-foundations skill.

    REVIEW TASK: Validate the Phase 3 bundle icon resolver implementation.

    FILE TO REVIEW: /Users/r/repos/theGrid/grid-server/Sources/GridPicker/main.swift

    Search for the bundle icon loading code (should be in IconRenderer or similar).

    CHECK FOR:
    1. Handles "bundle:" prefix correctly (checks hasPrefix, drops first 7 chars)
    2. Uses NSWorkspace.shared.urlForApplication(withBundleIdentifier:)
    3. Gets icon via NSWorkspace.shared.icon(forFile:) or equivalent
    4. Returns nil gracefully for unknown bundle IDs (no crash)
    5. Returns properly scaled NSImage

    RETURN FORMAT:
    VERDICT: [PASS | FAIL | NEEDS_REVISION]

    If FAIL/NEEDS_REVISION:
    ISSUES:
    - [file.swift:line] - [issue description]

    SUMMARY: [1-2 sentences]

  ❯ First invoke the code-foundations skill.
  Skill(code-foundations)
  Successfully loaded skill
  Search(pattern: "bundle:", path: "/Users/r/repos/theGrid/...")
```

**Skill Chain in Action:**
1. **oberplan** created the plan with this checkpoint
2. **oberexec** dispatched the review agent at the checkpoint
3. **oberagent** structured the prompt (outcome-focused, specific criteria)
4. **oberprompt** principles visible (minimal constraints, clear return format)
5. **code-foundations** invoked by subagent as first action

The subagent prompt demonstrates:
- Clear objective (REVIEW TASK)
- Specific scope (single file)
- Explicit check criteria (5 numbered points)
- Structured return format (VERDICT/ISSUES/SUMMARY)
- Skill inheritance ("First invoke the code-foundations skill")

---

## oberplan Workflow (v1.7.0)

```
1. Lens Selection
2. Requirements Clarification
3. Plan Construction
4. User Confirmation
5. Final Review
6. Plan Quality Review        ← Code review the plan itself
7. Save Plan to File          ← Persist for execution
8. Output
9. Generate Execution Prompt  ← oberprompt bootstrap for fresh context
10. Execution Handoff         ← Always fresh context (planning spent the context)
```

Key phases:
- **Plan Quality Review**: Review the plan like code before execution
- **Save Plan to File**: Persist at `~/.local/state/oberplan/plans/`
- **Generate Execution Prompt**: Use oberprompt to create a bootstrap prompt
- **Fresh Context Only**: No option to continue in current context

---

## When to Use This Pattern

Use this pattern when:
- Integrating multiple existing components
- Building CLI tools with system-level interactions
- Features requiring understanding of prior work
- Window management or focus-shifting functionality
