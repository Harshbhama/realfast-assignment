# Prompts Given to Claude Code

All prompts given to Claude Code during the development of the Claims Processing System.

---

## Prompt 1: Project Setup — Database Schema, Seed Data, and Models

```
Create a Claims Processing System using Node.js, Express, and SQLite (via better-sqlite3).

## Project Setup
- Initialize a Node.js project with Express and better-sqlite3
- Use a single SQLite database file at ./database.db
- Create a db/schema.sql file with all table definitions
- Create a db/seed.sql file with seed data
- Create a db/init.js file that runs schema + seed on startup

## Database Tables (create in this exact order due to FK dependencies)

### 1. Service (lookup table, no FKs)
- code (VARCHAR, PRIMARY KEY) — e.g. "GP_VISIT"
- name (VARCHAR, NOT NULL) — e.g. "General Practitioner Visit"
- created_at (TIMESTAMP, NOT NULL, DEFAULT CURRENT_TIMESTAMP)
- updated_at (TIMESTAMP, NOT NULL, DEFAULT CURRENT_TIMESTAMP)

### 2. Policy (no FKs)
- id (INTEGER, PRIMARY KEY AUTOINCREMENT)
- policy_number (VARCHAR, NOT NULL, UNIQUE) — e.g. "POL-2025-0001"
- plan_name (VARCHAR, NOT NULL)
- deductible_amount (DECIMAL(10,2), NOT NULL) — NEVER use float for money
- effective_from (DATE, NOT NULL)
- effective_to (DATE, NOT NULL)
- status (VARCHAR, NOT NULL) — values: ACTIVE, EXPIRED, CANCELLED
- created_at (TIMESTAMP, NOT NULL, DEFAULT CURRENT_TIMESTAMP)
- updated_at (TIMESTAMP, NOT NULL, DEFAULT CURRENT_TIMESTAMP)

### 3. Coverage (depends on Policy + Service)
- id (INTEGER, PRIMARY KEY AUTOINCREMENT)
- policy_id (INTEGER, NOT NULL, FK → Policy.id)
- service_code (VARCHAR, NOT NULL, FK → Service.code)
- coverage_percentage (DECIMAL(5,2), NOT NULL) — e.g. 80.00 means 80%
- annual_limit (DECIMAL(10,2), NULL) — max payout per year, null = no limit
- created_at (TIMESTAMP, NOT NULL, DEFAULT CURRENT_TIMESTAMP)
- updated_at (TIMESTAMP, NOT NULL, DEFAULT CURRENT_TIMESTAMP)
- UNIQUE constraint on (policy_id, service_code) — one rule per service per policy

### 4. Member (depends on Policy)
- id (INTEGER, PRIMARY KEY AUTOINCREMENT)
- member_no (VARCHAR, NOT NULL, UNIQUE) — e.g. "M-100001"
- full_name (VARCHAR, NOT NULL)
- dob (DATE, NOT NULL)
- policy_id (INTEGER, NOT NULL, FK → Policy.id)
- created_at (TIMESTAMP, NOT NULL, DEFAULT CURRENT_TIMESTAMP)
- updated_at (TIMESTAMP, NOT NULL, DEFAULT CURRENT_TIMESTAMP)

### 5. Claim (depends on Member + Policy)
- id (INTEGER, PRIMARY KEY AUTOINCREMENT)
- member_id (INTEGER, NOT NULL, FK → Member.id)
- policy_id (INTEGER, NOT NULL, FK → Policy.id)
- service_date (DATE, NOT NULL) — when care happened
- provider_name (VARCHAR, NOT NULL)
- diagnosis_code (VARCHAR, NOT NULL) — e.g. "J06.9"
- status (VARCHAR, NOT NULL, DEFAULT 'SUBMITTED') — values: SUBMITTED, UNDER_REVIEW, APPROVED, PARTIALLY_APPROVED, DENIED, PAID
- submitted_at (TIMESTAMP, NOT NULL, DEFAULT CURRENT_TIMESTAMP)
- created_at (TIMESTAMP, NOT NULL, DEFAULT CURRENT_TIMESTAMP)
- updated_at (TIMESTAMP, NOT NULL, DEFAULT CURRENT_TIMESTAMP)

### 6. LineItem (depends on Claim + Service)
- id (INTEGER, PRIMARY KEY AUTOINCREMENT)
- claim_id (INTEGER, NOT NULL, FK → Claim.id)
- service_code (VARCHAR, NOT NULL, FK → Service.code)
- description (VARCHAR, NOT NULL) — e.g. "Dental X-Ray"
- billed_amount (DECIMAL(10,2), NOT NULL)
- approved_amount (DECIMAL(10,2), NULL) — null until adjudicated
- status (VARCHAR, NOT NULL, DEFAULT 'PENDING') — values: PENDING, APPROVED, DENIED, NEEDS_REVIEW
- denial_reason (VARCHAR, NULL) — null if approved, explanation if denied
- created_at (TIMESTAMP, NOT NULL, DEFAULT CURRENT_TIMESTAMP)
- updated_at (TIMESTAMP, NOT NULL, DEFAULT CURRENT_TIMESTAMP)

### 7. Dispute (depends on Claim)
- id (INTEGER, PRIMARY KEY AUTOINCREMENT)
- claim_id (INTEGER, NOT NULL, FK → Claim.id)
- reason (VARCHAR, NOT NULL) — member's explanation
- status (VARCHAR, NOT NULL, DEFAULT 'OPEN') — values: OPEN, UNDER_REVIEW, RESOLVED_UPHELD, RESOLVED_OVERTURNED
- resolution_notes (VARCHAR, NULL) — null until resolved
- created_at (TIMESTAMP, NOT NULL, DEFAULT CURRENT_TIMESTAMP)
- updated_at (TIMESTAMP, NOT NULL, DEFAULT CURRENT_TIMESTAMP)

## Important constraints
- Enable foreign keys in SQLite: PRAGMA foreign_keys = ON
- All money fields use DECIMAL, never FLOAT
- All tables have created_at and updated_at timestamps
- Coverage table has UNIQUE(policy_id, service_code)

## Seed data

### Service (8 rows)
GP_VISIT, SPECIALIST_VISIT, DENTAL_CLEANING, DENTAL_FILLING, MRI, XRAY, BLOOD_TEST, PHYSIOTHERAPY

### Policy (3 rows)
1. POL-2025-0001, Standard Health 2025, deductible 500.00, 2025-01-01 to 2025-12-31, ACTIVE
2. POL-2025-0002, Premium Health 2025, deductible 1000.00, 2025-01-01 to 2025-12-31, ACTIVE
3. POL-2025-0003, Basic Dental 2025, deductible 200.00, 2025-01-01 to 2025-12-31, ACTIVE

### Coverage (17 rows)
Policy 1 (Standard): GP_VISIT 80%/$2000, SPECIALIST_VISIT 60%/$3000, MRI 70%/$5000, XRAY 80%/$1000, BLOOD_TEST 70%/$1000, PHYSIOTHERAPY 50%/$1500
Policy 2 (Premium): GP_VISIT 90%/$5000, SPECIALIST_VISIT 80%/$5000, MRI 85%/$10000, XRAY 90%/$2000, BLOOD_TEST 85%/$2000, PHYSIOTHERAPY 70%/$3000, DENTAL_CLEANING 80%/$500, DENTAL_FILLING 70%/$1000
Policy 3 (Basic Dental): DENTAL_CLEANING 100%/$300, DENTAL_FILLING 80%/$500, XRAY 70%/$400

## Folder structure
app/
├── db/
│   ├── schema.sql
│   ├── seed.sql
│   └── init.js
├── models/
│   ├── service.js
│   ├── policy.js
│   ├── coverage.js
│   ├── member.js
│   ├── claim.js
│   ├── lineItem.js
│   └── dispute.js
├── package.json
└── server.js

## Models
Each model file should export basic functions:
- findAll()
- findById(id)
- create(data)

Do NOT create routes or controllers yet. Just the database setup and model layer.
Do NOT over-engineer. Keep it simple and minimal.
```

