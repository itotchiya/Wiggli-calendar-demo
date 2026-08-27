---
name: token-efficiency
description: Guidelines and procedures for minimizing LLM context and input token consumption during tool calling, command execution, file inspection, and searching. Triggers when reading files, running terminal commands, searching code, or inspecting logs.
license: MIT
metadata:
  author: workspace
  version: "1.0.0"
---

# Token Efficiency & Context Economy Skill

This skill provides strict operational patterns to prevent context window bloat and keep LLM input tokens minimal across iterative agent workflows.

---

## 1. Core Principles

1. **Context is Finite & Shared**: Every token introduced into the conversation history is re-sent on every single subsequent tool call and turn.
2. **Filter Before Ingesting**: Always filter, paginate, or slice data *at the tool layer* before it returns into the prompt context.
3. **Never Ingest Generated/Vendor Files**: Never load lockfiles, build artifacts, or vendor trees into the context.

---

## 2. File Inspection Rules

| Action | ❌ Bad Practice (Token Heavy) | ✅ Good Practice (Token Efficient) |
| :--- | :--- | :--- |
| **Reading Files** | Viewing an entire 500+ line file with `view_file` | Read specific line ranges (e.g., lines `10-60` or `120-170`) using `StartLine` and `EndLine` |
| **Finding Code Symbols** | Reading entire files to locate a function | Use targeted `grep_search` with line numbers, then read only the target block |
| **Lockfiles & Bundles** | Reading `package-lock.json`, `pnpm-lock.yaml`, or `.next/` bundles | Inspect `package.json` only or run `npm list <package>` |
| **Log Files** | Reading entire `.log` files | Use `tail -n 50` or `grep "ERROR" file.log` |

---

## 3. Terminal & Shell Command Execution

When executing shell commands:

1. **Cap Output Length**:
   - For commands that may return extensive output, append output limiters:
     ```bash
     <command> | head -n 30
     # or
     <command> | tail -n 30
     ```
2. **Use Quiet/Silent Flags**:
   - `npm install --silent` or `npm test -- --silent`
   - `curl -s` or `curl -sS`
   - `git status -s` (short status)
   - `git log -n 5 --oneline` (instead of full git logs)
   - `git diff --stat` first before requesting targeted diffs
3. **Prevent Long Test/Build Logs in Context**:
   - If tests fail, run only the specific test file or filter by test name rather than running full test suites into the agent loop.

---

## 4. Directory & Codebase Search

1. **Always Exclude Noisy Directories**:
   - Exclude: `node_modules`, `.git`, `.next`, `dist`, `build`, `coverage`, `.turbo`, `.cache`.
2. **Use Bounded Search Depths**:
   - When listing files, use `MaxDepth: 2` or `MaxDepth: 3` rather than unbound recursive tree walks.
3. **Use Targeted Grep**:
   - Filter searches using file extensions (e.g., `Includes: ["*.ts", "*.tsx"]`).

---

## 5. Output & Reasoning Conciseness

1. **No Echoing**: Never repeat or mirror back entire file contents or large terminal outputs in the final response.
2. **Targeted Diffs**: Show only the changed lines/hunks rather than full file reproductions.
3. **Concise Explanations**: Keep step-by-step thinking tight and outcome-focused.
