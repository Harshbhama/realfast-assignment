# Decisions and Trade-offs

## What We Built

- REST API with 13 endpoints covering the full claims lifecycle
- SQLite database with 7 tables
- Seed data with 3 policy types, 8 service codes, 17 coverage rules
- Adjudication engine with 9 sequential checks
- Dispute flow with upheld/overturned resolution
- Detailed response format with claim-level summary and line-item breakdown

## Key Design Decisions

### 1. One member, one policy
The assignment scopes the relationship as "a member has a policy." We did not model family plans, dependents, or shared policies.

### 2. Deductible is per member
Even if multiple members share a policy, each tracks their own deductible independently. This avoids shared-pool complexity.

### 3. Service table as lookup
Service codes are enforced via FK constraints on both Coverage and LineItem tables, preventing typos and invalid codes.

### 4. Coverage rules as typed records
Each rule is a row with service_code, coverage_percentage, and annual_limit. Simple and queryable. We chose this over a DSL or expression language to keep complexity low.

### 5. Adjudication results stored on LineItem
We store approved_amount and denial_reason directly on the LineItem rather than a separate AdjudicationResult table. Simpler schema, fewer joins.

### 6. Claim status derived from line items
After adjudication, claim status is computed from the combination of line item statuses (all approved = APPROVED, all denied = DENIED, mix = PARTIALLY_APPROVED).

### 7. Deductible tracked via query, not stored counter
Instead of maintaining a running deductible_met column, we calculate it from approved claims history. Single source of truth, no drift.

### 8. Dispute resolution resets claim for re-adjudication
When a dispute is overturned, line items are reset to PENDING and claim status set to UNDER_REVIEW, allowing re-adjudication. We did not implement manual amount overrides.

### 9. Money stored as DECIMAL, never FLOAT
All monetary values use DECIMAL(10,2) to avoid floating point precision errors.

### 10. Diagnosis codes are sensitive health data
In production these would be encrypted at rest and access-restricted. Not implemented for this assignment but noted as a production concern.

## What We Did NOT Build

- Authentication or authorization
- Policy purchase or enrollment
- Member or provider account management
- Email notifications
- Reporting dashboards
- Admin panels
- Policy versioning or history
- Pre-authorization workflow
- Audit log table (relied on created_at/updated_at)
- Manual amount overrides on dispute resolution

## Assumptions

- One active policy per member at a time
- Deductible is annual, per member, across all services
- Annual limits are per service code, per member
- Coverage rules don't change mid-policy-period
- Service date determines which policy period applies, not submission date
- Provider is stored as a simple string, not a separate entity