---

## Prompt 2: Adjudication Endpoint

```
Create the POST /claims/:id/adjudicate endpoint.

This endpoint takes a claim ID, processes each line item against coverage rules, and updates the claim and line item statuses.

## Adjudication flow for each LineItem (checks run in this exact order, first failure stops):

### Check 1: Policy active?
- Look up the policy by claim.policy_id
- If policy.status != 'ACTIVE' → DENIED
- denial_reason: "Policy {policy_number} is {status}. No coverage available."

### Check 2: Service date within policy period?
- If claim.service_date < policy.effective_from OR claim.service_date > policy.effective_to → DENIED
- denial_reason: "Service date {service_date} is outside policy period ({effective_from} to {effective_to})."

### Check 3: Coverage rule exists?
- Look up Coverage where policy_id = claim.policy_id AND service_code = lineItem.service_code
- If no match → DENIED
- denial_reason: "Service {service_code} is not covered under {plan_name}."

### Check 4: Annual limit exhausted?
- Calculate used_amount:
  SELECT COALESCE(SUM(li.approved_amount), 0) AS used_amount
  FROM line_items li
  JOIN claims c ON li.claim_id = c.id
  WHERE c.member_id = claim.member_id
    AND li.service_code = lineItem.service_code
    AND li.status = 'APPROVED'
    AND c.service_date BETWEEN policy.effective_from AND policy.effective_to
- remaining_limit = coverage.annual_limit - used_amount
- If remaining_limit <= 0 → DENIED
- denial_reason: "Annual limit of ${annual_limit} for {service_code} has been fully exhausted for this policy period."

### Check 5: Calculate deductible
- Calculate deductible_met:
  SELECT COALESCE(SUM(li.billed_amount - li.approved_amount), 0) AS deductible_met
  FROM line_items li
  JOIN claims c ON li.claim_id = c.id
  WHERE c.member_id = claim.member_id
    AND li.status = 'APPROVED'
    AND c.service_date BETWEEN policy.effective_from AND policy.effective_to
- deductible_remaining = policy.deductible_amount - deductible_met
- If deductible_remaining < 0, set to 0

### Check 6: Apply deductible to billed amount
- If deductible_remaining >= billed_amount:
  - Entire billed_amount goes to deductible
  - approved_amount = 0.00
  - status = APPROVED
  - denial_reason: "Deductible not yet met. ${billed_amount} applied to ${deductible_amount} annual deductible. ${deductible_remaining - billed_amount} remaining."
  - STOP here for this line item

- If deductible_remaining > 0 but < billed_amount:
  - amount_after_deductible = billed_amount - deductible_remaining
  - Continue to next steps with amount_after_deductible

- If deductible_remaining = 0:
  - amount_after_deductible = billed_amount
  - Continue to next steps

### Check 7: Apply coverage percentage
- covered_amount = amount_after_deductible × (coverage_percentage / 100)

### Check 8: Apply annual limit cap
- payable = MIN(covered_amount, remaining_limit)
- approved_amount = payable
- status = APPROVED

- If payable < covered_amount:
  - denial_reason: "Annual limit for {service_code} is ${annual_limit}. ${used_amount} already used. Only ${remaining_limit} remaining, applied to this claim."
- If deductible was partially applied:
  - denial_reason: "${deductible_remaining} applied to remaining deductible. ${amount_after_deductible} covered at {coverage_percentage}%. Approved: ${payable}."
- If fully covered with no issues:
  - denial_reason: null

## After all LineItems are adjudicated, derive Claim status:

- If ALL line items are APPROVED → claim.status = 'APPROVED'
- If ALL line items are DENIED → claim.status = 'DENIED'
- If mix of APPROVED and DENIED → claim.status = 'PARTIALLY_APPROVED'
- If any line item is NEEDS_REVIEW → claim.status = 'UNDER_REVIEW'

## Important rules:
- Process line items in order (by line item id)
- Each line item is adjudicated independently
- Deductible tracking must account for line items adjudicated earlier in the SAME claim (not just past claims)
- All money calculations use decimal, never float
- Update claim.status to UNDER_REVIEW at the start of adjudication
- Only adjudicate claims with status = 'SUBMITTED' or 'UNDER_REVIEW'. Reject if already adjudicated.
- Return the full claim with all line items and their adjudication results
```

