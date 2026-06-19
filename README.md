# PromptForge

PromptForge is a web application for creating, organizing, and managing AI prompts.
This repository is a monorepo containing the backend API, the frontend web client,
and infrastructure-as-code definitions.

## Repository Structure

```
promptforge/
├── backend/    # FastAPI service (Python)
├── frontend/   # Web client (scaffolded later)
├── infra/      # Infrastructure as code (scaffolded later)
├── .gitignore
└── README.md
```

## Tech Stack

- **Backend:** FastAPI, Pydantic, Google Cloud Firestore, Firebase Admin
- **Frontend:** _to be scaffolded_
- **Infrastructure:** Google Cloud Platform _(to be scaffolded)_

## Getting Started

### Prerequisites

- Python 3.11+
- Node.js 18+ (for the frontend, once scaffolded)
- A Google Cloud project with Firestore enabled
- A Firebase project for authentication
- A GCP service account credentials JSON file

### Backend

1. Change into the backend directory:

   ```bash
   cd backend
   ```

2. Create and activate a virtual environment:

   ```bash
   python -m venv .venv
   source .venv/bin/activate   # On Windows: .venv\Scripts\activate
   ```

3. Install dependencies:

   ```bash
   pip install -r requirements.txt
   ```

4. Create your environment file from the example and fill in the values:

   ```bash
   cp .env.example .env
   ```

   | Variable | Description |
   | --- | --- |
   | `GCP_PROJECT_ID` | Google Cloud project ID |
   | `FIREBASE_PROJECT_ID` | Firebase project ID used for auth token verification |
   | `GOOGLE_APPLICATION_CREDENTIALS` | Absolute path to the service account JSON file |
   | `ENVIRONMENT` | Runtime environment (`dev` or `prod`) |
   | `CORS_ORIGINS` | Comma-separated list of allowed CORS origins |

5. Run the development server:

   ```bash
   uvicorn app.main:app --reload
   ```

   The API will be available at `http://localhost:8000`.

6. Run the tests:

   ```bash
   pytest
   ```

### Frontend

> The frontend has not been scaffolded yet. Setup steps will be added here once
> the `frontend/` workspace is created.

1. Change into the frontend directory:

   ```bash
   cd frontend
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Start the development server:

   ```bash
   npm run dev
   ```

## Phase 1 checklist
- [ ] GCP project created, Firestore in native mode enabled
- [ ] Firebase project created, Google Sign-In enabled in Authentication
- [ ] Service account created with roles: Cloud Datastore User,
      Firebase Admin SDK Administrator Service Agent
- [ ] Service account JSON key downloaded, path set in GOOGLE_APPLICATION_CREDENTIALS
- [ ] backend/.env filled with real values
- [ ] frontend/.env.local filled with Firebase config values
- [ ] `make install` run successfully
- [ ] `make backend-test` passes all tests
- [ ] `make dev` starts both frontend and backend
- [ ] Login with Google works
- [ ] Can create a prompt from the UI
- [ ] Prompt appears in the list
- [ ] Can open prompt detail page
- [ ] Can add a new version from the editor
- [ ] Can promote a version to stable

## License

TBD
