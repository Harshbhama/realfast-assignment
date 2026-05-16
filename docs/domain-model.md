# Domain Model

## Entities

### Service
Lookup table for valid service codes.

| Field | Type | Description |
|-------|------|-------------|
| code | VARCHAR, PK | Unique service identifier (e.g. "GP_VISIT") |
| name | VARCHAR, NOT NULL | Human-readable name |
| created_at | TIMESTAMP | Auto-set on creation |
| updated_at | TIMESTAMP | Auto-set on update |

### Policy
Insurance plan with deductible and coverage period.

| Field | Type | Description |
|-------|------|-------------|
| id | INTEGER, PK, AUTO | Unique identifier |
| policy_number | VARCHAR, UNIQUE | External reference (e.g. "POL-2025-0001") |
| plan_name | VARCHAR | Display name (e.g. "Standard Health 2025") |
| deductible_amount | DECIMAL(10,2) | Annual deductible before coverage kicks in |
| effective_from | DATE | Policy period start |
| effective_to | DATE | Policy period end |
| status | VARCHAR | ACTIVE, EXPIRED, or CANCELLED |
| created_at | TIMESTAMP | Auto-set on creation |
| updated_at | TIMESTAMP | Auto-set on update |

### Coverage
Coverage rules linking a policy to a service with percentage and limit.

| Field | Type | Description |
|-------|------|-------------|
| id | INTEGER, PK, AUTO | Unique identifier |
| policy_id | INTEGER, FK | References Policy.id |
| service_code | VARCHAR, FK | References Service.code |
| coverage_percentage | DECIMAL(5,2) | Percentage covered (e.g. 80.00 = 80%) |
| annual_limit | DECIMAL(10,2), NULL | Max payout per year; null = unlimited |
| created_at | TIMESTAMP | Auto-set on creation |
| updated_at | TIMESTAMP | Auto-set on update |

UNIQUE constraint on (policy_id, service_code).

### Member
Insured person linked to a policy.

| Field | Type | Description |
|-------|------|-------------|
| id | INTEGER, PK, AUTO | Unique identifier |
| member_no | VARCHAR, UNIQUE | External reference (e.g. "M-100001") |
| full_name | VARCHAR | Member's full name |
| dob | DATE | Date of birth |
| policy_id | INTEGER, FK | References Policy.id |
| created_at | TIMESTAMP | Auto-set on creation |
| updated_at | TIMESTAMP | Auto-set on update |

### Claim
Reimbursement request from a member.

| Field | Type | Description |
|-------|------|-------------|
| id | INTEGER, PK, AUTO | Unique identifier |
| member_id | INTEGER, FK | References Member.id |
| policy_id | INTEGER, FK | References Policy.id |
| service_date | DATE | When care was provided |
| provider_name | VARCHAR | Name of healthcare provider |
| diagnosis_code | VARCHAR | ICD code (e.g. "J06.9") |
| status | VARCHAR | Current lifecycle state (see state machine) |
| submitted_at | TIMESTAMP | When claim was submitted |
| created_at | TIMESTAMP | Auto-set on creation |
| updated_at | TIMESTAMP | Auto-set on update |

### LineItem
Individual charge within a claim.

| Field | Type | Description |
|-------|------|-------------|
| id | INTEGER, PK, AUTO | Unique identifier |
| claim_id | INTEGER, FK | References Claim.id |
| service_code | VARCHAR, FK | References Service.code |
| description | VARCHAR | Human-readable description of the charge |
| billed_amount | DECIMAL(10,2) | Amount charged by provider |
| approved_amount | DECIMAL(10,2), NULL | Amount approved after adjudication |
| status | VARCHAR | PENDING, APPROVED, DENIED, or NEEDS_REVIEW |
| denial_reason | VARCHAR, NULL | Explanation if denied or partially covered |
| created_at | TIMESTAMP | Auto-set on creation |
| updated_at | TIMESTAMP | Auto-set on update |

### Dispute
Member disputing a claim decision.