---

## Prompt 3: Updated Response Format with Summary

```
Update the POST /claims/:id/adjudicate endpoint to return a detailed response with claim-level summary and line-item-level breakdown.

## Line Item fields to track during adjudication

For each line item, track these values during processing:
- deductible_applied: how much of this line item went toward the deductible
- coverage_percentage: the coverage rule's percentage (null if service not covered)

These fields do NOT need to be stored in the database. They are calculated during adjudication and included in the response only.

## Updated response format

After adjudication, return this structure:

{
  "claim": {
    "id": 1,
    "status": "PARTIALLY_APPROVED",
    "member_id": 1,
    "policy_id": 1,
    "service_date": "2025-06-10",
    "provider_name": "City Hospital",
    "diagnosis_code": "J06.9",
    "summary": {
      "total_billed": 700.00,
      "total_approved": 35.00,
      "total_deductible_applied": 500.00,
      "total_member_responsibility": 665.00
    },
    "line_items": [...]
  }
}

## Summary calculation

After all line items are adjudicated, compute the summary:
- total_billed = SUM of all line_items.billed_amount
- total_approved = SUM of all line_items.approved_amount
- total_deductible_applied = SUM of all line_items.deductible_applied
- total_member_responsibility = total_billed - total_approved

## Important
- deductible_applied and coverage_percentage are response-only fields, not stored in the database
- The existing adjudication logic (all 9 checks) stays the same
- Just update the response format to include these extra fields and the summary
- All money values should be rounded to 2 decimal places
```

