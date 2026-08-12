# Workspace Rules & Guidelines

## Git & Deployment Controls
- **NEVER execute `git push` without explicit user permission**: Do not push any commits or branches to remote repositories (`git push`, `git push origin main`, etc.) unless the user explicitly requests or approves a push in the conversation.
- **Local Commits & Verification Only**: Always perform local testing, compilation checks (`npx tsc --noEmit`), and local commits (`git add` / `git commit`), then ask for explicit user permission before executing `git push`.
