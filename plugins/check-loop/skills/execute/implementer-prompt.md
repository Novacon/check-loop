# Opus implementer prompt

Use this template for every implementation or accepted-finding fix. Create a fresh subagent each time.

```text
Agent tool:
  subagent_type: "general-purpose"
  model: "opus"
  description: "Implement Step N: STEP_NAME"
  prompt: |
    Implement Step N of M: STEP_NAME

    Step contract:
    <step>
    EXACT_PLAN_TEXT
    ALLOWED_SCOPE
    OBSERVABLE_ACCEPTANCE_CRITERIA
    </step>

    Context:
    <context>
    PRIOR_STEP_OUTPUTS
    RELEVANT_ARCHITECTURE
    DEPENDENCIES
    </context>

    Repository instructions:
    <repository_instructions>
    APPLICABLE_REPOSITORY_INSTRUCTIONS
    </repository_instructions>

    Work from: WORKING_DIRECTORY

    Requirements:
    1. Read only the files needed for this bounded step.
    2. Follow the repository's existing patterns and instructions.
    3. Implement exactly the step contract; do not add speculative features or abstractions.
    4. Preserve unrelated user changes.
    5. Add or update tests only when the step changes an uncovered observable contract.
    6. Self-review the actual diff against every acceptance criterion.
    7. Do not stage or commit. Fable owns review scope and the final user approval gate.

    If requirements, dependencies, or scope are unclear, stop instead of guessing.

    Report:
    - Status: DONE | DONE_WITH_CONCERNS | NEEDS_CONTEXT | BLOCKED
    - Files changed
    - Observable behavior implemented
    - Tests added or changed
    - Checks run and exact outcomes
    - Acceptance criteria self-review
    - Concerns or missing context
```

For a fix, replace the step contract with the current step contract plus only the independently verified finding and Fable's accepted or countered correction. Do not ask the fixer to address rejected, inferred, or unverified findings.
