**CIN ID:** FIT/OCT26/FS21724
# Client Lead Management System (Mini CRM)

A full-stack web app for capturing website leads and moving them through a sales pipeline. Leads arrive from a contact form, and an admin dashboard lets the team track each lead's stage and keep a timestamped history of notes.

> Internship assignment: Full Stack Web Development (Track Code: FS)

## Screenshots

<!-- Replace these with your own screenshots after running the app. -->

| Dashboard | Notes panel |
| --- | --- |
| ![Dashboard](docs/dashboard.png) | ![Notes panel](docs/notes-panel.png) |

## Features

- **Lead capture:** a public endpoint for website contact forms, with server-side validation and spam protection.
- **Pipeline stages:** every lead moves through `New → Contacted → In Progress → Converted`.
- **Summary tiles:** total, new, contacted and converted counts, plus a pipeline bar. Click a tile to filter the table.
- **Add lead from the dashboard:** an "Add lead" form for enquiries that arrive by phone or in person. It uses the same endpoint as the website form.
- **Instant status updates:** change a lead's stage from a dropdown in its table row.
- **Notes history:** a slide-out panel shows previous notes with timestamps and lets you append new ones.
- **Edit and soft delete:** leads can be corrected, and "removing" a lead only hides it from the dashboard. The record stays in the database.
- **Audit trail:** every create, edit, status change, delete and restore is logged with old and new values, a timestamp and the caller's IP.
- **Secure backend setup:** helmet headers, CORS allow-list, rate limiting, payload size limit, input whitelisting and centralised error handling.

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | React, Vite, Tailwind CSS, Axios |
| Backend | Node.js, Express.js |
| Database | MongoDB with Mongoose |
| Security | helmet, cors, express-rate-limit, dotenv |

## Project Structure

```
FUTURE_FS_02/
├── backend/
│   ├── server.js              # Express setup, middleware, error handling, DB connection
│   ├── models/Lead.js         # Mongoose schema
│   ├── routes/leadRoutes.js   # REST endpoints
│   ├── package.json
│   └── .env.example
└── frontend/
    └── src/
        ├── App.jsx            # State management and API wiring
        ├── api/leads.js       # Axios calls to the backend
        ├── lib/status.js      # Pipeline stages, colors, date helpers
        └── components/
            ├── Stats.jsx      # Summary tiles
            ├── LeadTable.jsx        # Lead table with status dropdown, Edit and Remove
            ├── NotesPanel.jsx       # Notes history and add-note form
            ├── AddLeadModal.jsx     # Create a lead from the dashboard
            ├── EditLeadModal.jsx    # Correct name, email or source
            └── DeleteLeadDialog.jsx # Confirm a soft delete, with optional reason
```

## Getting Started

### Prerequisites

- Node.js 18 or newer
- A MongoDB database (local install or a free MongoDB Atlas cluster)

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env      # then edit .env with your values
npm run dev
```

The API runs on `http://localhost:5000`. Check `http://localhost:5000/health` to confirm the database is connected.

**Environment variables** (`backend/.env`)

| Variable | Description | Example |
| --- | --- | --- |
| `PORT` | Port for the API | `5000` |
| `NODE_ENV` | `development` or `production` | `development` |
| `MONGO_URI` | MongoDB connection string | `mongodb://127.0.0.1:27017/mini_crm` |
| `CORS_ORIGIN` | Comma-separated list of allowed frontend URLs | `http://localhost:5173` |
| `AUDIT_KEY` | Secret key for the audit endpoints (long random value) | `change-this-to-a-long-random-secret` |
| `LEAD_FORM_LIMIT` | Optional. Lead submissions allowed per IP every 15 minutes (default 5) | `50` |
| `TRUST_PROXY` | Optional. Set to `1` behind a hosting proxy so the real visitor IP is logged | `1` |

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

The dashboard runs on `http://localhost:5173`. To point it at a different backend, create `frontend/.env`:

```
VITE_API_URL=http://localhost:5000/api
```

## API Documentation

Base URL: `http://localhost:5000/api`

All responses are JSON. Successful responses look like `{ "success": true, "data": ... }`. Errors look like `{ "success": false, "message": "..." }`.

### Lead object

```json
{
  "_id": "665f1c2e9b1e8a0012a4d3f1",
  "name": "Asha Verma",
  "email": "asha@example.com",
  "source": "Website",
  "status": "New",
  "notes": [
    { "_id": "665f1c2e9b1e8a0012a4d3f2", "text": "Asked for a quote", "createdAt": "2026-11-03T09:30:00.000Z" }
  ],
  "createdAt": "2026-11-03T09:30:00.000Z",
  "updatedAt": "2026-11-03T09:30:00.000Z"
}
```

`source` is one of `Website`, `Ads`, `Referral`, `Social Media`, `Email Campaign`, `Other` (default `Website`).
`status` is one of `New`, `Contacted`, `In Progress`, `Converted` (default `New`).

