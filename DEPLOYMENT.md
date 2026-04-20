# Deployment Instructions for Dynasty Degenerates

This project is a full-stack application with a React frontend and a Node.js/Express backend. It requires a live server and a MySQL-compatible database.

## Recommended Hosting: Vercel or Railway

Since the project has a live Node.js backend and a database requirement, I recommend using **Vercel** (for the app) and a hosted **MySQL** provider (like PlanetScale or TiDB Cloud).

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
