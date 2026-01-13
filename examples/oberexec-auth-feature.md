# Example: oberexec Auth Feature Execution

Checklist-driven execution of a 2-phase auth feature plan.

## Question

> "Execute the auth feature plan"

## Result

```
CHECKLIST GENERATED:
~/.local/state/oberexec/myapp-auth-20240115.md

# Execution: Auth Feature
Source: ~/.local/state/oberplan/plans/myapp-auth-20240115.md
Started: 2024-01-15T10:30:00Z
Status: IN_PROGRESS

## Checklist

- [ ] 1.1 Identify skills for Phase 1
- [ ] 1.2 Invoke oberagent for implementation
- [ ] 1.3 Dispatch agent: auth service
- [ ] 1.4 Verify file list
- [ ] 1.5 Invoke oberagent for review
- [ ] 1.6 Dispatch code review
- [ ] 1.7 Handle verdict
- [ ] 1.8 Git commit checkpoint
- [ ] 2.1 Identify skills for Phase 2
...

EXECUTION:

[10:30:05] 1.1 COMPLETE - skills: code-foundations
[10:30:10] 1.2 COMPLETE - oberagent validated prompt
[10:30:45] 1.3 COMPLETE - FILES: src/auth/service.ts, types.ts
[10:30:50] 1.4 COMPLETE - verified 2 files
[10:31:00] 1.5 COMPLETE - oberagent validated review prompt
[10:31:30] 1.6 COMPLETE - VERDICT: PASS
[10:31:32] 1.7 COMPLETE - proceeding
[10:31:40] 1.8 COMPLETE - commit abc1234
[10:31:45] 2.1 STARTED...

FINAL STATUS:
Status: COMPLETED
All phases passed code review.
Final commit: def5678
```

## Key Features

| Feature | Benefit |
|---------|---------|
| Persistent checklist file | Survives context resets |
| oberagent before every dispatch | Prompt quality enforced |
| Code review after each phase | Catches issues early |
| Git commits at checkpoints | Easy rollback if needed |
