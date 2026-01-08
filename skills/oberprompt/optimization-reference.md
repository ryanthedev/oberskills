# Prompt Optimization Reference

Heavy reference for automatic and manual prompt optimization techniques. See SKILL.md for when to use.

## Automatic Prompt Optimization (APO) Framework

### Phase 1: Initialize Seed Prompts

**Manual Instructions:**
- Expert-created prompts
- Few hundred samples sufficient for APE-style optimization
- Start with working baseline, not blank slate

**Instruction Induction via LLM:**
```
Given these input/output examples:
[examples]
What instruction would produce these outputs from these inputs?
```

### Phase 2: Inference Evaluation & Feedback

**Numeric Scoring:**
- Accuracy on validation set
- Reward model scores (if available)
- Negative log-likelihood
- Custom metrics (BLEU, ROUGE-L, BERTScore)

**LLM Feedback Methods:**

*Single candidate improvement (SCULPT, PACE):*
```
Here is a prompt and its failure cases:
Prompt: [prompt]
Failures: [examples where it failed]
Suggest improvements to fix these failures.
```

*Multiple candidate comparison (ProTeGi):*
```
Compare these prompt variants on the task:
[variant1] - Score: X, Failures: [list]
[variant2] - Score: Y, Failures: [list]
Which elements work best? Synthesize an improved version.
```

### Phase 3: Candidate Generation

**Heuristic Edits:**
- Monte Carlo sampling (ProTeGi)
- Genetic algorithms (SPRIG, CLAPS)
- Word/phrase replacement (COPLE)
- Vocabulary pruning

**Metaprompt Design (OPRO, DAPO):**
```
You are a prompt optimizer. Given this task description and current prompt:
Task: [description]
Current: [prompt]
Performance: [metrics]

Generate 5 improved variants that might perform better.
```

**Token-Level Mutations:**
Research shows token-level mutations outperform coarser (sentence/paragraph) approaches.

### Phase 4: Filter & Retain

**Selection Strategies:**
- TopK greedy (simple, fast)
- Upper Confidence Bound (exploration/exploitation balance)
- Region-based joint search (for multi-prompt systems)
- Metaheuristic ensembles (combine multiple strategies)

### Phase 5: Iteration

**Fixed Steps:** 10-50 iterations typical
**Variable Stopping:** When improvement < patience threshold (e.g., <0.5% gain for 3 iterations)

## DEEVO: Debate-Driven Evolution

For tasks without ground truth labels (creative writing, subjective quality):

```
Phase 1: Generate population of prompts (10 initial)
Phase 2: Pairwise debate
  - Two LLMs argue for/against each prompt variant
  - Third LLM judges based on debate traces
Phase 3: Elo rating calculation
Phase 4: Tournament selection for next generation
Phase 5: Intelligent crossover using debate traces
Phase 6: Strategic mutation (Elo-based)
Repeat for 5 generations, mutation rate 0.4
```

Results: 83.7% on ABCD (vs 77.3% standard optimization)

## EMPOWER: Medical Domain Optimization

For safety-critical domains requiring domain expertise:

```
Components:
1. Medical terminology attention mechanism
2. Multi-dimensional assessment:
   - Structural clarity
   - Domain specificity
   - Factual accuracy
   - Error risk score
3. Structure-preserving evolutionary algorithm
4. Specialized crossover (preserve medical accuracy)
5. Specialized mutation (domain-aware)
```

Results: 24.7% reduction in factually incorrect content

## Compression Techniques

### Method Comparison

| Method | Latency | Memory | Best Context | Hallucination Risk |
|--------|---------|--------|--------------|-------------------|
| SCRL | 67ms | 315MB | Short | Moderate |
| LLMLingua | 180ms | 5309MB | Medium | Moderate |
| LongLLMLingua | 200ms | 5500MB | Long | Lower |
| LLMLingua-2 | 150ms | 4800MB | Long | Lower |
| Selective Context | 50ms | 200MB | Short | Higher |

### Key Insights

1. **Moderate compression can improve performance** on long contexts (>8k tokens)
2. **"Unimportant" words matter** - articles, connectives critical for long-context coherence
3. **Text-based methods don't transfer to multimodal** - VQA needs specialized compression
4. **GPT models produce longer outputs** under compression (compensating for info loss)
5. **Claude produces shorter outputs** under compression

### Compression Decision Tree

