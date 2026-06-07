import AxeBuilder from '@axe-core/playwright';
import { chromium, type Browser, type Page } from '@playwright/test';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  createCachedCommandCenterReport,
  createCachedCommandCenterStressReport,
  createCachedRedraftReport,
  REPORT_CACHE_KEY,
} from '../tests/e2e/fixtures/cachedReports';

type Viewport = {
  name: string;
  width: number;
  height: number;
};

type TextNodeStat = {
  selector: string;
  bucket: string;
  text: string;
  textLength: number;
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  scrollWidth: number;
  clientWidth: number;
  overflowX: string;
  textOverflow: string;
  whiteSpace: string;
};

type DomAuditIssue = {
  rule: string;
  severity: 'info' | 'warn' | 'fail';
  selector: string;
  message: string;
  evidence: Record<string, unknown>;
  recommendation: string;
};

type AuditIssue = {
  rule: string;
  severity: 'info' | 'warn' | 'fail';
  target: string;
  viewport: string;
  selector: string;
  message: string;
  evidence: Record<string, unknown>;
  recommendation: string;
};

type CachedReport =
  | ReturnType<typeof createCachedRedraftReport>
  | ReturnType<typeof createCachedCommandCenterReport>
  | ReturnType<typeof createCachedCommandCenterStressReport>;

type AuditTarget = {
  id: string;
  label: string;
  path: string;
  hash?: string;
  waitForText?: string | RegExp;
  cachedReport?: (leagueId: string) => CachedReport;
};

type TargetResult = {
  target: string;
  label: string;
  viewport: string;
  url: string;
  screenshot: string;
  nodeCount: number;
  axeViolationCount: number;
  blockingAxeViolationCount: number;
  consoleErrors: string[];
  consoleWarnings: string[];
  pageErrors: string[];
  issues: AuditIssue[];
};

const VIEWPORTS: Viewport[] = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 834, height: 1194 },
  { name: 'desktop', width: 1440, height: 1000 },
];

const TARGETS: AuditTarget[] = [
  {
    id: 'home',
    label: 'Signed-out home',
    path: '/',
  },
  {
    id: 'redraft-overview',
    label: 'Cached redraft overview',
    path: '/',
    hash: '#overview',
    cachedReport: createCachedRedraftReport,
  },
  {
    id: 'redraft-momentum',
    label: 'Cached redraft momentum',
    path: '/',
    hash: '#momentum',
    cachedReport: createCachedRedraftReport,
  },
  {
    id: 'redraft-rankings',
    label: 'Cached redraft rankings',
    path: '/',
    hash: '#rankings',
    waitForText: /FULL ROSTER RANKINGS/i,
    cachedReport: createCachedRedraftReport,
  },
  {
    id: 'redraft-draft',
    label: 'Cached redraft draft',
    path: '/',
    hash: '#draft',
    cachedReport: createCachedRedraftReport,
  },
  {
    id: 'dynasty-overview',
    label: 'Cached dynasty overview',
    path: '/',
    hash: '#overview',
    waitForText: /Owner Intel Lab/i,
    cachedReport: createCachedCommandCenterReport,
  },
  {
    id: 'dynasty-momentum',
    label: 'Cached dynasty momentum',
    path: '/',
    hash: '#momentum',
    cachedReport: createCachedCommandCenterReport,
  },
  {
    id: 'dynasty-rankings',
    label: 'Cached dynasty rankings',
    path: '/',
    hash: '#rankings',
    waitForText: /FULL ROSTER RANKINGS/i,
    cachedReport: createCachedCommandCenterReport,
  },
  {
    id: 'dynasty-trades',
    label: 'Cached dynasty trades',
    path: '/',
    hash: '#trades',
    cachedReport: createCachedCommandCenterReport,
  },
  {
    id: 'dynasty-stress-rankings',
    label: 'Cached dynasty stress rankings',
    path: '/',
    hash: '#rankings',
    waitForText: /FULL ROSTER RANKINGS/i,
    cachedReport: createCachedCommandCenterStressReport,
  },
  {
    id: 'dynasty-stress-trades',
    label: 'Cached dynasty stress trades',
    path: '/',
    hash: '#trades',
    waitForText: /PENDING TRADE OFFERS/i,
    cachedReport: createCachedCommandCenterStressReport,
  },
  {
    id: 'dynasty-stress-draft',
    label: 'Cached dynasty stress draft',
    path: '/',
    hash: '#draft',
    cachedReport: createCachedCommandCenterStressReport,
  },
  {
    id: 'dynasty-draft',
    label: 'Cached dynasty draft',
    path: '/',
    hash: '#draft',
    cachedReport: createCachedCommandCenterReport,
  },
  {
    id: 'dynasty-hacks',
    label: 'Cached dynasty admin hacks',
    path: '/',
    hash: '#hacks',
    cachedReport: createCachedCommandCenterReport,
  },
  {
    id: 'components',
    label: 'Component showcase',
    path: '/components',
  },
];