| Field | Type | Description |
|-------|------|-------------|
| id | INTEGER, PK, AUTO | Unique identifier |
| claim_id | INTEGER, FK | References Claim.id |
| reason | VARCHAR | Member's explanation for disputing |
| status | VARCHAR | OPEN, UNDER_REVIEW, RESOLVED_UPHELD, or RESOLVED_OVERTURNED |
| resolution_notes | VARCHAR, NULL | Explanation of resolution decision |
| created_at | TIMESTAMP | Auto-set on creation |
| updated_at | TIMESTAMP | Auto-set on update |

---

## Relationships

```
Member.policy_id → Policy.id          (many-to-one: many members can share one policy)
Coverage.policy_id → Policy.id        (many-to-one: one policy has many coverage rules)
Coverage.service_code → Service.code  (many-to-one: one service can appear in many coverage rules)
Claim.member_id → Member.id           (many-to-one: one member can have many claims)
Claim.policy_id → Policy.id           (many-to-one: snapshots which policy was active at time of service)
LineItem.claim_id → Claim.id          (many-to-one: one claim has many line items)
LineItem.service_code → Service.code  (many-to-one: one service can appear in many line items)
Dispute.claim_id → Claim.id           (many-to-one: one claim can have many disputes)
```

---

## State Machines

### Claim States

```
SUBMITTED → UNDER_REVIEW                          (adjudication starts)
UNDER_REVIEW → APPROVED                           (all line items approved)
UNDER_REVIEW → DENIED                             (all line items denied)
UNDER_REVIEW → PARTIALLY_APPROVED                 (mix of approved and denied)
APPROVED/DENIED/PARTIALLY_APPROVED → DISPUTED     (member files dispute)
DISPUTED → UNDER_REVIEW                           (dispute overturned, re-adjudication needed)
DISPUTED → APPROVED/DENIED/PARTIALLY_APPROVED     (dispute upheld, reverts to original)
```

### LineItem States

```
PENDING → APPROVED        (covered, approved_amount set)
PENDING → DENIED          (not covered, denial_reason set)
PENDING → NEEDS_REVIEW    (system cannot auto-decide)
APPROVED/DENIED → PENDING (reset when dispute is overturned)
```

---

## Coverage Rule Model

Each policy has multiple coverage rules, one per service code. Each rule defines:
- **coverage_percentage**: What percentage of the eligible amount the insurer pays
- **annual_limit**: Maximum payout per year for that service (null = no limit)

A line item is "covered" only if a matching Coverage row exists for its `service_code` on the claim's `policy_id`. No matching rule = denied with reason "Service {code} is not covered under {plan_name}."

Coverage rules are enforced by a UNIQUE constraint on (policy_id, service_code), guaranteeing exactly one rule per service per policy.

---

## Adjudication Algorithm

For each line item in a claim (processed in order by ID):

1. **Policy active?** If policy.status != ACTIVE → DENIED
2. **Service date in range?** If claim.service_date outside [effective_from, effective_to] → DENIED
3. **Coverage rule exists?** Look up Coverage for (policy_id, service_code). If none → DENIED
4. **Annual limit exhausted?** Sum approved_amount for this member + service_code in the policy period. If remaining_limit <= 0 → DENIED
5. **Calculate deductible remaining:** Sum (billed - approved) from past approved claims + running total from current claim
6. **Apply deductible:** Subtract deductible_remaining from billed_amount. If entire amount goes to deductible, approved_amount = 0 (status still APPROVED)
7. **Apply coverage percentage:** amount_after_deductible * (coverage_percentage / 100)
8. **Apply annual limit cap:** payable = MIN(covered_amount, remaining_limit)
9. **Set results:** Update approved_amount, status, denial_reason with human-readable explanation

After all line items are processed:
- All APPROVED → claim status = APPROVED
- All DENIED → claim status = DENIED
- Mix → claim status = PARTIALLY_APPROVED
- Any NEEDS_REVIEW → claim status = UNDER_REVIEW

Deductible and annual limit tracking use in-memory running totals within the same claim to ensure line items processed later see the effects of earlier line items.
