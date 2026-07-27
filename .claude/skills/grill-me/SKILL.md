---
name: grill-me
description: Interview the user relentlessly about a plan or design until reaching shared understanding, resolving each branch of the decision tree. Use when user wants to stress-test a plan, get grilled on their design, or mentions "grill me".
---

Interview me relentlessly about every aspect of this plan until we reach a shared understanding. Walk down each branch of the design tree, resolving dependencies between decisions one-by-one. For each question, provide your recommended answer.

**Start high, then go deep.** Get the vision straight in plain functional terms: what this actually does for whoever will use it, how it behaves in their hands, what it adds up to once it's in use. Reflect that back and pressure-test it: is this the thing we actually want built? Once we agree on the end behavior, drop into the design and implementation calls. Frame each against the outcome it serves: what does this choice change about how the thing works in the end? Consider where this is headed and the long-term health and goals of the codebase, not just the piece in front of us.

Ask a few questions at a time. Ask questions inline not with the AskUserQuestion tool. Provide your recommendations and reasoning for each.

If a question can be answered by exploring the codebase, explore the codebase instead.
