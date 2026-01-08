## Pull Request Instructions

### Purpose

- Every PR MUST clearly state why the change exists.
- Reviewers must understand intent without opening code.

### Required PR Template

- The canonical PR template is located at: `.github/pull_request_template.md`

### PR Rules

- One PR = one logical goal
- Do NOT paste commit logs
- Do NOT submit unexplained large diffs
- Avoid vague words (“refactor”, “cleanup”) without context

## Commit Message Instructions

### Commit Rules

- One commit = one logical change
- Describe intent, not result

### Commit Message Format

Conventional Commits REQUIRED:

```
<type>(scope): <subject>

<body>
```

`<type>` should be one of below:

- `feat`
- `fix`
- `refactor`
- `perf`
- `test`
- `docs`
- `chore`
- `cicd`

`<subject>` rules:

- Max 50 characters
- No period
- Imperative verb

#### Examples

```
feat(auth): Add refresh token rotation

fix(api): Prevent duplicate request on retry

refactor(ui): Extract search result renderer
```

`<body>` rules (Optional but Recommended):

- Explain why, not what
- Mention constraints or side effects

## Responsibility Separation

- **PR:** intent, design, impact
- **Commit:** atomic change, traceability
