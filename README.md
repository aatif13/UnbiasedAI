# UnbiasedAI

UnbiasedAI is a full-stack fairness auditing workspace for machine learning and decision systems. It combines a Next.js console, a FastAPI audit engine, and a Prisma/PostgreSQL data model so teams can upload datasets, profile sensitive attributes, run bias checks, inspect results, and generate shareable reports.

## At A Glance

- 2 runtime apps: `frontend/` and `backend/`
- 4 FastAPI routers: datasets, audits, reports, auth
- 4 Prisma models: `User`, `Dataset`, `Audit`, `Report`
- 3 bundled sample datasets: hiring bias, loan approval, recidivism
- 1 demo seed file for instant startup data

## What The Project Does

The project is designed to answer one question: how fair is a model or decision process across groups?

Users can:

- Upload tabular data in CSV, JSON, or Excel format.
- Inspect automatic column statistics and sensitive attribute guesses.
- Start a background fairness audit against a chosen target column.
- Review metrics, explainability output, remediations, and compliance-oriented summaries.
- Share a generated HTML report with a token-based public link.

## How It Works

1. A dataset is uploaded through the frontend or directly through the API.
2. The backend stores the file, profiles columns, and detects likely sensitive attributes.
3. The user configures an audit with the target column, sensitive attributes, and model context.
4. A background job computes fairness metrics, risk level, explainability signals, and remediation suggestions.
5. Results are shown in the dashboard and can be exported as a report.

In demo mode, the backend loads `sample_data/demo_seed.json` on startup so the app can show realistic audit content immediately.

## Architecture

### Frontend

The frontend is a Next.js 14 App Router application with:

- authentication screens for login and registration,
- a dashboard for audit overview,
- dataset browsing and upload flows,
- audit creation and audit detail routes,
- report views and settings pages,
- charts and visual summaries built with Recharts and D3.

### Backend

The backend is a FastAPI service that provides:

- dataset upload and preview endpoints,
- asynchronous audit execution,
- progress polling and results retrieval,
- public report sharing,
- lightweight auth health and token verification stubs.

### Data Layer

Prisma connects the app to PostgreSQL. The schema stores:

- users and roles,
- datasets and upload metadata,
- audits and audit results,
- generated reports and share tokens.

## Main API Flow

### Dataset lifecycle

- `POST /datasets/upload` accepts CSV, JSON, and Excel files.
- `POST /datasets/{id}/preview` refreshes column statistics.
- `GET /datasets/{id}/raw-head` returns a lightweight table preview.

### Audit lifecycle

- `POST /audits/run` starts an asynchronous audit.
- `GET /audits/{id}/status` returns progress information.
- `GET /audits/{id}/results` returns the full audit payload.
- `GET /audits/{id}/report` returns the HTML report and share token.

### Report sharing

- `GET /reports/share/{token}` renders the public HTML report.
- `GET /reports/{audit_id}/export` provides an exportable HTML download response.

## Fairness Engine

The audit engine in `backend/services/bias_detector.py` is responsible for the statistical checks. It includes demographic parity, equalized odds, disparate impact signals, group error rates, consistency, representation analysis, intersectional summaries, and sensitive attribute detection.

It also handles common target-shaping cases:

- continuous targets can be binarized with a regression threshold,
- multi-class targets can select a positive label,
- missing-data warnings help users choose an imputation strategy before auditing.

## Statistics And Signals

The project surfaces the following quantitative outputs in the UI and API responses:

- overall fairness score,
- coarse risk level: low, medium, high, or critical,
- group-level metric comparisons,
- SHAP-style explainability summaries when available,
- remediation suggestions tied to specific violations,
- dataset-level column summaries such as null counts, unique values, sample values, and mini histograms.

## Local Setup

### 1. Database

Create a PostgreSQL database and set `DATABASE_URL` before running Prisma migrations.

### 2. Backend

```bash
cd unbiasedai/backend
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
set DEMO_MODE=true
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

### 3. Frontend

```bash
cd unbiasedai/frontend
npm install
npm run dev
```

### 4. Migrations

```bash
cd unbiasedai/frontend
npx prisma migrate dev
```

## Docker

```bash
cd unbiasedai
docker compose up --build
```

The compose setup runs PostgreSQL, the FastAPI backend, and the Next.js frontend together.

## Vercel Deployment

If you deploy this monorepo to Vercel, set the project Root Directory to `frontend/`.

The repository root does not contain the Next.js app or a root `package.json`, so running a build from the top-level folder will fail. The frontend build should run from `frontend/`, with the usual environment variables set there:

- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `NEXT_PUBLIC_API_URL`
- Google OAuth variables, if you enable sign-in with Google

The app uses middleware to route `/` to `/login` and protect authenticated pages like `/dashboard`, `/datasets`, `/audit`, `/reports`, and `/settings`.

## Demo Credentials

The login screen includes demo credentials for local exploration. Google OAuth can be wired in through environment variables if you want real authentication.

## Project Notes

- The backend currently keeps datasets and audits in an in-memory store for the prototype flow.
- The public report route is HTML-based and ready for later PDF integration.
- The compliance and remediation content is informational and should not be treated as legal advice.

## Repository Layout

- `frontend/` - Next.js console, UI components, auth flow, charts, and Prisma client usage.
- `backend/` - FastAPI service, audit jobs, dataset ingestion, metrics, remediation, and compliance logic.
- `prisma/` - Shared schema used by the frontend and backend workflow.
- `sample_data/` - Seed data and demo datasets.

## License

No license file is currently provided. Add one before publishing the project publicly.
