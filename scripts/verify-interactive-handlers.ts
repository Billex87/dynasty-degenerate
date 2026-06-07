import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const HANDLER_ATTRS = new Set<string>([
  "onClick",
  "onMouseEnter",
  "onMouseLeave",
  "onMouseOver",
  "onMouseOut",
  "onFocus",
  "onBlur",
  "onDoubleClick",
  "onContextMenu",
  "onPointerDown",
  "onPointerUp",
  "onPointerEnter",
  "onPointerLeave",
  "onSubmit",
  "onKeyDown",
  "onKeyUp",
  "onKeyPress",
  "onTouchStart",
  "onTouchEnd",
]);

type Finding = {
  file: string;
  line: number;
  handler: string;
  snippet: string;
};

function walkDir(directory: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist" || entry.name === "build") {
        continue;
      }
      walkDir(fullPath, acc);
      continue;
    }

    if (entry.isFile() && /\.(tsx|jsx)$/.test(entry.name)) {
      acc.push(fullPath);
    }
  }

  return acc;
}

function isNullish(expr: ts.Expression | undefined): boolean {
  if (!expr) return false;

  if (ts.isIdentifier(expr) && (expr.text === "undefined")) return true;
  if (expr.kind === ts.SyntaxKind.NullKeyword) return true;
  if (ts.isVoidExpression(expr)) return isNullish(expr.expression);

  if (ts.isNumericLiteral(expr) && expr.text === "0") return true;
  if (expr.kind === ts.SyntaxKind.TrueKeyword || expr.kind === ts.SyntaxKind.FalseKeyword) return false;

  if (ts.isParenthesizedExpression(expr)) return isNullish(expr.expression);

  return false;
}

function isNoOpArrowBody(body: ts.ConciseBody): boolean {
  if (ts.isBlock(body)) {
    if (body.statements.length === 0) return true;
    if (body.statements.length === 1) {
      const [only] = body.statements;
      return (
        ts.isReturnStatement(only) &&
        ((only.expression === undefined) || isNullish(only.expression))
      );
    }

    return false;
  }

  return isNullish(body);
}

const findings: Finding[] = [];

for (const filePath of walkDir("client/src")) {
  const sourceText = fs.readFileSync(filePath, "utf8");
  const sourceFile = ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );

  function visit(node: ts.Node) {
    if (ts.isJsxAttribute(node) && HANDLER_ATTRS.has(node.name.getText(sourceFile))) {
      if (node.initializer && ts.isJsxExpression(node.initializer) && node.initializer.expression) {
        const expr = node.initializer.expression;
        if (ts.isArrowFunction(expr) && isNoOpArrowBody(expr.body)) {
          findings.push({
            file: filePath,
            line: sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1,
            handler: node.name.getText(sourceFile),
            snippet: expr.getText(sourceFile),
          });
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
}

if (findings.length === 0) {
  console.log("✔ Interactive handler check: no no-op inline click/hover handlers detected.");
  process.exit(0);
}

for (const finding of findings) {
  console.log(
    `${finding.file}:${finding.line} ${finding.handler} appears to be a no-op (${finding.snippet})`,
  );
}

console.log(`\n✖ Found ${findings.length} inline no-op interactive handlers.`);
process.exit(1);
