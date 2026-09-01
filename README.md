# CyberLab

CyberLab is a cybersecurity learning and hands-on practice platform with student and administrator experiences.

## Repository layout

- `artifacts/cyberlab` — React/Vite frontend
- `artifacts/api-server` — Express API server
- `lib/api-spec` — OpenAPI contract
- `lib/api-client-react` — generated React Query client
- `lib/api-zod` — generated server validation schemas
- `lib/db` — Drizzle schema and database package

## Run locally

This is a PNPM workspace. From the repository root:

```bash
pnpm install
pnpm --filter @workspace/api-server run dev
pnpm --filter @workspace/cyberlab run dev
```

The frontend uses the API at `/api` by default. To use a separate API host, set `VITE_API_URL` to its full HTTPS URL.

## Deploy the frontend to Vercel

The root `vercel.json` is already configured for the CyberLab frontend.

1. Import this repository into Vercel.
2. Keep the Vercel Root Directory set to the repository root.
3. Add these Vercel environment variables:

```text
VITE_CLERK_PUBLISHABLE_KEY=<your production Clerk publishable key>
VITE_API_URL=<your public API HTTPS URL>
```

4. Deploy.

The Express API must be deployed separately on Replit or another backend host. Do not use `localhost` as `VITE_API_URL` in Vercel.

For Clerk production authentication, add the Vercel domain to the Clerk allowed origins and configure the `/sign-in` and `/sign-up` redirect URLs.

## Database and Docker

The API uses PostgreSQL through Drizzle. Lab Docker execution is intentionally separated behind an external adapter boundary and remains unavailable until a Docker host and adapter are installed.
