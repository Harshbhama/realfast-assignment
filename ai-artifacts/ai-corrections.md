# AI Corrections — What AI Got Wrong

This document records instances where AI-generated code or suggestions were incorrect and required manual correction or re-prompting.

---

## Correction 1: Deductible Tracking Bug (Critical)

### The Problem
When adjudicating multiple line items within the same claim, the deductible tracking was incorrect. The system was not accounting for deductible amounts applied by earlier line items in the same claim when processing later line items.

### What Happened
- Claim had 3 line items: GP_VISIT ($200), BLOOD_TEST ($350), DENTAL_CLEANING ($150)
- Policy deductible: $500
- Line Item 1 (GP_VISIT): Correctly applied $200 to deductible. Remaining: $300. ✅
- Line Item 2 (BLOOD_TEST): Should have applied $300 to deductible, but only applied $100. ❌
- This resulted in approved_amount = $175 instead of the correct $35.

### Root Cause
The deductible calculation queried the database for previously approved line items. But line items being adjudicated in the same request were either:
- Not yet committed to the database, or
- Not visible within the same transaction

The system was not maintaining an in-memory running total of deductible applied within the current claim's adjudication pass.

### Fix Required
First attempt at fixing (Prompt 4) did not resolve the issue — the same wrong numbers appeared. A more specific second prompt (Prompt 5) was needed that:
1. Explicitly excluded the current claim from the database query
2. Created a `runningDeductibleMet` variable initialized from past claims only
3. Accumulated deductible_applied from each line item within the loop
4. Applied the same pattern to annual limit tracking per service_code

### Attempts to Fix
- **Attempt 1**: General description of the bug and expected behavior → Did not work
- **Attempt 2**: Specific implementation instructions with exact query changes and variable names → Fixed the issue

### Lesson Learned
When describing bugs to AI, vague descriptions produce vague fixes. The more specific the instruction (exact variable names, exact query changes, exact expected values), the more likely the fix works on the first try.

---

## Correction 2: Over-Engineering Tendency

### The Problem
Throughout the design phase, AI (Claude chat) consistently suggested features and complexity beyond what the assignment required:
- Family plans and shared policies
- Per-line-item disputes
- Pre-authorization workflows
- Service category hierarchies
- Policy versioning
- Audit log tables

### How It Was Handled
Each time, I checked against the assignment requirements and pushed back:
- "Let's not have this family thing, if it is not specified in the assignment, let's skip it."
- "Don't over-engineer please, let's stick to the basics."

The AI acknowledged the correction each time and adjusted its approach.

### Lesson Learned
AI tends to suggest "production-ready" solutions. For time-boxed assignments, you need to actively manage scope and keep redirecting toward the minimum viable solution. The assignment evaluates domain modeling quality, not feature count.

---

## Correction 3: Schema Review Misses

### The Problem
When reviewing uploaded drawSQL screenshots, the AI initially:
- Failed to notice existing FK arrows in the diagram
- Reported missing connections that were actually present (just rendered subtly)

### How It Was Handled
I pushed back: "Look again, this is also there" — and the AI corrected itself after closer inspection.

### Lesson Learned
AI image analysis of diagrams is not 100% reliable, especially with subtle visual elements like thin connection lines. Always verify AI's visual analysis against your own observation.

---

## Summary

| Issue | Severity | Attempts to Fix | Impact |
|---|---|---|---|
| Deductible tracking bug | Critical | 2 prompts | Wrong payout calculations |
| Over-engineering tendency | Medium | Multiple redirects | Would have wasted time on out-of-scope features |
| Schema review misses | Low | Simple pushback | No code impact, just review accuracy |