const OUT_DIR = path.join(process.cwd(), 'reports', 'ui-audit', 'latest');
const SCREENSHOT_DIR = path.join(OUT_DIR, 'screenshots');
const DEFAULT_PORT = Number(process.env.PLAYWRIGHT_PORT || process.env.PORT || 3100);
const DEFAULT_BASE_URL = process.env.UI_AUDIT_BASE_URL || process.env.PLAYWRIGHT_BASE_URL || `http://127.0.0.1:${DEFAULT_PORT}`;
const USE_EXTERNAL_SERVER = Boolean(process.env.UI_AUDIT_BASE_URL || process.env.PLAYWRIGHT_BASE_URL);
const FAIL_ON_ISSUES = process.env.UI_AUDIT_FAIL_ON_ISSUES === 'true';

function printHelp() {
  console.log(`Usage: pnpm run audit:ui

Environment:
  UI_AUDIT_BASE_URL      Use an existing app URL instead of starting dev server.
  PLAYWRIGHT_BASE_URL    Same as UI_AUDIT_BASE_URL, for compatibility.
  PLAYWRIGHT_PORT        Local dev-server port when no base URL is provided. Default: 3100.
  UI_AUDIT_TARGETS       Comma-separated target ids. Default: all.
                         Options: ${TARGETS.map((target) => target.id).join(', ')}
  UI_AUDIT_VIEWPORTS     Comma-separated viewport ids. Default: all.
                         Options: ${VIEWPORTS.map((viewport) => viewport.name).join(', ')}
  UI_AUDIT_FAIL_ON_ISSUES=true
                         Exit non-zero when fail-level issues are found.

Output:
  reports/ui-audit/latest/summary.md
  reports/ui-audit/latest/audit.json
  reports/ui-audit/latest/screenshots/*.png
`);
}

function normalizeList(input: string | undefined) {
  return new Set(
    (input || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
  );
}

function selectViewports() {
  const requested = normalizeList(process.env.UI_AUDIT_VIEWPORTS);
  return requested.size ? VIEWPORTS.filter((viewport) => requested.has(viewport.name)) : VIEWPORTS;
}

function selectTargets() {
  const requested = normalizeList(process.env.UI_AUDIT_TARGETS);
  return requested.size ? TARGETS.filter((target) => requested.has(target.id)) : TARGETS;
}

async function canReach(url: string) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(1_500) });
    return response.status < 500;
  } catch {
    return false;
  }
}

async function waitForServer(url: string, server: ChildProcessWithoutNullStreams) {
  const startedAt = Date.now();
  let logs = '';

  const appendLogs = (chunk: Buffer) => {
    logs += chunk.toString();
    logs = logs.slice(-5_000);
  };

  server.stdout.on('data', appendLogs);
  server.stderr.on('data', appendLogs);

  server.on('error', (error) => {
    logs += `\n${error.message}`;
  });

  while (Date.now() - startedAt < 120_000) {
    if (server.exitCode !== null) {
      throw new Error(`Dev server exited with code ${server.exitCode}.\n${logs}`);
    }
    if (await canReach(url)) return;
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }

  throw new Error(`Timed out waiting for dev server at ${url}.\n${logs}`);
}