---

## Prompt 4: Deductible Bug Fix (First Attempt)

```
Bug fix: When adjudicating multiple line items in the same claim, the deductible tracking is incorrect. Line items processed earlier in the same claim are not being counted toward the deductible for later line items.

Fix: Track a running deductible total IN MEMORY during adjudication.
Before processing each line item:
- Start with deductible_met from the database (past claims)
- Add deductible_applied from all line items already processed in the CURRENT claim
- Use this combined total to calculate deductible_remaining

Expected behavior for Claim (Aarav, Policy 1, $500 deductible):

Line Item (GP_VISIT, $200):
  - deductible_met from DB: $0 (no past claims)
  - deductible_remaining: $500 - $0 = $500
  - $200 < $500 → entire $200 goes to deductible
  - approved_amount = $0
  - deductible running total: $200

Line Item (BLOOD_TEST, $350):
  - deductible_met from DB: $0
  - deductible from current claim: $200 (from previous line item)
  - deductible_remaining: $500 - $0 - $200 = $300
  - $350 > $300 → $300 goes to deductible, $50 left
  - covered = $50 × 70% = $35
  - approved_amount = $35
  - deductible running total: $500 (fully met)
```

---

## Prompt 5: Deductible Bug Fix (Second Attempt — More Specific)

```
The deductible tracking bug is still present. The issue is that when adjudicating multiple line items in the same claim, the deductible applied by earlier line items is not being added to the running total for later line items.

THE FIX:
Do NOT rely on the database query alone for deductible tracking within the same claim. Instead:

1. Before the line item loop starts, query the database ONCE to get deductible_met from PAST claims only (exclude the current claim):

   SELECT COALESCE(SUM(li.billed_amount - li.approved_amount), 0)
   FROM line_items li
   JOIN claims c ON li.claim_id = c.id
   WHERE c.member_id = ?
     AND c.id != current_claim_id
     AND li.status = 'APPROVED'
     AND c.service_date BETWEEN policy.effective_from AND policy.effective_to

2. Create a variable: let runningDeductibleMet = deductible_met_from_db

3. Inside the loop, for each line item:
   - deductible_remaining = policy.deductible_amount - runningDeductibleMet
   - After processing the line item, ADD its deductible_applied to runningDeductibleMet:
     runningDeductibleMet += deductible_applied_for_this_line_item

Do the same for annual limit tracking — use a running total per service_code within the same claim, not just the database query.
```

