---
name: grill-to-decisions
description: Interview the user relentlessly about a plan or design until reaching shared understanding, resolving each branch of the decision tree. Grill a scoped work doc — slice, research+slice, ticket, brief, plan, or raw idea — to resolve the taste/design decisions up front, then write a standardized design-decisions doc to thoughts/shared/decisions/ for /create_plan to consume. Use when you want to lock the design decisions before planning a whole unit of work, or mention "grill to decisions".
---

# Grill to Decisions

Interview me relentlessly about every aspect of this scoped unit of work until we reach a shared understanding. Walk down each branch of the design tree, resolving dependencies between decisions one-by-one. For each question, provide your recommended answer. Then write them down in one doc that `/create_plan` can pick up and run with.

**Start high, then go deep.** Get the vision straight in plain functional terms: what this actually does for whoever will use it, how it behaves in their hands, what it adds up to once it's in use. Reflect that back and pressure-test it: is this the thing we actually want built? Once we agree on the end behavior, drop into the design and implementation calls. Frame each against the outcome it serves: what does this choice change about how the thing works in the end? Consider where this is headed and the long-term health and goals of the codebase, not just the piece in front of us.

The point: get the **taste and design calls a human should own** out of the way _before_ anyone burns a full research-and-plan pass. `/create_plan` will still fan out sub-agents and surface implementation decisions at runtime — but the consequential, judgment calls are made here, so it no longer matters who runs the plan later.

Ask a few questions at a time.

If a question can be answered by exploring the codebase, explore the codebase instead.

## Input

Anything scoped: a slice, a research doc, a Linear ticket, a brief, an existing plan, raw text, or some combination. Read it FULLY first, then reflect back the shape you heard so we know we're aligned before you start swinging.

## How you grill

- Walk down each branch of the design tree, resolving dependencies between decisions one-by-one. Answer the question that makes the most others moot first.
- **Ask a few questions at a time** — not a wall, not strictly one. For each, give a couple of plausible options with quick pros/cons and **your recommended answer**.
- **If a question can be answered by exploring the codebase, explore it instead of asking me.** Use Read/Grep/Glob, or a single `codebase-locator` / `codebase-analyzer` when you need it — then come back to the interview. Ground only in service of the question in front of you. If you find yourself mapping the whole codebase, stop — that's `/create_plan`'s job, not yours.
- After each answer, prune the branches it kills. Don't re-ask what's settled. "Your call" / "go with your rec" → take your recommendation as the decision and move on.
- Keep a running split in your head: **resolved decisions** vs **open questions you're deliberately leaving to `/create_plan`**.
- Don't stop until the tree is resolved AND I say go.
- Some topics will need lots of questions and others may only need a few, use your best judgement.
- Ask questions inline not with the AskUserQuestion tool. Provide your recommendation and reasoning.

## When the tree is resolved

Write `thoughts/shared/decisions/YYYY-MM-DD-<name>.md` (create the dir if needed):

```markdown
---
date: [ISO date]
source: grill-to-decisions
input: [the slice / ticket / doc(s) we grilled]
status: decided
---

# Design Decisions: [name]

## Decision 1: [the question]

**Context**: [why this mattered — cite `file:line` if relevant]
**Options**: [A — pros/cons · B — pros/cons]
**Decision**: [what we settled, with my reasoning if I gave any]

## Decision 2: ...

## Codebase Findings

[Factual things you turned up while grilling that the planner should know — with `file:line`. Skip if nothing notable.]

## Out of Scope

[What we explicitly deferred or said "not now" to, so the planner doesn't pick it up. Skip if empty.]
```

Each **Decision** line is binding — the planner treats it as settled, not a suggestion.

## Hand off

Point me at the next step:

```
Decisions written to thoughts/shared/decisions/YYYY-MM-DD-<name>.md

Feed it to the planner with:
  /create_plan <the slice / ticket> thoughts/shared/decisions/YYYY-MM-DD-<name>.md
```

## What this is NOT

- **Not a planner.** Stop at decisions. Don't write phases, file-change lists, or implementation steps — that's `/create_plan`.
- **Not a research run.** Look things up only to answer the question in front of you.
- **Not a ticketizer.** If the work wants to fan out into executor-sized Linear tickets instead of one whole-slice plan, that's `grill-to-tickets`.
