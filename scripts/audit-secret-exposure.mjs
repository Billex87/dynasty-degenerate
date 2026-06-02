#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const SECRET_ENV_NAMES = [
  "ADMIN_LOGIN_PASSWORD",
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "CRON_SECRET",
  "DATABASE_URL",
  "FANTASYPROS_API_KEY",
  "FANTASY_NERDS_API_KEY",
  "JWT_SECRET",
  "NEON_DATABASE_URL",
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
  "SOURCE_HEALTH_ALERT_WEBHOOK_URL",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
];

const CLIENT_ALLOWED_IMPORT_META_ENV = new Set([
  "BASE_URL",
  "DEV",
  "MODE",
  "PROD",
  "SSR",
]);

const CODE_EXTENSIONS = new Set([
  ".cjs",
  ".cts",
  ".js",
  ".jsx",
  ".mjs",
  ".mts",
  ".ts",
  ".tsx",
]);

const PUBLIC_EXTENSIONS = new Set([
  ".css",
  ".html",
  ".js",
  ".json",
  ".map",
  ".svg",
  ".txt",
  ".webmanifest",
  ".xml",
]);

const SKIP_DIRS = new Set([
  ".git",
  ".next",
  ".vercel",
  "coverage",
  "dist",
  "node_modules",
  "playwright-report",
  "test-results",
]);

function walk(dir, extensions, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, extensions, files);
    } else if (extensions.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }
  return files;
}

function relative(filePath) {
  return path.relative(root, filePath);
}

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function lineNumber(text, index) {
  return text.slice(0, index).split("\n").length;
}

const findings = [];

function addFinding(filePath, message, index = 0) {
  findings.push({
    file: relative(filePath),
    line: lineNumber(read(filePath), index),
    message,
  });
}

function scanClientEnvBoundaries() {
  const files = walk(path.join(root, "client", "src"), CODE_EXTENSIONS);
  const secretPattern = new RegExp(`\\b(${SECRET_ENV_NAMES.join("|")})\\b`, "g");

  for (const file of files) {
    const text = read(file);
    const processEnvIndex = text.search(/\bprocess\.env\b/);
    if (processEnvIndex >= 0) {
      addFinding(file, "Client code must not read process.env; use import.meta.env with VITE_ public keys only.", processEnvIndex);
    }

    for (const match of text.matchAll(/\bimport\.meta\.env\.([A-Z0-9_]+)/g)) {
      const envName = match[1];
      if (CLIENT_ALLOWED_IMPORT_META_ENV.has(envName) || envName.startsWith("VITE_")) continue;
      addFinding(file, `Client import.meta.env key is not public-safe: ${envName}.`, match.index || 0);
    }

    for (const match of text.matchAll(secretPattern)) {
      addFinding(file, `Sensitive server env name must not appear in client source: ${match[1]}.`, match.index || 0);
    }
  }
}

function scanPublicAssets() {
  const publicDirs = [
    path.join(root, "client", "public"),
    path.join(root, "public"),
  ];
  const secretPattern = new RegExp(`\\b(${SECRET_ENV_NAMES.join("|")})\\b`, "g");

  for (const dir of publicDirs) {
    for (const file of walk(dir, PUBLIC_EXTENSIONS)) {
      const text = read(file);
      for (const match of text.matchAll(secretPattern)) {
        addFinding(file, `Sensitive server env name must not appear in public assets: ${match[1]}.`, match.index || 0);
      }
    }
  }
}

function scanSecretLogging() {
  const roots = ["api", "server", "scripts"].map((dir) => path.join(root, dir));
  const logPattern = /\bconsole\.(?:debug|error|info|log|warn)\s*\(([^;\n]*)/g;
  const directSecretEnvPattern = new RegExp(`\\bprocess\\.env\\.(?:${SECRET_ENV_NAMES.join("|")})\\b`);
  const bracketSecretEnvPattern = new RegExp(`\\bprocess\\.env\\[['"](?:${SECRET_ENV_NAMES.join("|")})['"]\\]`);
  const rawProcessEnvPattern = /\bprocess\.env\b(?!\s*(?:\.|\[))/;

  for (const dir of roots) {
    for (const file of walk(dir, CODE_EXTENSIONS)) {
      const text = read(file);
      for (const match of text.matchAll(logPattern)) {
        const logExpression = match[1] || "";
        if (
          directSecretEnvPattern.test(logExpression) ||
          bracketSecretEnvPattern.test(logExpression) ||
          rawProcessEnvPattern.test(logExpression)
        ) {
          addFinding(file, "Console logging must not include raw process.env or sensitive env values.", match.index || 0);
        }
      }
    }
  }
}

scanClientEnvBoundaries();
scanPublicAssets();
scanSecretLogging();

if (findings.length) {
  console.error("Secret exposure audit failed:");
  for (const finding of findings) {
    console.error(`- ${finding.file}:${finding.line} ${finding.message}`);
  }
  process.exit(1);
}

console.log("Secret exposure audit passed: no client/public secret env references or unsafe env logging found.");