async function ensureServer(baseUrl: string) {
  if (USE_EXTERNAL_SERVER || (await canReach(baseUrl))) {
    return undefined;
  }

  const env = {
    ...process.env,
    PORT: String(DEFAULT_PORT),
    DISABLE_SCHEDULED_JOBS: 'true',
    QUIET_DEV_LOGS: 'true',
  };
  delete env.NO_COLOR;

  const server = spawn('corepack', ['pnpm', 'run', 'dev'], {
    cwd: process.cwd(),
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  await waitForServer(baseUrl, server);
  return server;
}

async function stopServer(server: ChildProcessWithoutNullStreams | undefined) {
  if (!server || server.killed) return;

  server.kill('SIGTERM');
  await new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      if (!server.killed) server.kill('SIGKILL');
      resolve();
    }, 4_000);
    server.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

function targetUrl(baseUrl: string, target: AuditTarget, report?: CachedReport) {
  const url = new URL(target.path, baseUrl);
  if (report) {
    url.searchParams.set('leagueId', report.leagueId);
  }
  if (target.hash) {
    url.hash = target.hash;
  }
  return url.toString();
}

async function openTarget(page: Page, baseUrl: string, target: AuditTarget) {
  page.setDefaultTimeout(30_000);

  const cachedReport = target.cachedReport?.(`ui-audit-${target.id}`);
  if (cachedReport) {
    cachedReport.activeTab = target.hash?.replace('#', '') || cachedReport.activeTab;
    cachedReport.savedAt = Date.now() + 60_000;

    await page.addInitScript(
      ({ key, value }) => {
        window.localStorage.setItem(key, JSON.stringify(value));
        window.localStorage.setItem(`${key}:${value.leagueId}`, JSON.stringify(value));
      },
      { key: REPORT_CACHE_KEY, value: cachedReport },
    );
  }

  const url = targetUrl(baseUrl, target, cachedReport);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0.001ms !important;
        animation-iteration-count: 1 !important;
        scroll-behavior: auto !important;
        transition-duration: 0.001ms !important;
      }
      [data-live-clock],
      [data-ad],
      iframe[src*="ads"],
      video {
        visibility: hidden !important;
      }
    `,
  });

  if (target.waitForText) {
    await page.getByText(target.waitForText).first().waitFor({ state: 'visible' });
  }

  await page.evaluate(() => document.fonts?.ready);
  return { page, url };
}

async function collectTextStats(page: Page): Promise<{ nodes: TextNodeStat[]; unnamedButtons: AuditIssue[]; domIssues: DomAuditIssue[]; pageOverflow: boolean }> {
  // tsx/esbuild can preserve nested function names via __name inside serialized
  // page.evaluate callbacks. Define a no-op helper in the page world first.
  await page.evaluate('globalThis.__name = globalThis.__name || ((value) => value)');

  return page.evaluate(() => {
    function cssPath(el: Element) {
      const parts: string[] = [];
      let current: Element | null = el;

      while (current && current.tagName.toLowerCase() !== 'html') {
        const tag = current.tagName.toLowerCase();
        const testId = current.getAttribute('data-testid');
        if (testId) {
          parts.unshift(`${tag}[data-testid="${testId}"]`);
          break;
        }
        if (current.id) {
          parts.unshift(`${tag}#${CSS.escape(current.id)}`);
          break;
        }
        const firstClass = [...current.classList][0];
        const className = firstClass ? `.${CSS.escape(firstClass)}` : '';
        const index = current.parentElement
          ? [...current.parentElement.children].filter((child) => child.tagName === current!.tagName).indexOf(current) + 1
          : 1;
        parts.unshift(`${tag}${className}:nth-of-type(${index})`);
        current = current.parentElement;
      }

      return parts.join(' > ');
    }

    function ownText(el: Element) {
      return [...el.childNodes]
        .filter((node) => node.nodeType === Node.TEXT_NODE)
        .map((node) => node.textContent || '')
        .join(' ')
        .trim()
        .replace(/\s+/g, ' ');
    }

    function isVisible(el: Element, rect: DOMRect, style: CSSStyleDeclaration) {
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        Number(style.opacity || '1') > 0
      );
    }

    function bucketFor(el: Element) {
      const landmark =
        el.closest('[data-ui-audit-bucket], [class*="report-"], [class*="dd-tile"], header, nav, main, section, article, aside, footer, [role]') ||
        document.body;
      const landmarkName = landmark.getAttribute('data-ui-audit-bucket') || [...landmark.classList].slice(0, 2).join('.') || landmark.tagName.toLowerCase();
      const elementName = [...el.classList][0] || el.tagName.toLowerCase();
      return `${landmarkName}:${elementName}`;
    }

    function rectIsVisible(el: Element) {
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return isVisible(el, rect, style);
    }

    function normalizedPositionLabel(value: string | null | undefined) {
      const normalized = String(value || '')
        .trim()
        .toUpperCase()
        .replace(/\s+/g, '')
        .replace(/^D\/ST/, 'DEF')
        .replace(/^DST/, 'DEF');
      return normalized.match(/^(QB|RB|WR|TE|K|DEF)(?:\d+)?$/)?.[1] || null;
    }

    function parseRgb(color: string) {
      const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
      if (!match) return null;
      return {
        r: Number(match[1]),
        g: Number(match[2]),
        b: Number(match[3]),
      };
    }

    function positionColorLooksRight(position: string, rgb: { r: number; g: number; b: number }) {
      if (position === 'QB') return (rgb.r >= rgb.g + 18 && rgb.r >= rgb.b - 8) || (rgb.r >= 170 && rgb.b >= 130 && rgb.g <= 185);
      if (position === 'RB') return rgb.g >= rgb.r + 12 && rgb.g >= rgb.b - 36;
      if (position === 'WR') return rgb.b >= rgb.r + 14 || (rgb.g >= rgb.r + 24 && rgb.b >= 120);
      if (position === 'TE') return rgb.r >= rgb.b + 24 && rgb.g >= rgb.b + 8;
      if (position === 'K') return rgb.r >= 150 && rgb.g >= 125 && rgb.b <= 175;
      if (position === 'DEF') return (rgb.g >= rgb.r + 8 && rgb.b >= rgb.r) || (rgb.g >= 120 && rgb.b >= 85 && rgb.r <= 170);
      return true;
    }

    function findVisiblePositionLabel(el: Element, position: string) {
      const candidates = [el, ...el.querySelectorAll('*')];
      for (const candidate of candidates) {
        if (!rectIsVisible(candidate)) continue;
        const candidateText = ownText(candidate);
        if (normalizedPositionLabel(candidateText) === position) return candidate;
      }
      return null;
    }

    const domIssues: DomAuditIssue[] = [];

    const positionNodes = [...document.querySelectorAll('[data-position]')];
    for (const el of positionNodes) {
      if (!rectIsVisible(el)) continue;
      const dataPosition = el.getAttribute('data-position');
      const textPosition = ownText(el);
      const ownPosition = normalizedPositionLabel(textPosition);
      const position = normalizedPositionLabel(dataPosition) || ownPosition;
      if (!position) continue;

      const colorTarget = ownPosition === position ? el : findVisiblePositionLabel(el, position);
      if (!colorTarget) continue;
      if (colorTarget.closest('.dashboard-position-rank-card')) continue;

      const color = getComputedStyle(colorTarget).color;
      const rgb = parseRgb(color);
      if (!rgb || positionColorLooksRight(position, rgb)) continue;

      domIssues.push({
        rule: 'position-color-mismatch',
        severity: 'warn',
        selector: cssPath(colorTarget),
        message: 'Position-colored element does not match the expected semantic color family.',
        evidence: { position, color, text: ownText(colorTarget).slice(0, 80) },
        recommendation: 'Route position color through shared QB/RB/WR/TE/K/DEF token classes instead of local text colors.',
      });
    }

    const pillSelector = [
      '.report-pill-shell',
      '.report-inline-pill',
      '.report-metric-pill',
      '.analysis-preview-chip',
      '.value-pill',
      '.league-type-badge',
      '.position-badge',
      '.draft-pick-badge',
      '.rookie-draft-pill',
      '.draft-outcome-pill',
      '.draft-gain-pill',
      '.draft-starter-pill',
      '.ranking-card-rank-pill',
      '.owner-metric-pill',
    ].join(', ');
    for (const el of [...document.querySelectorAll(pillSelector)]) {
      if (!rectIsVisible(el)) continue;
      const nested = el.querySelector(pillSelector);
      if (!nested || !rectIsVisible(nested)) continue;
      domIssues.push({
        rule: 'nested-pill',
        severity: 'warn',
        selector: cssPath(el),
        message: 'Pill-like element contains another pill-like element.',
        evidence: { outerText: ownText(el).slice(0, 80), nestedText: ownText(nested).slice(0, 80) },
        recommendation: 'Use a single pill wrapper and plain inner text/icon nodes to avoid double borders and duplicate badge chrome.',
      });
    }

    const chipRowSelector = [
      '.analysis-preview-chip-row',
      '.draft-decision-pills',
      '.manager-draft-decision-pills',
      '.draft-decision-alt-pills',
      '.player-tile-pills',
      '.command-depth-badges',
      '.dashboard-spotlight-chip-row',
      '.waiver-intel-pills',
    ].join(', ');
    for (const el of [...document.querySelectorAll(chipRowSelector)]) {
      if (!rectIsVisible(el)) continue;
      const rect = el.getBoundingClientRect();
      const children = [...el.children].filter(rectIsVisible);
      if (children.length < 2 || rect.width < 220) continue;

      const childRects = children.map(child => child.getBoundingClientRect());
      const maxChildHeight = Math.max(...childRects.map(childRect => childRect.height));
      const totalChildWidth = childRects.reduce((sum, childRect) => sum + childRect.width, 0) + (children.length - 1) * 8;

      if (maxChildHeight > 0 && rect.height > maxChildHeight * 1.8 && totalChildWidth <= rect.width * 1.05) {
        domIssues.push({
          rule: 'stacked-chip-row',
          severity: 'warn',
          selector: cssPath(el),
          message: 'Chip row appears vertically stacked even though the direct chips should fit horizontally.',
          evidence: { text: el.textContent?.trim().replace(/\s+/g, ' ').slice(0, 120), rowWidth: rect.width, rowHeight: rect.height, totalChildWidth },
          recommendation: 'Allow the chip row to stay horizontal at this width, then wrap only when the measured chip width exceeds the container.',
        });
      }
    }

    const tileGridSelector = [
      '.dd-tile-grid',
      '.player-tile-grid',
      '.owner-tile-grid',
      '.manager-intel-player-grid',
      '.manager-command-tile-grid',
      '.trade-signal-card-grid',
      '.pending-transaction-side-grid',
      '.draft-year-card-grid',
      '.dashboard-position-ranks',
    ].join(', ');
    for (const el of [...document.querySelectorAll(tileGridSelector)]) {
      if (!rectIsVisible(el) || window.innerWidth < 900) continue;
      const rect = el.getBoundingClientRect();
      const children = [...el.children].filter(rectIsVisible);
      if (children.length < 4 || rect.width < 680) continue;

      const childWidths = children.map(child => child.getBoundingClientRect().width).filter(width => width > 0);
      const averageChildWidth = childWidths.reduce((sum, width) => sum + width, 0) / childWidths.length;
      if (averageChildWidth > 330) {
        domIssues.push({
          rule: 'oversized-tile-grid',
          severity: 'info',
          selector: cssPath(el),
          message: 'Tile/grid children are wider than the shared compact-card target on a wide viewport.',
          evidence: { childCount: children.length, gridWidth: rect.width, averageChildWidth },
          recommendation: 'Use shared auto-fit tile sizing or a narrower max-width so the grid can fit more useful columns.',
        });
      }
    }

    const nodes = [...document.body.querySelectorAll('*')]
      .map((el) => {
        const text = ownText(el);
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        if (
          !isVisible(el, rect, style) ||
          text.length < 2 ||
          el.classList.contains('sr-only') ||
          el.closest('.sr-only')
        ) {
          return null;
        }

        return {
          selector: cssPath(el),
          bucket: bucketFor(el),
          text,
          textLength: text.length,
          fontFamily: style.fontFamily,
          fontSize: Number.parseFloat(style.fontSize),
          lineHeight: Number.parseFloat(style.lineHeight) || Number.parseFloat(style.fontSize) * 1.2,
          scrollWidth: el.scrollWidth,
          clientWidth: el.clientWidth,
          overflowX: style.overflowX,
          textOverflow: style.textOverflow,
          whiteSpace: style.whiteSpace,
        };
      })
      .filter((node): node is TextNodeStat => Boolean(node))
      .slice(0, 900);

    const unnamedButtons = [...document.querySelectorAll('button')]
      .map((button, index) => {
        const rect = button.getBoundingClientRect();
        const style = getComputedStyle(button);
        const text = button.textContent?.trim() || '';
        const ariaLabel = button.getAttribute('aria-label') || '';
        const title = button.getAttribute('title') || '';
        if (!isVisible(button, rect, style) || text || ariaLabel || title) return null;

        return {
          rule: 'unnamed-button',
          severity: 'fail' as const,
          target: '',
          viewport: '',
          selector: cssPath(button),
          message: 'Visible button has no text, aria-label, or title.',
          evidence: { index },
          recommendation: 'Add visible text or an accessible name.',
        };
      })
      .filter((issue): issue is AuditIssue => Boolean(issue));

    return {
      nodes,
      unnamedButtons,
      domIssues,
      pageOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
    };
  });
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function mad(values: number[], middle = median(values)) {
  return median(values.map((value) => Math.abs(value - middle))) || 1;
}

