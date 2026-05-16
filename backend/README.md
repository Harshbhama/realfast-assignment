# Claims Processing System

A REST API that processes insurance claims against coverage rules, tracks claims through their lifecycle, and produces explanations for every decision.

## Tech Stack

- Node.js
- Express 5
- SQLite (via Sequelize)
- Joi (request validation)

## Setup and Run

```bash
cd backend

# Install dependencies
npm install

# Create tables
npm run sync

# Seed reference data
npm run seed

# Start the server
npm start

# Server runs on http://localhost:3000
```

## Seed Data

- 8 service codes (GP_VISIT, SPECIALIST_VISIT, DENTAL_CLEANING, DENTAL_FILLING, MRI, XRAY, BLOOD_TEST, PHYSIOTHERAPY)
- 3 policies (Standard Health, Premium Health, Basic Dental)
- 17 coverage rules mapping services to policies with percentages and limits

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/policies | List all policies |
| GET | /api/policies/:id | Get one policy with coverage rules |
| GET | /api/services | List valid service codes |
| POST | /api/members | Create a member on a policy |
| GET | /api/claims | List all claims with line items |
| POST | /api/claims | Submit a claim with line items |
| POST | /api/claims/:id/adjudicate | Adjudicate a claim against coverage rules |
| GET | /api/claims/:id/disputes | List disputes for a claim |
| POST | /api/claims/:id/disputes | File a dispute against an adjudicated claim |
| PATCH | /api/disputes/:id | Resolve a dispute (uphold or overturn) |

## Testing the Full Flow

### 1. List policies
```bash
GET /api/policies
```

### 2. Create a member
```bash
POST /api/members
{
  "member_no": "M-100001",
  "full_name": "Jane Smith",
  "dob": "1990-05-15",
  "policy_id": 1
}
```

### 3. List services
```bash
GET /api/services
```

### 4. Submit a claim
```bash
POST /api/claims
{
  "member_id": 1,
  "policy_id": 1,
  "service_date": "2025-06-10",
  "provider_name": "City Hospital",
  "diagnosis_code": "J06.9",
  "line_items": [
    { "service_code": "GP_VISIT", "description": "General consultation", "billed_amount": 200.00 },
    { "service_code": "BLOOD_TEST", "description": "Complete blood count", "billed_amount": 350.00 }
  ]
}
```

### 5. Adjudicate the claim
```bash
POST /api/claims/1/adjudicate
```

### 6. View results
```bash
GET /api/claims
```

### 7. File a dispute
```bash
POST /api/claims/1/disputes
{
  "reason": "Blood test was medically necessary per doctor's recommendation"
}
```

### 8. Resolve the dispute
```bash
PATCH /api/disputes/1
{
  "resolution": "OVERTURNED",
  "resolution_notes": "Doctor's referral confirmed. Reprocessing claim."
}
```

### 9. Re-adjudicate after overturn
```bash
POST /api/claims/1/adjudicate
```

## Project Structure

```
backend/
├── app.js                          # Express entry point
├── sync.js                         # Database table sync (force: true)
├── seed.js                         # Seed reference data
├── package.json
├── config/
│   └── database.js                 # Sequelize + SQLite config
├── models/
│   ├── index.js                    # Relations and model exports
│   ├── Service.js
│   ├── Policy.js
│   ├── Coverage.js
│   ├── Member.js
│   ├── Claim.js
│   ├── LineItem.js
│   └── Dispute.js
├── services/
│   └── claimProcessingService.js   # Business logic
├── controllers/
│   └── claimProcessingController.js # Request handling
├── routes/
│   ├── index.js                    # Route mounting
│   └── claimProcessingRoutes.js    # All endpoint definitions
├── validators/
│   └── claimProcessingValidator.js # Joi schemas
├── middleware/
│   └── validate.js                 # Validation middleware
└── docs/
    ├── domain-model.md
    ├── decisions.md
    └── self-review.md
```

## Documentation

- [Domain Model](docs/domain-model.md) — Entities, relationships, state machines, adjudication algorithm
- [Decisions](docs/decisions.md) — Design decisions, trade-offs, assumptions
- [Self-Review](docs/self-review.md) — Honest assessment of strengths and limitations
