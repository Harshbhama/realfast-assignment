# Chat Export — Design Conversation with Claude

This document summarizes the design conversation held with Claude (claude.ai) during the planning and development of the Claims Processing System.

---

## Conversation Overview

**Platform:** Claude.ai (claude.ai web interface)
**Duration:** Full design session covering domain modeling, API design, adjudication logic, and documentation planning
**Purpose:** Design the domain model, plan API endpoints, define adjudication logic, and generate prompts for Claude Code

---

## Phase 1: Understanding the Assignment

- Reviewed the take-home assignment requirements
- Identified core entities: Member, Policy, CoverageRule, Claim, LineItem, Dispute
- Identified key evaluation signals: domain decomposition, rule representation, state management, edge case thinking, explanation capability
- Established scope: build the core claims flow, skip auth/admin/notifications

---

## Phase 2: Domain Modeling

### Member + Policy
- Designed Member and Policy tables
- Decided on one-to-one relationship (one member, one policy)
- Fixed issues identified in drawSQL screenshots:
  - policy_id type mismatch (varchar → bigint)
  - deductible_amount as float → changed to decimal
  - Missing status field on Policy
  - Naming consistency (camelCase → snake_case)
- Discussed but intentionally skipped: family plans, shared policies, policy versioning

### Service Table
- Initially skipped as over-engineering
- Reconsidered after discussing data integrity risks (typos in service codes)
- Added as a lookup table with code as primary key
- Both Coverage.service_code and LineItem.service_code FK to Service.code

### Coverage (CoverageRule)
- Designed with minimal fields: policy_id, service_code, coverage_percentage, annual_limit
- One policy has many coverage rules
- If no matching rule exists for a line item's service_code → denied

### Claim
- Links to both Member and Policy (policy_id snapshots which policy was active)
- Includes service_date (when care happened, not when submitted)
- Status derived from line item statuses after adjudication

### LineItem
- Each line item is one charge within a claim
- Adjudication happens at the line item level, not claim level
- Stores approved_amount, status, and denial_reason
- Kept adjudication results on LineItem directly (no separate AdjudicationResult table)

### Dispute
- Simplified to claim-level disputes only (no per-line-item disputes)
- Statuses: OPEN, UNDER_REVIEW, RESOLVED_UPHELD, RESOLVED_OVERTURNED

---

## Phase 3: Adjudication Logic

Defined 9 adjudication cases:
1. Policy not active → DENIED
2. Service not covered → DENIED
3. Annual limit exhausted → DENIED
4. Deductible not yet met → APPROVED ($0)
5. Deductible partially met → APPROVED (partial)
6. Happy path (fully covered) → APPROVED
7. Annual limit partially hit → APPROVED (capped)
8. Partial approval (multiple line items) → PARTIALLY_APPROVED
9. Service date outside policy period → DENIED

Key design decisions:
- Checks run in order, first failure stops
- Deductible tracked per member via query, not stored counter
- Annual limits tracked per member per service_code
- Running totals maintained in-memory within same claim adjudication

---

## Phase 4: API Design

Designed 13 endpoints:
- Members: POST, GET all, GET by id
- Claims: POST, GET all, GET by id
- Adjudication: POST /claims/:id/adjudicate
- Disputes: POST, GET by claim, PATCH resolve
- Reference data: GET services, GET policies, GET policy by id

---

## Phase 5: Bug Discovery and Fix

### Deductible Tracking Bug
- Discovered during testing: line items within the same claim were not seeing each other's deductible contributions
- First fix attempt (general description) failed
- Second fix attempt (specific implementation with exact variable names and queries) succeeded
- Root cause: database query didn't account for in-progress line items in the same adjudication pass

---

## Phase 6: Response Format Enhancement

- Added claim-level summary: total_billed, total_approved, total_deductible_applied, total_member_responsibility
- Added line-item-level fields: deductible_applied, coverage_percentage
- These are response-only fields, not stored in database

---

## Phase 7: Documentation and Frontend

- Generated prompts for all documentation files
- Generated comprehensive prompt for React + Vite frontend covering all pages, forms, and validations

---

## Key Decisions Made During Conversation

| Decision | Rationale |
|---|---|
| One member, one policy | Assignment says "a member has a policy" — singular |
| Service as lookup table | Prevents typos in service codes via FK constraints |
| No family plans | Not mentioned in assignment, adds complexity |
| Deductible per member | Even if sharing policy, each member tracks independently |
| Results on LineItem | Simpler than separate AdjudicationResult table |
| Claim status derived | Computed from line item statuses, never set manually |
| Dispute at claim level only | Assignment just says "members can dispute decisions" |
| No manual amount overrides | Overturn resets for re-adjudication instead |

---

## AI Tools Used

| Tool | Purpose |
|---|---|
| Claude.ai | Domain modeling, API design, adjudication logic, prompt generation |
| Claude Code | Code generation from prompts (schema, models, endpoints, frontend) |
| drawSQL | Visual database diagram design |
| Postman | API testing and verification |
