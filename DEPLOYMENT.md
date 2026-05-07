# Deployment Instructions for Dynasty Degenerates

This project is a full-stack application with a React frontend and a Node.js/Express backend. It requires a live server and a MySQL-compatible database.

## Recommended Hosting: Vercel

The app is configured for **Vercel** with a Vite static frontend, serverless API routes, and Vercel Cron for scheduled KTC snapshots. It still needs a hosted database for persisted snapshots and auth/session-backed data.

### Environment Variables

You must configure the following environment variables in your deployment platform:

#### Frontend (Vite)
- `VITE_APP_ID`: Your Manus App ID.
- `VITE_OAUTH_PORTAL_URL`: The URL of your OAuth portal.
- `VITE_FRONTEND_FORGE_API_KEY`: (Optional) For Google Maps features.

#### Backend (Node.js)
- `DATABASE_URL`: Your MySQL connection string (e.g., `mysql://user:pass@host:port/db`).
- `JWT_SECRET`: A secure random string for session signing.
- `OWNER_OPEN_ID`: Your Manus OpenID (to grant admin access).
- `FANTASYPROS_API_KEY`: FantasyPros API key for rankings, points, and injury data.
- `CRON_SECRET`: A random secret used by Vercel Cron when calling `/api/cron/ktc-snapshot`.
- `LEAGUE_REPORT_WARM_LEAGUE_IDS`: Optional comma- or space-separated Sleeper league IDs to prebuild into the shared server cache after value snapshots.
- `BUILT_IN_FORGE_API_URL`: (Optional) For storage/data features.
- `BUILT_IN_FORGE_API_KEY`: (Optional) For storage/data features.

### Build Commands
- **Install**: `pnpm install`
- **Build**: `pnpm build`
- **Start**: `pnpm start`

### Database Setup
Run the following command to push the schema to your database:
```bash
pnpm db:push
```

## OAuth Configuration
Ensure your OAuth portal is configured with the following callback URL:
`https://your-production-domain.com/api/oauth/callback`

## Vercel Cron
`vercel.json` calls `/api/cron/ktc-snapshot` at paired UTC times for `06:00` and `18:00` in `America/Vancouver`. The endpoint checks Pacific time before doing work, so the extra UTC entries are daylight-saving fallbacks.

`/api/cron/league-report-cache` runs 20 minutes after the snapshot windows. Set `LEAGUE_REPORT_WARM_LEAGUE_IDS` to warm shared report and rankings caches for important leagues before users load the site.
