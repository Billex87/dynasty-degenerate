#!/usr/bin/env node

/**
 * Enrich the 2025 rookie draft baseline with same-window DynastyProcess data.
 *
 * FantasyCalc/FantasyPros do not expose a reliable May 2025 historical feed for
 * this app, so this deliberately blends only sources we can prove existed then:
 * KTC May 2025 + DynastyProcess values-players.csv from 2025-05-09.
 */

import fs from 'fs';

const BASELINE_PATH = new URL('./rookie-values/2025RookieValues.json', import.meta.url);
const SNAPSHOT_PATH = new URL('./rookie-values/2025RookieBlendSnapshot.json', import.meta.url);
const DYNASTYPROCESS_URL =
  'https://raw.githubusercontent.com/dynastyprocess/data/c5fa48fd6692/files/values-players.csv';

function cleanName(name) {
  return String(name || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
}

function parseCsvLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  values.push(current);
  return values;
}

function weightedAverage(values) {
  const available = values.filter((item) => Number.isFinite(item.value));
  const totalWeight = available.reduce((sum, item) => sum + item.weight, 0);
  if (!totalWeight) return 0;
  return available.reduce((sum, item) => sum + item.value * item.weight, 0) / totalWeight;
}

async function loadDynastyProcessValues() {
  const response = await fetch(DYNASTYPROCESS_URL);
  if (!response.ok) {
    throw new Error(`DynastyProcess ${response.status}`);
  }

  const csv = await response.text();
  const lines = csv.trim().split(/\r?\n/);
  const headers = parseCsvLine(lines[0] || '');
  const playerIndex = headers.indexOf('player');
  const valueIndex = headers.indexOf('value_2qb');
  const scrapeDateIndex = headers.indexOf('scrape_date');

  if (playerIndex < 0 || valueIndex < 0) {
    throw new Error('DynastyProcess CSV missing player/value_2qb columns');
  }

  const values = {};
  for (const line of lines.slice(1)) {
    const columns = parseCsvLine(line);
    const name = columns[playerIndex];
    const value = Number(columns[valueIndex]);
    if (!name || !Number.isFinite(value)) continue;
    values[cleanName(name)] = {
      value,
      scrapeDate: scrapeDateIndex >= 0 ? columns[scrapeDateIndex] : '2025-05-09',
    };
  }
  return values;
}

async function main() {
  const baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
  const dynastyProcess = await loadDynastyProcessValues();

  const enriched = Object.fromEntries(
    Object.entries(baseline).map(([key, record]) => {
      const ktcValue = Number(record.market_value_ktc ?? record.ktc_value);
      const dp = dynastyProcess[cleanName(record.name)];
      const blendedValue = Math.round(
        weightedAverage([
          { value: ktcValue, weight: 0.45 },
          { value: dp?.value, weight: 0.20 },
        ])
      );

      return [
        key,
        {
          name: record.name,
          ktc_value: blendedValue || ktcValue,
          dynasty_value: blendedValue || ktcValue,
          true_value: blendedValue || ktcValue,
          position_rank_may2025: record.position_rank_may2025,
          market_value_ktc: ktcValue,
          expert_value_dynastyprocess: dp?.value,
          value_sources: dp?.value ? ['KTC', 'DynastyProcess'] : ['KTC'],
        },
      ];
    })
  );

  fs.writeFileSync(BASELINE_PATH, `${JSON.stringify(enriched, null, 2)}\n`);
  fs.writeFileSync(
    SNAPSHOT_PATH,
    `${JSON.stringify(
      {
        label: '2025 Rookie Historical Blend',
        capturedAt: 'May 2025',
        comparisonMode: 'blend-to-blend',
        notes:
          'Locked historical baseline for 2025 rookie draft gain. Compare these blended draft-window values to current blended values; do not mix this with raw-only current values.',
        sourceCoverage: [
          {
            source: 'KTC',
            status: 'included',
            capturedAt: 'May 2025',
            weight: 0.45,
            field: 'market_value_ktc',
            notes: 'Archived May 2025 rookie-market baseline.',
          },
          {
            source: 'DynastyProcess',
            status: 'included',
            capturedAt: '2025-05-09',
            weight: 0.2,
            field: 'expert_value_dynastyprocess',
            url: DYNASTYPROCESS_URL,
            notes: 'Closest verified historical expert/value CSV for the 2025 rookie window.',
          },
          {
            source: 'FantasyCalc',
            status: 'historical_not_verified',
            notes: 'Current FantasyCalc data is used in today blends, but no stable May 2025 historical feed is locked here yet.',
          },
          {
            source: 'FantasyPros',
            status: 'historical_not_verified',
            notes: 'Current FantasyPros season ranking data is used in today blends, but no stable May 2025 historical value snapshot is locked here yet.',
          },
        ],
        values: enriched,
      },
      null,
      2
    )}\n`
  );

  const matched = Object.values(enriched).filter((record) => record.expert_value_dynastyprocess).length;
  console.log(`Updated ${Object.keys(enriched).length} rookies; ${matched} matched DynastyProcess.`);
  console.log(`Wrote ${SNAPSHOT_PATH.pathname}`);
  console.log('Emeka Egbuka:', Object.values(enriched).find((record) => record.name === 'Emeka Egbuka'));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
