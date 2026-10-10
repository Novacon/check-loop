# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Static HTML/CSS in `site/` (self-hosted fonts, `logo.svg`), deployed to GitHub Pages at checkloop.dev via `.github/workflows/pages.yml` on pushes to `main` touching `site/**`. No build step.

## Users

Primary: developers already using Claude Code with an authenticated Codex CLI who want adversarial review of plans, research, and code before they ship. Secondary: pi users and engineers evaluating agentic coding workflows.

## Product Purpose

check-loop is a Claude Code plugin that has Codex review a plan before you build it, fact-check a research draft, or review each step's diff while executing an approved plan. Success: users trust that what passes review was actually checked, not rubber-stamped.

## Positioning

A finding needs evidence before it can block. The session model (Fable) opens every cited source and records ACCEPT / REJECT / COUNTER; reviewer agreement, confidence, or repetition are not evidence. A failed, empty, or timed-out review is never approval. Codex reviews read-only, using the user's existing Codex login (no API key).

## Operating Context

Runs inside Claude Code via slash commands: `/check-loop`, `/check-loop:research`, `/check-loop:execute`, `/check-loop:settings`. Round 1 is the one broad review; later rounds check only fixes and changed text; six rounds by default, `--quick` for one pass. Execute: fresh Opus subagent per step, repo-native checks, Codex reviews the step diff; nothing committed or pushed without user approval. Secrets are redacted from everything Codex sees.

## Capabilities and Constraints

- Requires Claude Code 2.1.257+, Node.js 18+, signed-in Codex CLI, access to `fable` and `opus` aliases.
- Installed via `/plugin marketplace add Novacon/check-loop`.
- Reviewer model/effort/round limit configurable per user or per project; unset inherits Codex defaults.
- Version shown on the site must match the plugin manifests.

## Brand Commitments

Name: check-loop (lowercase, hyphenated). Domain: checkloop.dev. Tagline in use: "Codex reviews your plans, research and code." Voice: plain, mechanical, specific; states what happens, no hype.

## Evidence on Hand

Only repository facts: commands, mechanics, version, install steps, README. No testimonials, customer logos, benchmarks, usage stats, or GitHub metrics. Do not fabricate any.

## Product Principles

1. Evidence over agreement: every claim on the site maps to real plugin behavior.
2. Show the mechanism; the review loop is the product's proof.
3. The user stays in control: nothing ships, commits, or pushes without them.
4. Get to install fast for Claude Code users; explain enough for evaluators.
