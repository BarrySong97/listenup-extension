# Git Commit Command

## Description
Help users create appropriate git commits based on current conversation content and git status.

## Usage
```
/git-commit
```

## Instructions
When user uses this command, follow these steps:

1. **Check git status**:
   - Run `git status` to see modified files
   - Run `git diff` to see specific changes
   - Run `git log --oneline -5` to see recent commit message format

2. **Analyze modifications**:
   - Understand the purpose of changes based on current conversation
   - Identify affected functional modules
   - Determine change type (feat, fix, refactor, style, etc.)

3. **Generate commit message**:
   - Use conventional commit format: `type(scope): description`
   - Ensure message is concise and accurately reflects changes
   - Add detailed commit body if necessary

4. **Execute commit**:
   - Run `git add -A` to add all changes
   - Create commit with generated message
   - Confirm commit success

## Examples
- `feat(dropdown): implement framer-motion based dropdown component`
- `fix(shadow-dom): fix Button event compatibility in Shadow DOM`
- `refactor(ui): refactor subtitle copy functionality using HeroUI Listbox`

## Notes
- Reference existing commit message format in the project
- Use Chinese descriptions to maintain project consistency
- Ensure commit message clearly expresses business value of changes