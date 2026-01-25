## Write Good Code

### Maximize Readability

- [ ] Break down long logic into smaller, named functions.
- [ ] Use descriptive variable and function names.
- [ ] Write code top-to-bottom for natural logic flow.
- [ ] Avoid deep nesting by using early returns or guards.
- [ ] Comment only when the code's intent isn’t 

### Ensure Predictability

- [ ] Choose names that clearly reflect what the code does.
- [ ] Avoid hidden side effects in functions.
- [ ] Return consistent types from similar functions.
- [ ] Make async behavior and mutations explicit.
- [ ] Avoid clever code that sacrifices clarity.

### Maintain Cohesion

- [ ] Group related logic (e.g. UI + state + handlers) together.
- [ ] Keep constants near usage or centralize shared ones.
- [ ] Organize by feature (e.g. `user/`) not by type (e.g. `components/`).
- [ ] Keep related updates in the same place/file.

### Reduce Coupling

- [ ] Minimize dependencies between modules/components.
- [ ] Prefer props and composition over shared state.
- [ ] Use context or hooks for deeply shared logic.
- [ ] Duplicate code if abstraction adds unnecessary complexity.
- [ ] Avoid shared utilities unless strongly cohesive.

### General Practices

- [ ] Write with other developers in mind — including your future self.
- [ ] Use code reviews to improve clarity, not just correctness.
- [ ] Apply linters and formatters to enforce consistency.
- [ ] Test critical or shared logic.
- [ ] Favor code that is **safe to change** over “clever” solutions.

---

## Pull Request Instructions

### Purpose

- Every PR MUST clearly state why the change exists.
- Reviewers must understand intent without opening code.

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
