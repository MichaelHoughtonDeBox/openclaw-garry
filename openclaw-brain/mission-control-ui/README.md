# Mission Control UI

Full-stack Next.js dashboard for OpenClaw Mission Control.

## What this app does

- Create and track tasks through `todo -> in_progress -> review -> done`.
- Review and approve agent output directly from the UI.
- Show agent health and recent activity from Mongo-backed telemetry.
- Run task-level threaded comments with `@mentions` and queued notifications.
- Stream queue/feed invalidation signals over Server-Sent Events (`/api/stream`).
- Expose API routes for task operations, observability, and telemetry ingest.

## Stack

- Next.js App Router (`app/`)
- MongoDB (`tasks`, `activities`, and `documents` collections)
- shadcn/ui components
- Server-side API routes (Vercel-ready)

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Create local env file:

```bash
cp .env.example .env.local
```

3. Set required variables:

- `MISSION_CONTROL_MONGO_URI` (required)
- `MISSION_CONTROL_DB` (default `mission-control`)
- `MISSION_CONTROL_TASKS_COLLECTION` (default `tasks`)
- `MISSION_CONTROL_ACTIVITIES_COLLECTION` (default `activities`)
- `MISSION_CONTROL_DOCUMENTS_COLLECTION` (default `documents`)
- `MISSION_CONTROL_MESSAGES_COLLECTION` (default `messages`)
- `MISSION_CONTROL_NOTIFICATIONS_COLLECTION` (default `notifications`)

4. Start dev server:

```bash
npm run dev
```

## Useful commands

```bash
# lint checks
npm run lint
```

```bash
# production build validation
npm run build
```

```bash
# ingest OpenClaw cron run history into activities collection
npm run ingest:cron-runs
```

## Verification checklist

Run this sequence after wiring `.env.local`:

```bash
# 1) API smoke checks
curl -s http://localhost:7070/api/tasks | jq
curl -s http://localhost:7070/api/review-queue | jq
curl -s "http://localhost:7070/api/activities?limit=5" | jq
curl -s http://localhost:7070/api/agents/health | jq
curl -s "http://localhost:7070/api/documents?limit=5" | jq
```

```bash
# 2) UI task lifecycle smoke path
# Create task in UI -> post task thread message with @corey/@all -> create linked document -> move task to review -> approve in detail sheet
# Expected: task moves to done, message thread updates immediately, mention notifications are queued, and activity feed records document + task events.
```

## API routes

- `GET /api/tasks`
- `POST /api/tasks`
- `PATCH /api/tasks/:id/status`
- `POST /api/tasks/:id/logs`
- `GET /api/tasks/:id/messages`
- `POST /api/tasks/:id/messages`
- `POST /api/tasks/:id/documents`
- `GET /api/review-queue`
- `GET /api/activities`
- `GET /api/agents/health`
- `GET /api/stream`
- `GET /api/notifications`
- `POST /api/notifications/:id/deliver`
- `GET /api/documents`
- `POST /api/documents`
- `GET /api/documents/:id`
- `POST /api/tasks/release-dependencies`
- `POST /api/telemetry/ingest`

## Security toggles

- `MISSION_CONTROL_AUTH_ENABLED=true` to enable MongoDB-based session auth on app + API.
- `MISSION_CONTROL_SESSION_SECRET` – min 32 chars; signs session JWTs. Required when auth enabled.
- `MISSION_CONTROL_PASSWORD_PEPPER` – (optional) extra secret for password hashing.
- `MISSION_CONTROL_USERS_COLLECTION` – MongoDB collection for users (default: `users`).
- `MISSION_CONTROL_MUTATION_SECRET` to require `x-mission-secret` on mutating APIs.
- `MISSION_CONTROL_INGEST_TOKEN` to authorize `/api/telemetry/ingest`.

### Bootstrapping the first user

When auth is enabled, create the first user with:

```bash
MISSION_CONTROL_SESSION_SECRET=your-32-char-secret npm run seed:auth admin yourPassword
```

Or with a `.env.local`:

```bash
npm run seed:auth admin yourPassword
```

### Adding users (admin API)

`POST /api/auth/users` with `{ username, password }` – requires an existing logged-in session.

## Vercel deployment checklist

1. Import this app directory as a Vercel project root (`openclaw-brain/mission-control-ui`).
2. Set all `MISSION_CONTROL_*` env vars in Vercel.
3. Ensure Mongo network access allows Vercel egress (or private networking strategy).
4. Deploy and verify:
   - `/` loads dashboard
   - `/api/tasks` returns data
   - task create + approve flow works
   - activities feed updates over polling
   - if auth is enabled, both UI and API challenge unauthenticated requests
This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:7070](http://localhost:7070) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
