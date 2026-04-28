#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const [, , timestamp, snapshotDate] = process.argv;

if (!timestamp || !snapshotDate) {
  console.error('Usage: node scripts/scrape-wayback-ktc.mjs <wayback_timestamp> <yyyy-mm-dd>');
  process.exit(1);
}

const outputDir = path.join(process.cwd(), 'server', 'ktc-snapshots');
const outputPath = path.join(outputDir, `ktc-snapshot-${snapshotDate}.json`);
const filters = 'QB%7CWR%7CRB%7CTE%7CRDP';
const maxPages = 10;

function cleanName(name) {
  return name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
}

async function fetchPage(page) {
  const targetUrl = `https://keeptradecut.com/dynasty-rankings?page=${page}&filters=${filters}&format=2`;
  const archiveUrl = `https://web.archive.org/web/${timestamp}/${targetUrl}`;
  const response = await fetch(archiveUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
  });

  if (!response.ok) {
    console.warn(`[Wayback KTC] Skipping page ${page}: ${response.status}`);
    return [];
  }

  const html = await response.text();
  const match = html.match(/var\s+playersArray\s*=\s*(\[[\s\S]*?\]);/);
  if (!match) return [];
  return JSON.parse(match[1]);
}

const snapshot = {};

for (let page = 0; page < maxPages; page++) {
  const players = await fetchPage(page);
  if (!players.length) break;

  for (const player of players) {
    const superflex = player.superflexValues || {};
    const value = superflex.value || 0;
    const positionRank = superflex.positionalRank || 0;
    const name = player.playerName;

    if (!name || !value) continue;

    const key = cleanName(name);
    snapshot[key] = {
      name,
      ktc_value: value,
      position_rank: player.position && positionRank ? `${player.position}${positionRank}` : undefined,
    };
  }

  console.log(`[Wayback KTC] Page ${page}: ${players.length} rows, ${Object.keys(snapshot).length} unique values`);
}

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(snapshot, null, 2));
console.log(`[Wayback KTC] Saved ${Object.keys(snapshot).length} values to ${outputPath}`);