```
Context < 4k tokens → No compression
Context 4k-16k → Test with/without LLMLingua
Context > 16k → Use LongLLMLingua, test compression ratios
VQA/Multimodal → Don't use text compression
```

## Calibration Optimization

### The Confidence Problem

No model achieves both Brier < 0.25 AND AUC-ROC > 0.7 consistently.

### Calibration Techniques

**Temperature Scaling:**
- Lower T (0.0-0.3): More deterministic, often overconfident
- Medium T (0.3-0.7): Best calibration with few-shot
- Higher T (0.7-1.0): More variance, less reliable confidence

**Dual Optimization Framework:**
1. Optimize prompt for accuracy (standard optimization)
2. Apply post-hoc calibration (Platt scaling, isotonic regression)
3. Validate calibration on held-out set

**Warning Signs:**
- Model consistently reports 80%+ confidence
- Confidence doesn't correlate with accuracy
- "I'm certain" language regardless of task difficulty

### Task-Specific Calibration

| Domain | Acceptable Calibration | Required Post-Hoc |
|--------|----------------------|-------------------|
| Medical diagnosis | Brier < 0.15 | Always |
| Legal analysis | Brier < 0.20 | Always |
| Code generation | Brier < 0.25 | Recommended |
| Creative writing | N/A | Not needed |
| General QA | Brier < 0.30 | Optional |

## Structured Prompting with DSPy

### Basic Template

```python
import dspy

class TaskSignature(dspy.Signature):
    """Task description here."""
    input_field = dspy.InputField(desc="Input description")
    output_field = dspy.OutputField(desc="Output description")

predictor = dspy.Predict(TaskSignature)
```

### Optimization with MIPRO

```python
from dspy.teleprompt import MIPRO

optimizer = MIPRO(
    metric=your_metric_function,
    num_candidates=10,
    init_temperature=0.7
)

optimized = optimizer.compile(
    your_module,
    trainset=train_examples,
    num_trials=50
)
```

### When to Use DSPy

- Reproducible benchmarks required
- Complex multi-step pipelines
- Need to compare model capabilities fairly
- Systematic prompt optimization at scale

## Conversation Routines (Multi-Turn)

### State Reconstruction Pattern

```xml
<conversation_state>
  <identity>Role and capabilities</identity>
  <workflow_position>Current step in multi-step process</workflow_position>
  <collected_info>
    <field name="x">value</field>
    <field name="y">value</field>
  </collected_info>
  <pending_actions>What needs to happen next</pending_actions>
</conversation_state>
```

### Benefits

- Linear token growth (944→3434 tokens in 14 turns vs exponential)
- 73% token reduction vs full history
- Excellent context maintenance
- 14.1% QA improvement

### Implementation

1. After each turn, extract key state changes
2. Reconstruct minimal state representation
3. Include explicit "history remind" for critical past decisions
4. Discard verbose intermediate exchanges

## Jailbreak Defense

### Vulnerability Patterns

| Category | Attack Success Rate | Defense Priority |
|----------|--------------------| -----------------|
| Illegal substances | 100% | Critical |
| Cybersecurity | 93% | Critical |
| Fraud | 87.8% | High |
| General harmful | 66-81% | High |

### Defense Strategies

1. **Golden Dataset Anchoring** - Include 20% human-verified safe examples
2. **Human-in-the-Loop Meta-Auditing** - Regular human review of edge cases
3. **Layered constraints** - Multiple independent safety checks
4. **Output validation** - Post-generation filtering

## Research Paper Quick Reference

| Paper ID | Topic | Key Finding |
|----------|-------|-------------|
| 2503.20561 | Theory | Token length O(ε^(-p/(2β))) for approximation |
| 2510.22251 | Inversion | Constraints harm advanced models |
| 2502.16923 | Sensitivity | Semantic similarity ≠ performance similarity |
| 2501.09804 | CoT Transfer | PRADA enables CoT in smaller models |
| 2511.20836 | Evaluation | Fixed prompts underestimate by 4% |
| 2504.18722 | MODP | 26% summarization gain |
| 2508.17703 | EMPOWER | 24.7% factual error reduction |
| 2506.00178 | DEEVO | 83.7% without ground truth |
| 2505.00019 | Compression | Moderate compression improves long-context |
| 2506.00072 | Calibration | CoT amplifies overconfidence |
| 2509.17766 | Multi-turn | 59.4% token reduction |
| 2512.15053 | Meta-Prompting | Adversarial trinity pattern |