### Endpoints

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `POST` | `/api/leads` | Create a lead from the website contact form |
| `GET` | `/api/leads` | List leads, newest first |
| `PUT` | `/api/leads/:id/status` | Update a lead's pipeline stage |
| `PATCH` | `/api/leads/:id/notes` | Append a timestamped note |
| `PATCH` | `/api/leads/:id` | Edit name, email or source |
| `DELETE` | `/api/leads/:id` | Soft delete: hide the lead, keep the record |
| `GET` | `/api/leads/deleted` | Deleted leads with audit logs (audit key) |
| `GET` | `/api/leads/:id/audit` | Full audit log of one lead (audit key) |
| `POST` | `/api/leads/:id/restore` | Restore a deleted lead (audit key) |
| `GET` | `/health` | Server and database health check |

---

#### `POST /api/leads`

Creates a new lead. Status always starts as `New`. Used by the website contact form and by the dashboard's Add lead button. Rate limited per IP (5 submissions per 15 minutes by default, configurable with `LEAD_FORM_LIMIT`).

**Body**

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `name` | string | yes | 2 to 100 characters |
| `email` | string | yes | Must be a valid email |
| `source` | string | no | One of the allowed sources |
| `notes` | string | no | Becomes the first note |

```bash
curl -X POST http://localhost:5000/api/leads \
  -H "Content-Type: application/json" \
  -d '{"name":"Asha Verma","email":"asha@example.com","source":"Ads","notes":"Asked for a quote"}'
```

**Response `201 Created`**: the new lead object in `data`.

---

#### `GET /api/leads`

Returns leads sorted newest first.

**Query parameters**

| Parameter | Description | Default |
| --- | --- | --- |
| `status` | Filter by stage, e.g. `?status=New` | all |
| `page` | Page number | `1` |
| `limit` | Page size (maximum 100) | `50` |

```bash
curl "http://localhost:5000/api/leads?status=New&limit=20"
```

**Response `200 OK`**

```json
{
  "success": true,
  "count": 20,
  "total": 134,
  "page": 1,
  "pages": 7,
  "data": [ { "...": "lead objects" } ]
}
```

---

#### `PUT /api/leads/:id/status`

Moves a lead to another pipeline stage.

**Body**: `{ "status": "Contacted" }`

```bash
curl -X PUT http://localhost:5000/api/leads/665f1c2e9b1e8a0012a4d3f1/status \
  -H "Content-Type: application/json" \
  -d '{"status":"Contacted"}'
```

**Response `200 OK`**: the updated lead in `data`.

---

#### `PATCH /api/leads/:id/notes`

Appends a note to the lead's history. The server sets the timestamp, and existing notes are never changed.

**Body**: `{ "text": "Called today, follow up on Friday" }` (1 to 1000 characters)

```bash
curl -X PATCH http://localhost:5000/api/leads/665f1c2e9b1e8a0012a4d3f1/notes \
  -H "Content-Type: application/json" \
  -d '{"text":"Called today, follow up on Friday"}'
```

**Response `200 OK`**: the updated lead, including the new note.

---

### Error responses

| Status | Meaning |
| --- | --- |
| `400` | Validation failed, invalid id, invalid status, or malformed JSON |
| `403` | Request origin not allowed by CORS |
| `404` | Lead or route not found |
| `413` | Request body larger than 10 KB |
| `429` | Too many requests (rate limit) |
| `500` | Unexpected server error (details hidden in production) |

## Soft Delete and Audit Trail

A lead manager could be tempted to erase a lead (for example after being paid to). To prevent that, the API never physically deletes data:

- `DELETE /api/leads/:id` sets `isDeleted: true` and `deletedAt`. The lead disappears from the dashboard, but the document stays in MongoDB.
- Each lead has an append-only `auditLog` recording what happened, the old and new values, an optional reason, the time and the IP address.
- The dashboard never receives deleted leads or audit logs. Reviewers read them through audit endpoints that need the `x-audit-key` header (the value of `AUDIT_KEY` in the backend `.env`).

```bash
# Every deleted lead with its history
curl http://localhost:5000/api/leads/deleted -H "x-audit-key: YOUR_AUDIT_KEY"

# Restore a lead that was deleted by mistake
curl -X POST http://localhost:5000/api/leads/LEAD_ID/restore -H "x-audit-key: YOUR_AUDIT_KEY"
```

## Security Measures

- Database credentials live in `.env`, which is never committed to Git.
- `helmet` sets protective HTTP headers.
- CORS only allows the origins listed in `CORS_ORIGIN`. In development any `localhost` port is also accepted; this is switched off when `NODE_ENV=production`.
- Request bodies are limited to 10 KB.
- A general rate limit covers the whole API, with a stricter limit on the public form endpoint.
- Only whitelisted fields are accepted on lead creation, which prevents mass assignment.
- Query filters are checked against the allowed values, which blocks NoSQL injection through query strings.
- IDs are validated before reaching the database.

## Known Limitations and Future Improvements

- **No admin login yet.** The dashboard endpoints (`GET`, `PUT`, `PATCH`, `DELETE`) are open, so the audit log can only record the IP address, not which admin acted. The next step is JWT login for admins, with the middleware protecting those routes while the public form endpoint stays open.
- The dashboard loads the latest 100 leads, so tile counts are based on those. Server-side aggregation would give exact totals for larger datasets.
- Ideas for later: search, email notifications for new leads, and automated tests.
