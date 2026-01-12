# Example: oberagent Code Review Dispatch

This example demonstrates oberagent validating and dispatching a code review subagent with multiple skills.

## Task Summary

**Request:** Review window picker implementation using code-foundations and pr-review-toolkit.

**Skills Used:**
- `oberagent` - Agent dispatch validation
- `code-foundations` - Code quality lens (passed to subagent)
- `pr-review-toolkit:code-reviewer` - Comprehensive code review

---

## Workflow

### Step 1: User Request

```
User: please kick off a oberagent subagent have them use pr-review code review
and code-foundations skills to review the current changes.

ultrathink
```

### Step 2: oberagent Skill Invocation

```
Claude: Skill(oberskills:oberagent)
  Successfully loaded skill
```

### Step 3: Checklist Validation

oberagent validates the dispatch before executing:

```
oberagent checklist:
┌─────┬───────────────────────────────────────────────────────────┬────────┐
│  #  │                           Check                           │ Status │
├─────┼───────────────────────────────────────────────────────────┼────────┤
│ 1   │ Purpose is OUTCOME: identify issues in window picker impl │ ✓      │
├─────┼───────────────────────────────────────────────────────────┼────────┤
│ 2   │ Agent type: general-purpose (code review)                 │ ✓      │
├─────┼───────────────────────────────────────────────────────────┼────────┤
│ 3   │ Skills: code-foundations, pr-review-toolkit:code-reviewer │ ✓      │
├─────┼───────────────────────────────────────────────────────────┼────────┤
│ 4   │ Prompt focused on outcome                                 │ ✓      │
├─────┼───────────────────────────────────────────────────────────┼────────┤
│ 5   │ No step-by-step HOW                                       │ ✓      │
├─────┼───────────────────────────────────────────────────────────┼────────┤
│ 6   │ Scope provided (files modified)                           │ ✓      │
└─────┴───────────────────────────────────────────────────────────┴────────┘
Dispatching code review agent.
```

**Key:** oberagent validates 6 criteria before dispatch:
1. **Purpose is OUTCOME** - What result, not how to achieve it
2. **Agent type appropriate** - Matches the task
3. **Skills specified** - Subagent knows which skills to invoke
4. **Outcome-focused prompt** - Describes what to produce
5. **No step-by-step HOW** - Trusts agent capability
6. **Scope provided** - Agent knows what files to examine

### Step 4: Agent Dispatch with Prompt

```
Task(Code review: window picker)
  Prompt:
    First invoke the code-foundations skill, then invoke the
    pr-review-toolkit:code-reviewer skill.

    Review the window picker implementation for code quality, bugs,
    style violations, and adherence to project patterns.

    FILES TO REVIEW:
    - /Users/r/repos/theGrid/grid-cli/cmd/grid/main.go
      (search for: pickCmd, pickWindowCmd, PickerItem, PickerResult,
       getAllWindows, windowsToPickerItems, findPickerExecutable,
       launchPicker, runPickWindow)
    - /Users/r/repos/theGrid/grid-server/Sources/GridPicker/main.swift
      (search for: loadFromBundle, bundle icon handling)

    Focus on: error handling, edge cases, code patterns, potential bugs,
    security issues.

    Return: VERDICT (PASS/ISSUES) with specific file:line references
    for any problems found.
```

**Prompt Analysis:**
- **Skill invocation explicit** - "First invoke the code-foundations skill, then..."
- **Outcome clear** - "Review... for code quality, bugs, style violations"
- **Scope specific** - File paths and function names to search for
- **Focus areas** - Error handling, edge cases, patterns, bugs, security
- **Return format** - VERDICT with file:line references

### Step 5: Subagent Execution

The subagent follows the prompt:

```
❯ First invoke the code-foundations skill, then invoke the
  pr-review-toolkit:code-reviewer skill.

Skill(code-foundations:code-foundations)
  Successfully loaded skill

Skill(pr-review-toolkit:review-pr)
  Successfully loaded skill · 5 tools allowed

Read(/Users/r/repos/theGrid/grid-cli/cmd/grid/main.go)
Read(/Users/r/repos/theGrid/grid-server/Sources/GridPicker/main.swift)
Bash(git diff --name-only main...HEAD)
```

**Subagent Actions:**
1. Loaded code-foundations skill (code quality lens)
2. Loaded pr-review-toolkit skill (5 review tools available)
3. Started reading the specified files
4. Ran git diff to understand scope of changes

---

## Key Patterns Demonstrated

### 1. Checklist Before Dispatch
oberagent doesn't just dispatch - it validates:
- Is the prompt outcome-focused?
- Are skills specified for the subagent?
- Is scope clear?

### 2. Skill Inheritance via Explicit Instruction
Subagents don't inherit skills automatically. The prompt must include:
```
First invoke the [skill] skill, then invoke the [skill] skill.
```

### 3. Outcome-Focused Prompting
The prompt describes WHAT to produce, not HOW:
- Good: "Review for code quality, bugs, style violations"
- Bad: "First read the file, then check line by line for..."

### 4. Specific Scope with Search Hints
Files are listed with function names to search for:
```
- /path/to/file.go (search for: funcA, funcB, funcC)
```
This helps the subagent find relevant code quickly.

### 5. Structured Return Format
```
Return: VERDICT (PASS/ISSUES) with specific file:line references
```
Ensures consistent, actionable output.

---

## When to Use This Pattern

Use oberagent + code-review dispatch when:
- Reviewing implementation after completing a feature
- Running quality checks before committing
- Validating code against project patterns
- Need comprehensive review combining multiple skills

Skip the full oberagent flow when:
- Simple single-file changes
- You're doing the review yourself inline
- Quick sanity checks (use direct tools instead)
