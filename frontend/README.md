# Frontend

This directory contains the Next.js console for UnbiasedAI.

## What It Does

- Provides the login, dashboard, dataset, audit, report, and settings screens.
- Talks to the FastAPI backend for dataset listing, audit status, and results.
- Uses Prisma client types that are generated from the shared schema in `../prisma/schema.prisma`.

## Run It Locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000` after the backend is running.

## Main Entry Points

- `app/page.tsx` - redirect fallback when middleware is disabled.
- `app/dashboard/page.tsx` - audit overview and risk summary.
- `app/datasets/page.tsx` - dataset listing from the API store.
- `app/audit/` - audit creation and detail flows.

## Full Project Docs

See the repository root README for the complete architecture, setup, and workflow overview.
