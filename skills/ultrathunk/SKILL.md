---
name: ultrathunk
description: Deep thinking mode - launches agents for git context, log analysis, and project structure before tackling complex tasks
---

# Ultrathunk

Use your skills and MCP tools to help with this task.

## Step 1: Gather Context via Agents (run in parallel)

Launch these Explore agents to understand the current state:

### 1. Git History Agent
Analyze the last 10-20 commits to understand what's been worked on, patterns in the changes, and the current state of development. Also review any staged/unstaged changes to understand work in progress.

### 2. Log Files Agent
First, check project reference files to find where logs are stored:
- Look for config files (e.g., `.env`, `config/`, `settings.*`)
- Check README or docs for logging configuration
- Search for common log patterns: `logs/`, `*.log`, `log/`, `tmp/`

Then analyze recent log entries for errors, warnings, or relevant context for the task.

### 3. Project Structure Agent
Understand the project layout by checking:
- README, CLAUDE.md, or similar reference files
- Package/dependency files (package.json, Cargo.toml, pyproject.toml, etc.)
- Directory structure and key entry points

## Step 2: Apply Your Skills

Check if any skills are relevant to this task and use them. Consider using the sequential-thinking MCP tool if the problem is complex and would benefit from methodical step-by-step reasoning.

## Step 3: Execute the Task

With context gathered and skills applied, proceed to execute the user's request.
