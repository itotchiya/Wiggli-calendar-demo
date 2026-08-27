<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

---

# Token Efficiency & Context Economy Rules

All AI agents (Hermes, Claude, etc.) working in this repository MUST follow these rules to avoid context window bloat and unnecessary OpenRouter token consumption:

## 1. File Inspection
- **Do not read entire large files**: Use line range slices (e.g., `StartLine` / `EndLine`) or grep for specific symbol declarations.
- **Never dump lockfiles or build artifacts into context**: Never read `package-lock.json`, `.next/*`, or compiled bundles. Inspect `package.json` only.
- **Targeted edits**: When editing files, replace only the specific targeted blocks rather than rewriting whole files.

## 2. Terminal Commands
- **Bound command output**: Always pipe potentially long outputs (e.g., `npm test`, `git log`, `find`) through `head -n 30` or `tail -n 30`.
- **Use quiet / concise flags**:
  - `npm install --silent` / `npm test -- --silent`
  - `git status -s`
  - `git log -n 5 --oneline`
  - `curl -s`

## 3. Directory Listings & Searches
- **Exclude heavy directories**: Always exclude `node_modules`, `.next`, `.git`, `dist`, and `build` from recursive search commands (`grep`, `find`, `fd`).
- **Use shallow directory listings**: Keep directory traversal bounded with max depth 2–3.

## 4. Response Conciseness
- Avoid echoing full file contents or large terminal logs in your final answer.
- Present concise diffs, summaries, and precise explanations.
