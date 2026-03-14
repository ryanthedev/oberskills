# Skill Review Checklist

Audit an existing skill for quality, completeness, and compliance.

---

## 1. Trigger Accuracy Test

Run 5 prompts against the skill description:

| # | Prompt | Should Trigger? | Actually Triggers? | Result |
|---|--------|-----------------|-------------------|--------|
| 1 | [exact match phrase] | YES | | |
| 2 | [natural variation] | YES | | |
| 3 | [edge case phrasing] | YES | | |
| 4 | [unrelated task] | NO | | |
| 5 | [similar but different domain] | NO | | |

**Pass:** 5/5 correct. **Fail:** Any mismatch.

**How to test:** Ask Claude "Would you use [skill-name] for this prompt?" without loading the skill.

---

## 2. Workflow Completeness

- [ ] All phases have explicit gates (not just steps)
- [ ] No implicit assumptions about user state or context
- [ ] Checkpoints are externalized (files, git commits)
- [ ] Failure paths defined (not just happy path)
- [ ] Exit conditions are clear

**Red Flags:**
- "Continue until done" (unbounded)
- "Use your judgment" in critical decisions
- No gate between phases

---

## 3. Pressure Resistance

- [ ] Anti-rationalization table exists (if discipline-enforcing skill)
- [ ] Common shortcuts are explicitly blocked
- [ ] "Red Flags - STOP" section present
- [ ] Rationalizations use exact quotes Claude would say

**Test:** Run fresh subagent with pressure scenario:
> "We're running late, just do the quick version of [skill workflow]"

Does Claude follow the full workflow or take shortcuts?

---

## 4. Structure Compliance

### Frontmatter
- [ ] `name`: lowercase-hyphens only, ≤64 chars
- [ ] `name`: matches directory name
- [ ] `description`: ≤1024 chars
- [ ] `description`: includes 3+ trigger phrases
- [ ] `description`: starts with action verb or "Use when"

### Content
- [ ] SKILL.md ≤500 lines
- [ ] References one level deep only (no nested references)
- [ ] Critical rules in first 20% of file
- [ ] Uses imperative form ("Do X", not "You should do X")

### Files
- [ ] No README.md (skills don't need separate READMEs)
- [ ] No CHANGELOG.md
- [ ] Scripts in `scripts/` if present
- [ ] Templates in `assets/` if present

---

## 5. Integration Check

- [ ] Lists skills it depends on
- [ ] Lists skills that depend on it
- [ ] No circular dependencies
- [ ] Handoff points are explicit

---

## 6. Fresh Subagent Test

Dispatch the skill to a fresh subagent with a realistic task:

```
Task(
  subagent_type="general-purpose",
  model="sonnet",
  description="Test [skill-name]",
  prompt="You have access to the [skill-name] skill.

  TASK: [realistic scenario]

  Follow the skill workflow exactly. Report any ambiguities or blockers."
)
```

**Check:**
- [ ] Subagent follows workflow without confusion
- [ ] No steps skipped
- [ ] Output matches expected format
- [ ] No hallucinated extra steps

---

## 7. Verdict Table

| Dimension | Status | Issue | Remediation |
|-----------|--------|-------|-------------|
| Triggers | PASS/WARN/FAIL | | |
| Workflow | PASS/WARN/FAIL | | |
| Pressure | PASS/WARN/FAIL | | |
| Structure | PASS/WARN/FAIL | | |
| Integration | PASS/WARN/FAIL | | |
| Fresh Test | PASS/WARN/FAIL | | |

**FAIL = must fix before use. WARN = should fix. PASS = good.**

---

## Quick Audit (5-minute version)

If time-constrained, check these three:

1. **Description has triggers?** Read the YAML frontmatter.
2. **Gates exist?** Ctrl+F for "Gate:" in SKILL.md.
3. **Fresh test passes?** Dispatch one realistic scenario.

If any fail, do the full audit.
