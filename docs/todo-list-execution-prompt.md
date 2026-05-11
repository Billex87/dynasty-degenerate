# Todo List Execution Prompt

Use this prompt when the user wants to work through `todo.md` item by item:

```text
Go through `todo.md` from top to bottom, one item at a time.

For each unchecked item:
- Decide whether it is actionable now or blocked.
- Implement the smallest complete change needed.
- Run the relevant tests or verification for that item.
- Report back with:
  - what you changed
  - which files changed
  - how you verified it
  - any follow-up or risk
- Stop after that item and wait for my approval before moving to the next one.

Rules:
- Do not skip ahead.
- Do not batch unrelated items together.
- If an item is blocked, say exactly why and what is needed to unblock it.
- Keep the work practical and production-ready.
- Preserve existing behavior unless the item explicitly requires a change.
```

Shorter trigger version:

```text
Go through `todo.md` top to bottom, one item at a time. Implement the smallest complete change for each unchecked item, verify it, report back, then stop and wait before moving to the next item.
```
