# Self-Review

## What's Good

- Clean domain model with clear entity separation
- Coverage rules are simple and extensible — adding a new service or policy is just inserting rows
- Adjudication engine handles all core cases: policy validation, service coverage, deductible tracking, annual limits, partial approvals
- Every decision produces a human-readable explanation
- Deductible tracking works correctly across multiple line items within the same claim (in-memory running total) and across multiple claims (database query)
- Dispute flow allows full re-adjudication cycle
- Response format includes claim-level summary with total_billed, total_approved, total_deductible_applied, total_member_responsibility
- Joi validation on all POST/PATCH endpoints catches bad input before it hits the service layer

## What's Rough

- No input sanitization beyond Joi validation
- No pagination on list endpoints
- No database indexes beyond primary keys and foreign keys (would matter at scale)
- Dispute overturn resets all line items — a more nuanced approach would allow overturning specific line items
- No test suite — adjudication logic was verified manually via curl/Postman
- Error messages could be more structured (error codes + messages instead of just strings)
- No transaction wrapping on adjudication — if it fails mid-way, line items could be partially updated
- Annual limit tracking doesn't account for approved amounts from the current claim's earlier line items being added to the running total (edge case with multiple line items using the same service code)

## What I'd Improve With More Time

- Add unit tests for the adjudication engine — each of the 9 checks should have a dedicated test
- Wrap adjudication in a database transaction for atomicity
- Add database indexes on frequently queried columns (member_id, policy_id, service_code, status)
- Implement per-line-item disputes instead of whole-claim disputes
- Add an audit trail table tracking every status change with actor and timestamp
- Add pagination to list endpoints (cursor-based for stability)
- Implement pre-authorization rules on certain service codes
- Add structured error responses with error codes for programmatic consumption
- Rate limiting on the adjudication endpoint to prevent duplicate processing
