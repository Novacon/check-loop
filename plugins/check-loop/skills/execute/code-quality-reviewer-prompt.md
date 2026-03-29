# Code Quality Reviewer Prompt Template

Use this template when dispatching a code quality reviewer subagent.

**Purpose:** Verify the implementation is well-built -- clean, tested, maintainable, and follows project standards.

**Only dispatch after spec compliance review passes.**

**Always use `model: "opus"`** for code quality review.

```
Agent tool (general-purpose):
  model: "opus"
  description: "Review code quality for Step N"
  prompt: |
    You are reviewing code quality for a step implementation. Spec compliance has
    already been verified -- your job is to assess whether the code is well-built.

    ## What Was Implemented

    [From implementer's status report]

    ## Step Requirements

    [FULL TEXT of step requirements from the plan]

    ## Files Changed

    [List of files the implementer changed]

    ## Your Job

    Read the implementation code in [working directory] and assess:

    ### Desloppify Standards

    These are project-level quality requirements. Violations are critical issues.

    - **Thin Route Handlers**: API routes are orchestrators only (~30-60 lines). Parse
      input, call lib function, map result to response. No business logic in routes.
    - **Business Logic in lib/**: Validation, DB queries, audit logging, side effects
      in lib modules. Lib functions return Result<T>, never NextResponse.
    - **Standardized Error Responses**: Generic errors use helpers from api-utils.ts.
      Domain-specific error codes stay inline.
    - **Outer Try/Catch**: Every route handler wraps body in try/catch using
      serverError('Context', error). No inline catch blocks with NextResponse.json.
    - **Tests**: New lib modules have corresponding test files. Tests assert on
      Result<T>, not HTTP responses. External services mocked.
    - **No `as unknown as` type casts**
    - **No step-narrating comments** (e.g. "// Step 1: Get the user")
    - **Consistent error contracts** across all routes
    - **Open redirect prevention**: External redirects use safeStripeRedirect()

    ### General Quality

    - Does each file have one clear responsibility with a well-defined interface?
    - Are units decomposed so they can be understood and tested independently?
    - Is the implementation following the file structure from the plan?
    - Did this implementation create large new files or significantly grow existing ones?
    - Are names clear and accurate?
    - Is error handling consistent and appropriate?

    ### Testing Quality

    - Do tests actually verify behavior (not just mock behavior)?
    - Are tests comprehensive for the functionality added?
    - Do tests follow existing test patterns in the codebase?

    ## Report Format

    **Strengths:** [what's done well]

    **Issues:** Tag each with severity
    - [critical]: Desloppify violations, bugs, security issues, missing tests for new lib modules
    - [important]: Significant quality concerns that should be fixed
    - [minor]: Style preferences, suggestions (will not block)

    **Assessment:** QUALITY_APPROVED | QUALITY_ISSUES
```
