import type { Express, NextFunction, Request, Response } from "express";

const PRODUCTION_CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self' https://formspree.io",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https://fonts.gstatic.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "script-src 'self' 'unsafe-inline'",
  "connect-src 'self' https://formspree.io https://fonts.googleapis.com https://fonts.gstatic.com",
  "upgrade-insecure-requests",
].join("; ");

function setHeaderIfMissing(res: Response, key: string, value: string) {
  if (!res.getHeader(key)) {
    res.setHeader(key, value);
  }
}

export function securityHeaders(req: Request, res: Response, next: NextFunction) {
  setHeaderIfMissing(res, "X-Content-Type-Options", "nosniff");
  setHeaderIfMissing(res, "X-Frame-Options", "DENY");
  setHeaderIfMissing(res, "Referrer-Policy", "strict-origin-when-cross-origin");
  setHeaderIfMissing(
    res,
    "Permissions-Policy",
    "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()"
  );

  if (req.path.startsWith("/api/")) {
    setHeaderIfMissing(res, "Cache-Control", "private, no-store, max-age=0");
    setHeaderIfMissing(res, "X-Robots-Tag", "noindex, nofollow, noarchive");
  }

  if (process.env.NODE_ENV === "production") {
    setHeaderIfMissing(res, "Content-Security-Policy", PRODUCTION_CSP);
  }

  next();
}

export function configureSecurity(app: Express) {
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(securityHeaders);
}

export function apiNotFoundHandler(req: Request, res: Response, next: NextFunction) {
  if (!req.path.startsWith("/api/")) {
    next();
    return;
  }

  res.status(404).json({ ok: false, error: "Not found" });
}

export function apiErrorHandler(error: unknown, _req: Request, res: Response, next: NextFunction) {
  if (res.headersSent) {
    next(error);
    return;
  }

  console.error("[API] Unhandled request error", error);
  res.status(500).json({ ok: false, error: "Internal server error" });
}
