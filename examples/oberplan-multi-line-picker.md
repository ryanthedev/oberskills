# Example: oberplan + code-foundations Multi-Line Picker Feature

This example demonstrates how oberplan orchestrates a feature implementation with code-foundations as a lens skill, using subagents with review checkpoints.

## Task Summary

**Request:** Add multi-line list items with icon support to a picker component.

**Skills Used:**
- `oberplan` - Meta-planning orchestration
- `code-foundations` - Code quality lens (passed to subagents)
- `oberagent` - Subagent dispatch enforcement

**Outcome:** One-shot implementation with 4 review checkpoints, completed in ~16 minutes.

---

## Workflow Phases

### Phase 1: Skill Invocation

```
User: ok, let's kick off code-foundations and oberplan...

Claude: I'll invoke the code-foundations and oberplan skills to approach this properly.
→ Skill(code-foundations)
→ Skill(oberplan)
```

**Key:** Both skills loaded upfront. code-foundations provides the development lens, oberplan provides the planning structure.

---

### Phase 2: Task Classification & Exploration

```
Claude: Let me classify this task and explore the codebase...

Task Classification: WRITE (adding new feature functionality)

→ Explore(Explore picker implementation)
  Done (44 tool uses · 58.8k tokens · 1m 13s)
```

**Key:** Before planning, Claude explored the codebase to understand:
- Current `PickerItem` struct (id, display, searchable[], metadata)
- AppKit-based implementation (NSView, not SwiftUI)
- Single-line items at 28pt height
- Custom `draw()` with `NSAttributedString` for match highlighting

---

### Phase 3: Requirements Clarification

oberplan guided clarifying questions:

```
Claude: For icon format detection, should the picker auto-detect the format
from the value, or should the CLI explicitly specify the format type?

User: Auto-detect (Recommended)

Claude: Which layout approach for multi-line items?
- Stacked (3 lines)
- Compact (2 lines)

User: Stacked (3 lines)
```

**Key:** Interactive mode - each decision confirmed before proceeding.

---

### Phase 4: Plan Construction with Checkpoints

Claude proposed the data model and execution structure:

```
Proposed Data Model

struct PickerItem: Codable {
    let id: String
    let title: String           // Primary text (was: display)
    let subtitle: String?       // Secondary line
    let preview: String?        // Third line excerpt
    let icon: String?           // emoji | file path | data:base64 | <svg>
    let searchable: [String]?
    let metadata: [String: String]?

    var display: String { title }  // Backwards compat
}

Icon Auto-Detection Logic:
┌──────────────────────────────────┬─────────────────┐
│             Pattern              │      Type       │
├──────────────────────────────────┼─────────────────┤
│ Single grapheme cluster (🔥, 📁) │ Emoji           │
│ Starts with / or ~ or ./         │ File path       │
│ Starts with data:image/          │ Base64 data URL │
│ Starts with <svg                 │ Inline SVG      │
│ Ends with .svg, .png, .jpg       │ File path       │
└──────────────────────────────────┴─────────────────┘
```

**Execution Flow with Review Checkpoints:**

```
┌─────────────────────────────────────────────────────────────┐
│ Phase 1: Data Model                                         │
│   Task 1: Extend PickerItem (subagent)                      │
│   ──► REVIEW CHECKPOINT 1 (you review, I apply feedback)    │
├─────────────────────────────────────────────────────────────┤
│ Phase 2: Icon Rendering                                     │
│   Task 2: IconRenderer (subagent)                           │
│   ──► REVIEW CHECKPOINT 2                                   │
├─────────────────────────────────────────────────────────────┤
│ Phase 3: UI Components (parallel)                           │
│   Task 3: ListItemView (subagent)  ─┬─► wait for both       │
│   Task 4: ListView (subagent)      ─┘                       │
│   ──► REVIEW CHECKPOINT 3                                   │
├─────────────────────────────────────────────────────────────┤
│ Phase 4: Integration                                        │
│   Task 5: FuzzyMatcher (subagent)                           │
│   Task 6: PickerWindow (subagent)                           │
│   ──► REVIEW CHECKPOINT 4                                   │
├─────────────────────────────────────────────────────────────┤
│ Phase 5: Testing                                            │
│   Task 7: Integration test                                  │
└─────────────────────────────────────────────────────────────┘
```

**User Intervention:**
```
User: I would like for you to add some code review checkpoint points. You
should also be executing these tasks in subagents using oberagent. Make sure
to tell those subagents to use code-foundations for the code review and when
executing the tasks.
```

**Key:** User requested explicit review checkpoints and skill inheritance for subagents.

---

### Phase 5: oberagent Dispatch

Claude invoked oberagent to set up proper subagent dispatch:

```
Claude: Let me invoke oberagent to set up proper subagent dispatch with
code review checkpoints.

→ Skill(oberagent)

Subagent Prompt Template:

Each subagent will receive:
- First invoke the code-foundations skill. Task type: WRITE.
- [OUTCOME]: <specific deliverable>
- [FILES]: grid-server/Sources/GridPicker/main.swift
- [SUCCESS]: <how to verify completion>
```

**Key:** oberagent enforces:
1. Skill inheritance - subagents explicitly told to invoke code-foundations
2. Outcome-focused prompts - describe WHAT not HOW
3. Validation criteria - how to verify success

---

### Phase 6: Execution with Review Checkpoints

