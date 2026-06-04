#!/usr/bin/env node

import "../server/_core/env";
import { evaluateOperationsSecurityReadiness } from "../server/operationsSecurityReadiness";

const readiness = evaluateOperationsSecurityReadiness();

console.log("# Operations Security Readiness Audit");
console.log(`Generated: ${readiness.generatedAt}`);
console.log(`Production mode: ${readiness.production ? "yes" : "no"}`);
console.log(`Totals: pass=${readiness.totals.pass} warn=${readiness.totals.warn} blocker=${readiness.totals.blocker}`);

for (const check of readiness.checks) {
  const label = check.status.toUpperCase();
  const envNames = check.envNames.length ? ` [${check.envNames.join(", ")}]` : "";
  console.log(`${label} ${check.id}${envNames}: ${check.message}`);
}

if (readiness.totals.blocker > 0) {
  process.exitCode = 1;
}
