#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_INPUT = 'server/redraft-draft-outcomes/redraft-draft-outcomes-v2-baseline.json';
const DEFAULT_OUTPUT = 'server/redraft-draft-outcomes/redraft-strategy-rules-v1.json';
const MIN_PUBLIC_RULE_SAMPLE = 20;

function printUsage() {
  console.log(`Usage:
  pnpm build:redraft-strategy-rules [--input <aggregate.json>] [--out <rules.json>]

Options:
  --input <path>  Sanitized redraft draft-outcome aggregate. Default: ${DEFAULT_INPUT}
  --out <path>    Derived strategy rules output. Default: ${DEFAULT_OUTPUT}
  --help          Show this help text.`);
}

function parseArgs(argv) {
  const args = {
    input: DEFAULT_INPUT,
    out: DEFAULT_OUTPUT,
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      args.help = true;
      continue;
    }
    if (arg === '--input') {
      args.input = String(argv[++i] || '').trim();
      continue;
    }
    if (arg === '--out') {
      args.out = String(argv[++i] || '').trim();
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return args;
}

function parseFormatBucket(formatBucket) {
  const parts = String(formatBucket || '').split('_');
  const teamCount = Number.parseInt(parts[0] || '', 10) || null;
  return {
    teamCount,
    scoring: parts[2] === 'half' ? 'half_ppr' : parts[1] || 'unknown',
    qbFormat: parts.includes('sf') ? 'superflex' : 'one_qb',
    tightEndPremium: parts.includes('tep'),
  };
}

function sumCounts(counter = {}) {
  return Object.values(counter).reduce((sum, value) => sum + Number(value || 0), 0);
}

function toShareRows(counter = {}, sampleSize = sumCounts(counter)) {
  const denominator = sampleSize || sumCounts(counter) || 1;
  return Object.entries(counter)
    .map(([key, count]) => ({
      key,
      count: Number(count || 0),
      share: Number((Number(count || 0) / denominator).toFixed(4)),
    }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

function confidenceForBucket(sampleSize, topShare, runnerUpShare) {
  const separation = topShare - runnerUpShare;
  if (sampleSize >= 150 && topShare >= 0.5 && separation >= 0.1) return 'strong';
  if (sampleSize >= 100 && (topShare >= 0.45 || separation >= 0.12)) return 'medium';
  if (sampleSize >= 50) return 'directional';
  if (sampleSize >= MIN_PUBLIC_RULE_SAMPLE) return 'thin';
  return 'research_only';
}

function positionLabel(position) {
  if (position === 'QB') return 'quarterback';
  if (position === 'RB') return 'running back';
  if (position === 'WR') return 'wide receiver';
  if (position === 'TE') return 'tight end';
  return String(position || 'unknown').toLowerCase();
}

function buildFirstRoundGuidance(format, firstPickRows, topStrategyRows) {
  const qbShare = firstPickRows.find(row => row.key === 'QB')?.share || 0;
  const rbShare = firstPickRows.find(row => row.key === 'RB')?.share || 0;
  const wrShare = firstPickRows.find(row => row.key === 'WR')?.share || 0;
  const teShare = firstPickRows.find(row => row.key === 'TE')?.share || 0;
  const eliteQbShare = topStrategyRows.find(row => row.key === 'elite QB early')?.share || 0;
  const rbWrShare = rbShare + wrShare;
  const notes = [];

  if (format.qbFormat === 'superflex' && (qbShare >= 0.3 || eliteQbShare >= 0.3)) {
    notes.push('Prioritize elite QB access early when the tier is available.');
  } else if (format.qbFormat === 'superflex') {
    notes.push('Keep QB in the early mix, but do not force it over clear RB/WR value.');
  }

  if (format.qbFormat === 'one_qb' && qbShare <= 0.05) {
    notes.push('Avoid QB in the first round unless the room is extremely unusual.');
  }

  if (rbWrShare >= 0.85) {
    notes.push('The first-round build should usually start with RB or WR.');
  }

  if (format.tightEndPremium && teShare >= 0.08) {
    notes.push('Elite TE is viable, but only when the player is a true tier separator.');
  }

  if (!notes.length && firstPickRows[0]) {
    notes.push(`Lean ${positionLabel(firstPickRows[0].key)} first, but treat the decision as close.`);
  }

  return notes;
}

function buildAvoidNotes(format, firstPickRows, strategyRows) {
  const qbShare = firstPickRows.find(row => row.key === 'QB')?.share || 0;
  const teShare = firstPickRows.find(row => row.key === 'TE')?.share || 0;
  const zeroRbShare = strategyRows.find(row => row.key === 'zero RB')?.share || 0;
  const notes = [];

  if (format.qbFormat === 'one_qb' && qbShare <= 0.05) {
    notes.push('Do not let 1QB rankings pull a quarterback into Round 1.');
  }
  if (!format.tightEndPremium && teShare <= 0.04) {
    notes.push('Do not chase tight end early unless the board clearly falls into an elite tier.');
  }
  if (zeroRbShare > 0 && zeroRbShare < 0.08) {
    notes.push('Zero RB exists in the sample, but it is not the default path for this format.');
  }
  return notes;
}

function buildSlotNotes(bucket) {
  const slotBuckets = bucket.championStrategyByDraftSlotBucket || {};
  return Object.entries(slotBuckets).map(([slotBucket, strategies]) => {
    const rows = toShareRows(strategies);
    const top = rows[0];
    return {
      slotBucket,
      sampleSize: sumCounts(strategies),
      topStrategies: rows.slice(0, 4),
      note: top
        ? `${slotBucket} slots most often produced ${top.key} builds in this sample.`
        : `${slotBucket} slots do not have enough signal yet.`,
    };
  }).sort((a, b) => ['early', 'middle', 'late', 'unknown'].indexOf(a.slotBucket) - ['early', 'middle', 'late', 'unknown'].indexOf(b.slotBucket));
}

function buildRule(formatBucket, bucket) {
  const sampleSize = Number(bucket.eligibleLeagueCount || 0);
  const format = parseFormatBucket(formatBucket);
  const firstPickRows = toShareRows(bucket.championFirstPickPosition, sampleSize);
  const topStrategyRows = toShareRows(bucket.championStrategy, sampleSize);
  const topFirstPick = firstPickRows[0] || { share: 0 };
  const runnerUpFirstPick = firstPickRows[1] || { share: 0 };
  const topStrategy = topStrategyRows[0] || { share: 0 };
  const confidence = confidenceForBucket(
    sampleSize,
    Math.max(topFirstPick.share, topStrategy.share),
    runnerUpFirstPick.share
  );

  return {
    formatBucket,
    format,
    sampleSize,
    confidence,
    recommendationStrength:
      confidence === 'strong' || confidence === 'medium'
        ? confidence
        : sampleSize >= MIN_PUBLIC_RULE_SAMPLE
          ? 'close_call'
          : 'research_only',
    firstRoundLean: {
      positions: firstPickRows,
      notes: buildFirstRoundGuidance(format, firstPickRows, topStrategyRows),
    },
    avoidNotes: buildAvoidNotes(format, firstPickRows, topStrategyRows),
    topStrategies: topStrategyRows.slice(0, 8),
    topOpeningSequences: {
      firstTwo: toShareRows(bucket.championFirstTwoPositionSequence, sampleSize).slice(0, 8),
      firstThree: toShareRows(bucket.championFirstThreePositionSequence, sampleSize).slice(0, 8),
      firstFour: toShareRows(bucket.championPositionSequence, sampleSize).slice(0, 8),
    },
    draftSlotNotes: buildSlotNotes(bucket),
    topPointsCrossCheck: {
      firstPickPositions: toShareRows(bucket.topPointsFirstPickPosition, sampleSize),
      strategies: toShareRows(bucket.topPointsStrategy, sampleSize).slice(0, 8),
      championTopPointsFirstPickMatch: toShareRows(bucket.championTopPointsFirstPickMatch),
    },
  };
}

function buildRules(aggregatePayload) {
  const aggregate = aggregatePayload.aggregate || {};
  const byFormatBucket = aggregate.byFormatBucket || {};
  const rules = Object.entries(byFormatBucket)
    .map(([formatBucket, bucket]) => buildRule(formatBucket, bucket))
    .filter(rule => rule.sampleSize >= MIN_PUBLIC_RULE_SAMPLE)
    .sort((a, b) => b.sampleSize - a.sampleSize || a.formatBucket.localeCompare(b.formatBucket));

  return {
    rulesVersion: 'redraft-strategy-rules-v1',
    generatedAt: aggregatePayload.generatedAt || new Date().toISOString(),
    sourceCorpusId: aggregatePayload.corpusId || null,
    sourceGeneratedAt: aggregatePayload.generatedAt || null,
    sourceDataVersion: aggregate.dataVersion || null,
    privacy: 'derived_from_sanitized_aggregate_counts_only',
    thresholds: {
      minPublicRuleSample: MIN_PUBLIC_RULE_SAMPLE,
      confidenceLevels: {
        strong: 'At least 150 leagues plus a clear top lean.',
        medium: 'At least 100 leagues plus a useful top lean or separation.',
        directional: 'At least 50 leagues, usable as a soft prior.',
        thin: 'At least 20 leagues, show only with caution.',
        research_only: 'Below public-rule threshold.',
      },
    },
    corpusSummary: {
      eligibleLeagueCount: aggregate.eligibleLeagueCount || 0,
      formatBucketCount: Object.keys(byFormatBucket).length,
      retainedRuleCount: rules.length,
      seasons: Object.keys(aggregate.bySeason || {}).sort(),
      draftTypes: Object.keys(aggregate.byDraftType || {}).sort(),
    },
    rules,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printUsage();
    return;
  }

  const source = JSON.parse(await fs.readFile(args.input, 'utf8'));
  const rules = buildRules(source);
  await fs.mkdir(path.dirname(path.resolve(args.out)), { recursive: true });
  await fs.writeFile(args.out, `${JSON.stringify(rules, null, 2)}\n`);
  console.log(`Wrote ${rules.rules.length} redraft strategy rules to ${args.out}`);
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