**Task 1 Execution:**
```
→ Task(Extend PickerItem data model)
  Done (15 tool uses · 44.1k tokens · 3m 16s)

Claude: Build succeeds. Review Checkpoint 1: Data Model Review

┌────────────────────────────────────────┬──────────────────────────────────────────────┐
│                 Aspect                 │                    Status                    │
├────────────────────────────────────────┼──────────────────────────────────────────────┤
│ Naming conventions (clear, no abbrevs) │ ✓ title, subtitle, preview, icon             │
│ Optionality correct                    │ ✓ Only title required, rest optional         │
│ Backwards compat                       │ ✓ Old JSON with display still works          │
│ Search integration                     │ ✓ allSearchableText includes all text fields │
│ Build passes                           │ ✓ No errors                                  │
└────────────────────────────────────────┴──────────────────────────────────────────────┘

User: Approved, continue
```

**Task 2 Execution:**
```
→ Task(Implement IconRenderer)
  Done (6 tool uses · 46.7k tokens · 1m 21s)

Claude: Review Checkpoint 2: Icon Rendering Review

Format Detection Order:
1. data:image/ prefix → Base64 data URL
2. <svg or <?xml prefix → Inline SVG
3. Path patterns → File path
4. Single grapheme or emoji ranges → Emoji render

User: Approved, continue
```

**Tasks 3 & 4 (Parallel Execution):**
```
→ 2 Task agents finished
   ├─ Update ListItemView multi-line · 21 tool uses · 66.1k tokens
   │  Done
   └─ Update ListView dynamic heights · 21 tool uses · 57.9k tokens
      Done

Claude: Review Checkpoint 3: UI Components Review

ListItemView Layout Constants:
- Vertical padding: 8pt each
- Title line: 20pt, Subtitle: 18pt, Preview: 16pt
- Icon column: 40pt (when shown)

User: Approved, continue
```

**Tasks 5 & 6 (Parallel Execution):**
```
→ 2 Task agents finished
   ├─ Extend FuzzyMatcher scoring · 12 tool uses · 52.6k tokens
   │  Done
   └─ Update PickerWindow layout · 27 tool uses · 62.7k tokens
      Done

Claude: Review Checkpoint 4: Full Integration Review

FuzzyMatcher Weighted Scoring:
- title: 100% weight
- subtitle: 70% weight
- preview: 50% weight

User: Approved, test it
```

**Key:** Each checkpoint presented a structured review with verification status before continuing.

---

### Phase 7: Integration Testing

```
→ Bash(make picker && cp grid-picker ~/.local/bin/)
→ Write(/tmp/picker-test-items.json)

# Test data included:
- Items with emoji icons (📄)
- Items with file path icons (/path/to/icon.png)
- Items with SVG icons
- Items with no icons (to test column collapse)
- Items with only title (backwards compat)
- Items with title + subtitle only

→ Bash(cat /tmp/picker-test-items.json | grid-picker --prompt "Select a file:")

Output: {"display":"FileName1.txt","icon":"📄","id":"1",...}

User: Looks good!
```

---

## Final Summary

```
Implementation Complete

Summary of Changes:
┌──────────────┬─────────┬───────────────────────────────────────────────────────────────────┐
│  Component   │  Lines  │                            Description                            │
├──────────────┼─────────┼───────────────────────────────────────────────────────────────────┤
│ PickerItem   │ 23-120  │ Added title, subtitle, preview, icon fields with backwards compat │
│ IconRenderer │ 122-331 │ Auto-detect format: emoji, file, base64, SVG with caching         │
│ ListItemView │ 585-736 │ Multi-line rendering (36-70pt height), icon support               │
│ ListView     │ 741-814 │ Variable height stacking, icon column detection                   │
│ FuzzyMatcher │ 350-449 │ Weighted scoring: title 100%, subtitle 70%, preview 50%           │
│ PickerState  │ 550-665 │ Height-based scrolling (500pt max), visibleResults calculation    │
└──────────────┴─────────┴───────────────────────────────────────────────────────────────────┘

Total time: 16m 10s
```

---

## Key Patterns Demonstrated

### 1. Skill Composition
oberplan + code-foundations work together:
- oberplan provides planning structure and checkpoint enforcement
- code-foundations provides the development lens for quality

### 2. Skill Inheritance for Subagents
```
Each subagent prompt includes:
"First invoke the code-foundations skill. Task type: WRITE."
```
Subagents don't inherit skill awareness - must be explicitly passed.

### 3. Review Checkpoints
Each phase ends with a structured review:
- Verification checklist with status
- User approval required before proceeding
- Opportunity to catch issues early

### 4. Parallel Execution
Independent tasks dispatched together:
```
→ 2 Task agents finished
   ├─ ListItemView
   └─ ListView
```
Reduces total time by running non-dependent work concurrently.

### 5. Progressive Disclosure
Plan developed iteratively:
1. Understanding confirmed
2. Approach confirmed
3. Task breakdown confirmed
4. User requested checkpoints
5. Plan revised with checkpoints
6. Execution with reviews

---

## When to Use This Pattern

Use oberplan + code-foundations + oberagent when:
- Implementing a non-trivial feature
- Multiple components need to change
- Code quality is important
- You want structured review points
- Subagents will do the implementation work

Skip the full workflow when:
- Single-file, single-function changes
- Trivial bug fixes
- User has given explicit step-by-step instructions
