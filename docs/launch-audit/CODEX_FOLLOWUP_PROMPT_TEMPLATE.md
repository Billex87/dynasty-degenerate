# Codex Follow‑Up Prompt Template – Dynasty Degens

Use this template for subsequent Codex passes when unresolved QA items remain after the initial implementation.  Only include items that failed during review; do not re‑include resolved issues or expand the scope.

---

## Unresolved QA items

- QA‑___ – [Brief description of the failed checklist item, referencing audit issue IDs if applicable]
- QA‑___ – ...

## Affected leagues

- [List the leagues where the issue occurs, e.g., Skids Get Beat, The Fantasy Degenerates, test league, Gov Tech Grid Iron]

## Affected pages/components

- [List the pages or components affected, e.g., Overview page, Rankings table, Player modal, League selection modal]

## Affected files

- [If known, list the files or modules likely involved in the fix, based on diffs or architecture]

## Required fixes

- For each QA item, clearly describe what must be fixed.  Include acceptance criteria and reference the audit documents.  Be specific and avoid generalities.

## Acceptance criteria

- [Describe the expected behaviour after fixes are applied, referencing the QA checklist]

## Do not touch

- [List any files or features that should not be modified in this pass]

## Checks to run

- [List relevant tests, manual checks or QA checklist items to verify after the fix]

## Expected final response from Codex

- Provide a summary of changes made.
- List files modified.
- Explain how the fix satisfies the acceptance criteria.
- Provide evidence (e.g., screenshots) if applicable.

---

Fill in the blanks above for the unresolved items and send this prompt to Codex for the next iteration.

