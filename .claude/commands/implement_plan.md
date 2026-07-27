---
description: Implement technical plans from thoughts/shared/plans with verification
argument-hint: path/to/plan.md
---

# Implement Plan

You are tasked with implementing an approved technical plan from `thoughts/shared/plans/`. These plans contain phases with specific changes and success criteria.

## Getting Started

When given a plan path:

- Read the plan completely and check for any existing checkmarks (- [x])
- Read the original ticket and all files mentioned in the plan
- **Read files fully** - never use limit/offset parameters, you need complete context
- Think deeply about how the pieces fit together
- Create a todo list to track your progress
- Start implementing if you understand what needs to be done

If no plan path provided, ask for one.

## Implementation Philosophy

Plans are carefully designed, but reality can be messy. Your job is to:

- Follow the plan's intent while adapting to what you find
- Implement each phase fully before moving to the next
- Verify your work makes sense in the broader codebase context
- Update checkboxes in the plan as you complete sections
- Follow up with the user when there are manual tasks that need to be completed

When things don't match the plan exactly, think about why and communicate clearly. The plan is your guide, but your judgment matters too.

If you encounter a mismatch:

- STOP and think deeply about why the plan can't be followed
- Present the issue clearly:

  ```
  Issue in Phase [N]:
  Expected: [what the plan says]
  Found: [actual situation]
  Why this matters: [explanation]

  How should I proceed?
  ```

## Verification Approach

Default mode: implement all phases end-to-end without pausing for human input. Run automated verification between phases, but defer every manual verification step until the end and surface them all together in one consolidated handoff.

After implementing each phase:

- Run the success criteria checks (usually `make check test` covers everything)
- Fix any issues before proceeding
- Update your progress in both the plan and your todos
- Check off completed items in the plan file itself using Edit
- **Collect** the phase's manual verification items into a running list (do not pause, do not ask the user, do not check them off)
- Continue directly to the next phase

After the final phase is implemented and all automated verification passes, pause **once** and present the consolidated manual testing handoff using this format:

```
All Phases Complete — Ready for Manual Verification

Automated verification passed:
- [List automated checks that passed across all phases]

Please perform the following manual verification steps (collected from every phase):

Phase 1:
- [Manual items from Phase 1]

Phase 2:
- [Manual items from Phase 2]

...

Let me know the results so I can check these off in the plan or address any issues found.
```

Do not check off items in the manual testing steps until confirmed by the user.

**Exceptions to the deferred-manual default:**

- If the user explicitly asks you to run only a single phase, implement that phase and present its manual items at the end of that phase using the same handoff format (scoped to just that phase).
- If a manual step is a hard prerequisite for a later phase to be implementable at all (e.g., the user must provision a credential, run a migration on their machine, or click through an external admin UI before code in the next phase can compile or run), pause at that point and explain why — do not silently skip ahead.

## If You Get Stuck

When something isn't working as expected:

- First, make sure you've read and understood all the relevant code
- Consider if the codebase has evolved since the plan was written
- Present the mismatch clearly and ask for guidance

Use sub-tasks sparingly - mainly for targeted debugging or exploring unfamiliar territory.

## Resuming Work

If the plan has existing checkmarks:

- Trust that completed work is done
- Pick up from the first unchecked item
- Verify previous work only if something seems off

Remember: You're implementing a solution, not just checking boxes. Keep the end goal in mind and maintain forward momentum.