function normalizeFontFamily(fontFamily: string) {
  return fontFamily
    .split(',')[0]
    ?.trim()
    .replace(/^["']|["']$/g, '')
    .toLowerCase();
}

function groupBy<T>(items: T[], key: (item: T) => string) {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const bucket = key(item);
    const group = map.get(bucket) ?? [];
    group.push(item);
    map.set(bucket, group);
  }
  return map;
}

function isIntentionalTypographyAccent(node: TextNodeStat, rule: 'family' | 'size') {
  if (rule === 'family' && node.selector.includes('manager-position-count-value')) {
    return true;
  }

  if (node.selector.includes('analysis-preview-player-with-meta')) {
    return true;
  }

  if (rule === 'size') {
    return (
      node.selector.includes('dashboard-balance-graph') ||
      node.selector.includes('report-disclosure-preview-accessory') ||
      node.selector.includes('weekly-momentum-pills') ||
      node.selector.includes('rankings-value-basis') ||
      node.selector.includes('draft-board-context-callout') ||
      node.selector.includes('dashboard-target-lockup') ||
      node.selector.includes('player-pill') ||
      (node.bucket.includes('dd-tile') && node.bucket.includes('dd-tile--stat'))
    );
  }

  return false;
}

function isIntentionalTextTruncation(node: TextNodeStat) {
  return (
    node.textOverflow === 'ellipsis' ||
    (node.overflowX === 'visible' && node.whiteSpace !== 'nowrap') ||
    node.selector.includes('report-league-lockup') ||
    node.selector.includes('dashboard-target-lockup') ||
    node.selector.includes('analysis-preview-manager-name') ||
    node.selector.includes('report-identity-chip')
  );
}

function detectRenderedIssues(nodes: TextNodeStat[], target: AuditTarget, viewport: Viewport, pageOverflow: boolean) {
  const issues: AuditIssue[] = [];

  if (pageOverflow) {
    issues.push({
      rule: 'page-horizontal-overflow',
      severity: 'fail',
      target: target.id,
      viewport: viewport.name,
      selector: 'document.documentElement',
      message: 'Page content overflows horizontally at this viewport.',
      evidence: { viewportWidth: viewport.width },
      recommendation: 'Find the widest child and constrain wrapping, min-width, or grid columns.',
    });
  }

  for (const node of nodes) {
    if (node.scrollWidth > node.clientWidth + 2 && node.textLength > 3 && !isIntentionalTextTruncation(node)) {
      issues.push({
        rule: 'text-horizontal-clipping',
        severity: 'warn',
        target: target.id,
        viewport: viewport.name,
        selector: node.selector,
        message: 'Text-bearing element appears clipped horizontally.',
        evidence: { text: node.text.slice(0, 80), scrollWidth: node.scrollWidth, clientWidth: node.clientWidth },
        recommendation: 'Check wrapping, min-width, white-space, and chip/button sizing.',
      });
    }

    const lineRatio = node.lineHeight / node.fontSize;
    if (node.textLength >= 80 && lineRatio < 1.34) {
      issues.push({
        rule: 'line-height-too-tight',
        severity: 'fail',
        target: target.id,
        viewport: viewport.name,
        selector: node.selector,
        message: 'Long text uses an overly tight line-height.',
        evidence: { text: node.text.slice(0, 80), fontSize: node.fontSize, lineHeight: node.lineHeight, ratio: lineRatio },
        recommendation: 'Move long-form copy to a readable line-height, usually at least 1.45.',
      });
    }
  }

  const byBucket = groupBy(
    nodes.filter((node) => node.textLength > 1),
    (node) => node.bucket,
  );

  for (const [bucket, group] of byBucket) {
    if (group.length < 4) continue;

    const sizes = group.map((node) => node.fontSize);
    const sizeMedian = median(sizes);
    const sizeMad = mad(sizes, sizeMedian);
    const families = groupBy(group, (node) => normalizeFontFamily(node.fontFamily));
    const dominantFamily = [...families.entries()].sort((a, b) => b[1].length - a[1].length)[0]?.[0];

    for (const node of group) {
      const family = normalizeFontFamily(node.fontFamily);
      if (
        dominantFamily &&
        family !== dominantFamily &&
        (families.get(family)?.length ?? 0) >= 2 &&
        !isIntentionalTypographyAccent(node, 'family')
      ) {
        issues.push({
          rule: 'font-family-inconsistent',
          severity: 'info',
          target: target.id,
          viewport: viewport.name,
          selector: node.selector,
          message: 'Minority font family found in a repeated rendered bucket.',
          evidence: { bucket, expected: dominantFamily, actual: family, text: node.text.slice(0, 60) },
          recommendation: 'Confirm this is intentional brand typography; otherwise route through the existing font tokens.',
        });
      }

      if (
        Math.abs(node.fontSize - sizeMedian) > Math.max(2, 1.75 * sizeMad) &&
        node.textLength > 3 &&
        !isIntentionalTypographyAccent(node, 'size')
      ) {
        issues.push({
          rule: 'font-size-outlier',
          severity: 'info',
          target: target.id,
          viewport: viewport.name,
          selector: node.selector,
          message: 'Font size differs from repeated peers in the same rendered bucket.',
          evidence: { bucket, actual: node.fontSize, median: sizeMedian, mad: sizeMad, text: node.text.slice(0, 60) },
          recommendation: 'Check whether this belongs on an existing report or tile type token.',
        });
      }
    }
  }

  return issues.slice(0, 75);
}

function relativePath(filePath: string) {
  return path.relative(process.cwd(), filePath);
}

function sanitizeFilename(input: string) {
  return input.replace(/[^a-z0-9-]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase();
}

async function auditTarget(browser: Browser, baseUrl: string, target: AuditTarget, viewport: Viewport): Promise<TargetResult> {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1,
    reducedMotion: 'reduce',
  });

  const consoleErrors: string[] = [];
  const consoleWarnings: string[] = [];
  const pageErrors: string[] = [];

  try {
    const page = await context.newPage();

    page.on('console', (message) => {
      const text = message.text().slice(0, 300);
      if (message.type() === 'error') consoleErrors.push(text);
      if (message.type() === 'warning') consoleWarnings.push(text);
    });
    page.on('pageerror', (error) => pageErrors.push(error.message.slice(0, 300)));

    const { url } = await openTarget(page, baseUrl, target);
    await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => undefined);

    const { nodes, unnamedButtons, domIssues, pageOverflow } = await collectTextStats(page);
    const renderedIssues = detectRenderedIssues(nodes, target, viewport, pageOverflow);
    const axeResults = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    const blockingAxeViolationCount = axeResults.violations.filter((violation) =>
      ['critical', 'serious'].includes(violation.impact || ''),
    ).length;

    const screenshotPath = path.join(SCREENSHOT_DIR, `${sanitizeFilename(target.id)}-${viewport.name}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });

    const issues = [
      ...unnamedButtons.map((issue) => ({ ...issue, target: target.id, viewport: viewport.name })),
      ...domIssues.map((issue) => ({ ...issue, target: target.id, viewport: viewport.name })),
      ...renderedIssues,
      ...axeResults.violations.slice(0, 25).map<AuditIssue>((violation) => ({
        rule: `axe:${violation.id}`,
        severity: ['critical', 'serious'].includes(violation.impact || '') ? 'fail' : 'warn',
        target: target.id,
        viewport: viewport.name,
        selector: violation.nodes[0]?.target?.join(', ') || 'document',
        message: violation.help,
        evidence: { impact: violation.impact, count: violation.nodes.length },
        recommendation: violation.helpUrl,
      })),
    ];

    return {
      target: target.id,
      label: target.label,
      viewport: viewport.name,
      url,
      screenshot: relativePath(screenshotPath),
      nodeCount: nodes.length,
      axeViolationCount: axeResults.violations.length,
      blockingAxeViolationCount,
      consoleErrors,
      consoleWarnings,
      pageErrors,
      issues,
    };
  } finally {
    await context.close();
  }
}

function issueCounts(results: TargetResult[]) {
  return results.reduce(
    (counts, result) => {
      for (const issue of result.issues) {
        counts[issue.severity] += 1;
      }
      counts.consoleErrors += result.consoleErrors.length + result.pageErrors.length;
      return counts;
    },
    { fail: 0, warn: 0, info: 0, consoleErrors: 0 },
  );
}

function renderSummary(results: TargetResult[]) {
  const counts = issueCounts(results);
  const lines = [
    '# UI Audit Summary',
    '',
    `Generated: ${new Date().toISOString()}`,
    `Targets: ${new Set(results.map((result) => result.target)).size}`,
    `Viewports: ${[...new Set(results.map((result) => result.viewport))].join(', ')}`,
    `Issues: ${counts.fail} fail, ${counts.warn} warn, ${counts.info} info`,
    `Console/page errors: ${counts.consoleErrors}`,
    '',
    '## Runs',
    '',
    '| Target | Viewport | Nodes | Axe | Blocking axe | Issues | Screenshot |',
    '| --- | --- | ---: | ---: | ---: | ---: | --- |',
  ];

  for (const result of results) {
    lines.push(
      `| ${result.label} | ${result.viewport} | ${result.nodeCount} | ${result.axeViolationCount} | ${result.blockingAxeViolationCount} | ${result.issues.length} | ${result.screenshot} |`,
    );
  }

  const topIssues = results.flatMap((result) => result.issues).filter((issue) => issue.severity !== 'info').slice(0, 30);
  if (topIssues.length) {
    lines.push('', '## Top Issues', '');
    for (const issue of topIssues) {
      lines.push(
        `- [${issue.severity}] ${issue.target}/${issue.viewport} ${issue.rule}: ${issue.message} (${issue.selector})`,
      );
    }
  }

  return `${lines.join('\n')}\n`;
}

async function main() {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    printHelp();
    return;
  }

  const viewports = selectViewports();
  const targets = selectTargets();
  if (!viewports.length) throw new Error('No matching UI_AUDIT_VIEWPORTS selected.');
  if (!targets.length) throw new Error('No matching UI_AUDIT_TARGETS selected.');

  await fs.rm(OUT_DIR, { recursive: true, force: true });
  await fs.mkdir(SCREENSHOT_DIR, { recursive: true });

  let server: ChildProcessWithoutNullStreams | undefined;
  let browser: Browser | undefined;

  try {
    server = await ensureServer(DEFAULT_BASE_URL);
    browser = await chromium.launch({ headless: true });

    const results: TargetResult[] = [];
    for (const viewport of viewports) {
      for (const target of targets) {
        console.log(`Auditing ${target.id} at ${viewport.name}...`);
        results.push(await auditTarget(browser, DEFAULT_BASE_URL, target, viewport));
      }
    }

    const audit = {
      generatedAt: new Date().toISOString(),
      baseUrl: DEFAULT_BASE_URL,
      targets: targets.map(({ id, label, path: targetPath, hash }) => ({ id, label, path: targetPath, hash })),
      viewports,
      results,
    };

    await fs.writeFile(path.join(OUT_DIR, 'audit.json'), `${JSON.stringify(audit, null, 2)}\n`, 'utf8');
    await fs.writeFile(path.join(OUT_DIR, 'summary.md'), renderSummary(results), 'utf8');

    const counts = issueCounts(results);
    console.log(`UI audit written to ${relativePath(OUT_DIR)}.`);
    console.log(`Issues: ${counts.fail} fail, ${counts.warn} warn, ${counts.info} info.`);

    if (FAIL_ON_ISSUES && (counts.fail > 0 || counts.consoleErrors > 0)) {
      process.exitCode = 1;
    }
  } finally {
    await browser?.close();
    await stopServer(server);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
