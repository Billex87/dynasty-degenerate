import "./env";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { apiErrorHandler, apiNotFoundHandler, configureSecurity } from "./security";
import { serveStatic, setupVite } from "./vite";
import { initializeScheduledJobs } from "../scheduledJobs";
import { handleStripeWebhookPayload } from "../stripeWebhook";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  configureSecurity(app);
  app.post("/api/billing/stripe-webhook", express.raw({ type: "application/json", limit: "1mb" }), (req, res) => {
    const result = handleStripeWebhookPayload({
      payload: Buffer.isBuffer(req.body) ? req.body : Buffer.from(String(req.body || ""), "utf8"),
      signatureHeader: typeof req.headers["stripe-signature"] === "string" ? req.headers["stripe-signature"] : null,
      secret: process.env.STRIPE_WEBHOOK_SECRET,
    });

    res.status(result.status).json(result.body);
  });
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ limit: "1mb", extended: true, parameterLimit: 100 }));
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  app.use(apiNotFoundHandler);
  app.use(apiErrorHandler);
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
    const shouldRunScheduledJobs =
      process.env.DISABLE_SCHEDULED_JOBS !== "true" &&
      (process.env.NODE_ENV !== "development" || process.env.ENABLE_SCHEDULED_JOBS === "true");

    if (shouldRunScheduledJobs) {
      initializeScheduledJobs();
    } else {
      console.log("Scheduled jobs disabled for this server process");
    }
  });
}

startServer().catch(console.error);
