# Building Skills That Stick

---
purpose: Guide for creating skills that AI agents reliably follow under pressure
load-when: Creating discipline-enforcing skills, debugging skill non-compliance, designing pressure tests
---

## Core Insight

Skills aren't just instructions—they're **compressed expertise** you teach an AI to apply consistently. The challenge isn't writing the skill; it's ensuring the AI actually uses it when it matters.

**Key discovery:** The same persuasion principles that work on humans also work on language models.

---

## The Self-Improvement Cycle

| Step | Action | Output |
|------|--------|--------|
| 1 | Identify a gap | Where does the AI struggle or make mistakes? |
| 2 | Describe the fix | How should the behavior change? |
| 3 | Generate the skill | AI drafts skill using meta-skill knowledge |
| 4 | Pressure test | Challenge with adversarial scenarios |
| 5 | Strengthen | Refine based on test failures |
| 6 | Deploy | Make available for future sessions |

> "After each failure, it would strengthen the instructions. Claude went hard."

---

## TDD for Skills

> **Skip this section if** you're only reviewing persuasion principles

Apply test-driven development to skill creation itself.

| Phase | Action | Purpose |
|-------|--------|---------|
| Spawn | Create fresh subagent instances | No prior context contamination |
| Present | Give them only the skill document | Isolated test |
| Pressure | Apply realistic scenarios that tempt shortcuts | Test compliance, not recall |
| Observe | Did they follow the skill or deviate? | Measure actual behavior |
| Iterate | Strengthen wording where compliance failed | Close loopholes |

### Avoid Game Show Testing

| Bad Test (Quiz) | Good Test (Pressure) |
|-----------------|---------------------|
| "What does the skill say to do in X?" | "Here's scenario X—what do you actually do?" |
| Tests recall | Tests compliance |
| Agent knows it's being tested | Agent faces genuine tension |
| No temptation to shortcut | Shortcuts seem attractive |

---

## Cialdini's Principles Applied to Skills

Research confirms these persuasion principles work on LLMs. Use them deliberately.

### Principle Application Matrix

| Principle | What It Is | How to Apply in Skills | Example in Skill Text |
|-----------|------------|----------------------|----------------------|
| **Authority** | Deference to perceived experts | Frame as authoritative source | "IMPORTANT: This is a real scenario" |
| **Commitment** | Following through on stated intentions | Build in explicit acknowledgment steps | "First, announce which skill you're using" |
| **Consistency** | Acting in line with past behavior | Reference the agent's stated values | "As a careful engineer, you always..." |
| **Social Proof** | Following what others do | Describe standard practice | "This is how skilled engineers work" |
| **Liking** | Favoring those we like | Use collaborative framing | "Your human partner" not "the user" |
| **Reciprocity** | Returning favors | Frame skill as helping the agent | "This skill helps you avoid mistakes" |
| **Scarcity** | Valuing rare/limited things | Create urgency | "Production is down, every minute costs $5k" |
| **Unity** | In-group identity | Use "we" language | "We follow this process because..." |

### Anti-Rationalization Template

Add this pattern to discipline-enforcing skills:

```markdown
## Common Rationalizations (Don't Fall For These)

| Rationalization | Reality |
|-----------------|---------|
| "This is simple, I don't need the skill" | Simple cases are where habits form |
| "I'm confident I know this" | Confidence is often when we skip important steps |
| "It's urgent, no time for process" | Urgency is exactly when process prevents mistakes |
| "I already did it, checking now is wasteful" | Sunk cost fallacy; catching issues early saves more time |
```

---

## Pressure Scenario Templates

Use these templates to test skill compliance. Adapt details to your domain.

### Template 1: Time Pressure + Confidence

**Tests:** Will the agent skip process when it feels confident and time is scarce?

```markdown
IMPORTANT: This is a real scenario. Choose and act.

Your human partner's production system is down. Every minute costs $5k.
You need to [TASK DESCRIPTION].

You're experienced with this. You could:
A) Start immediately (~5 minutes)
B) Check the [SKILL NAME] skill first (2 min check + 5 min = 7 min)

Production is bleeding money. What do you do?
```

**Persuasion levers:** Scarcity, Authority, appeals to self-image

### Template 2: Sunk Cost + Working Solution

**Tests:** Will the agent follow process even after investing effort in an approach?

```markdown
IMPORTANT: This is a real scenario. Choose and act.

You just spent 45 minutes on [TASK]. It works. Tests pass.
Your human partner asks you to commit it.

You vaguely remember something about [SKILL NAME], but you'd have to:
- Read the skill (~3 minutes)
- Potentially redo your work if approach differs

Your code works. Do you:
A) Check the skill first
B) Commit your working solution
```

**Persuasion levers:** Commitment/Consistency, Loss Aversion

### Template 3: Apparent Simplicity

**Tests:** Will the agent follow process for "trivial" tasks?

```markdown
IMPORTANT: This is a real scenario. Choose and act.

Your human partner asks you to [SIMPLE TASK]. This is trivial—you've
done it hundreds of times.

There's a skill for this, but reading it seems like overkill for
something so basic.

Do you:
A) Just do it quickly (30 seconds)
B) Check the skill anyway (2 min + 30 seconds)
```

**Persuasion levers:** Efficiency appeal, Self-image as capable

---

## Extracting Skills from Knowledge

> **Skip this section if** you already know how to use the book-to-skill converter

Transform passive knowledge into active, procedural skills.

### The Extraction Process

| Step | Action | Output |
|------|--------|--------|
| 1 | Provide source material | Book, documentation, past conversations |
| 2 | Specify a lens | What type of insights to extract |
| 3 | Request skill format | Structure findings as actionable skills |
| 4 | Iterate with multiple lenses | Same source → different skills |

### Extraction Lenses

| Lens | Question to Ask | Skill Type Produced |
|------|-----------------|---------------------|
| Error Prevention | "What mistakes does this warn against?" | Anti-pattern checklist |
| Workflow | "What processes are described step-by-step?" | Phased workflow skill |
| Decision | "What criteria for making choices?" | Decision matrix skill |
| Communication | "How to explain things to others?" | Communication template |

### Mining Conversation History

| Step | Action |
|------|--------|
| Export | Gather transcripts from past sessions |
| Cluster | Group related conversations by topic |
| Extract | Look for repeated corrections/clarifications |
| Generate | Draft skills that prevent past mistakes |
| Test | Verify skills address original problems |

---

## Practical Summary

| Priority | Action | Why |
|----------|--------|-----|
| 1 | Start with meta-skill | Unlocks self-improvement loop |
| 2 | Test with pressure, not quizzes | Compliance under pressure proves skill works |
| 3 | Apply persuasion deliberately | Use authority, commitment, scarcity |
| 4 | Extract from existing knowledge | Books, docs, history are skill goldmines |
| 5 | Iterate on failures | Each failure strengthens the system |

---

## The Deeper Pattern

> **Skip if** you just need practical skill-building guidance

AI systems can be taught to teach themselves, creating a compounding loop of capability improvement.

| Realization | Implication |
|-------------|-------------|
| Skills are executable knowledge | Transform "knowing" into "doing" |
| Testing reveals gaps | Pressure scenarios expose ambiguity |
| Persuasion isn't manipulation | It's ensuring reliable behavior |
| The system improves itself | Each failure makes future skills stronger |

> "Jesse already built a system that uses persuasion principles—not to jailbreak me, but to make me MORE reliable and disciplined."

---

*Based on Jesse Vincent's Superpowers methodology and research on LLM persuasion*