---

## Prompt 6: File Dispute Endpoint

```
Create the POST /claims/:id/disputes endpoint.

## What it does
A member files a dispute against an adjudicated claim.

## Validation rules
1. Claim must exist → if not, return 404: "Claim not found."
2. Claim must be adjudicated (status must be APPROVED, PARTIALLY_APPROVED, or DENIED)
   → if status is SUBMITTED or UNDER_REVIEW, return 400: "Claim has not been adjudicated yet. Cannot dispute."
3. reason field is required and must be a non-empty string
   → if missing, return 400: "Reason is required to file a dispute."

## Request body
{
  "reason": "MRI was medically necessary per doctor's recommendation"
}

## What happens on success
1. Create a new row in the Disputes table
2. Update the Claim status to "DISPUTED"
3. Return the created dispute with claim details

## Add DISPUTED to valid claim statuses

## Response format (201 Created)
{
  "dispute": {
    "id": 1,
    "claim_id": 9,
    "reason": "MRI was medically necessary per doctor's recommendation",
    "status": "OPEN",
    "resolution_notes": null,
    "created_at": "2025-06-15T10:00:00.000Z",
    "updated_at": "2025-06-15T10:00:00.000Z"
  }
}

Keep it simple. No over-engineering.
```

---

## Prompt 7: Resolve Dispute Endpoint

```
Create the PATCH /disputes/:id endpoint.

## What it does
Resolve an open dispute — either uphold the original decision or overturn it.

## Validation rules
1. Dispute must exist → if not, return 404: "Dispute not found."
2. Dispute status must be OPEN or UNDER_REVIEW
   → if already resolved, return 400: "Dispute has already been resolved with status: {status}."
3. resolution field is required → must be either "UPHELD" or "OVERTURNED"
4. resolution_notes field is required → non-empty string

## What happens on success

### If UPHELD:
1. Update dispute status to "RESOLVED_UPHELD"
2. Update dispute resolution_notes
3. Revert claim status back to its pre-dispute status
   - Derive from line items: All APPROVED → APPROVED, All DENIED → DENIED, Mix → PARTIALLY_APPROVED

### If OVERTURNED:
1. Update dispute status to "RESOLVED_OVERTURNED"
2. Update dispute resolution_notes
3. Set claim status to "UNDER_REVIEW"
4. Reset ALL line items on the claim back to: status = "PENDING", approved_amount = null, denial_reason = null

Keep it simple. No over-engineering.
```

---

## Prompt 8: List Disputes Endpoint

```
Create the GET /claims/:id/disputes endpoint.

## What it does
List all disputes for a specific claim.

## Validation rules
1. Claim must exist → if not, return 404: "Claim not found."

## Response format (200 OK)
{
  "disputes": [...]
}

- Return disputes ordered by created_at descending (newest first)
- Return empty array if no disputes exist for the claim
- Keep it simple. No pagination needed.
```

---

## Prompt 9: Documentation

```
Create documentation files: docs/domain-model.md, docs/decisions.md, docs/self-review.md, and README.md
(Full prompt content as provided during conversation)
```

---

## Prompt 10: Frontend

```
Create a React + Vite frontend for the Claims Processing System.
(Full prompt content as provided during conversation — covering all pages, forms, validations, and API integration)
```
