import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const archivePath = process.env.ARCHIVE_FILE
  ? path.resolve(rootDir, process.env.ARCHIVE_FILE)
  : path.join(rootDir, 'server', 'value-history-archive', 'player-value-history-reblended.json');
const predictionPath = process.env.PREDICTIONS_FILE ? path.resolve(rootDir, process.env.PREDICTIONS_FILE) : '';
const outputPath = process.env.OUT_FILE
  ? path.resolve(rootDir, process.env.OUT_FILE)
  : path.join(rootDir, 'server', 'value-history-archive', 'player-value-backtest.json');
const horizonDays = Number(process.env.HORIZON_DAYS || 365);
const minMovePct = Number(process.env.MIN_MOVE_PCT || 15);

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log([
    'Backtest historical player values against later outcomes.',
    '',
    'Environment:',
    '  ARCHIVE_FILE=server/value-history-archive/player-value-history-reblended.json',
    '  PREDICTIONS_FILE=path/to/predictions.json',
    '  HORIZON_DAYS=365',
    '  MIN_MOVE_PCT=15',
    '  OUT_FILE=server/value-history-archive/player-value-backtest.json',
    '',
    'Optional predictions shape:',
    '  [{ "date": "2024-08-01", "playerName": "Player", "direction": "riser" }]',
  ].join('\n'));
  process.exit(0);
}

function readJson(filePath, fallback) {
  if (!filePath || !fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function datePlusDays(dateKey, days) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function pctChange(start, end) {
  if (!start) return null;
  return Math.round(((end - start) / start) * 1000) / 10;
}

function normalizeKey(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function findFuturePoint(points, targetDate) {
  return points.find((point) => point.date >= targetDate) || null;
}

function buildOutcomeRows(archive) {
  const rows = [];
  for (const player of archive.players || []) {
    const pointsByFormat = new Map();
    for (const point of player.points || []) {
      const format = point.format || 'default';
      const group = pointsByFormat.get(format) || [];
      group.push(point);
      pointsByFormat.set(format, group);
    }

    for (const [format, formatPoints] of pointsByFormat.entries()) {
      const points = [...formatPoints]
      .filter((point) => point.date && Number(point.value) > 0)
      .sort((a, b) => a.date.localeCompare(b.date));

      for (const point of points) {
        const future = findFuturePoint(points, datePlusDays(point.date, horizonDays));
        if (!future) continue;
        const delta = Number(future.value) - Number(point.value);
        const deltaPct = pctChange(Number(point.value), Number(future.value));
        rows.push({
          playerKey: player.key || normalizeKey(player.name),
          playerName: player.name,
          position: player.position || null,
          format,
          startDate: point.date,
          endDate: future.date,
          startValue: Number(point.value),
          endValue: Number(future.value),
          delta,
          deltaPct,
          outcome: deltaPct >= minMovePct ? 'riser' : deltaPct <= -minMovePct ? 'faller' : 'flat',
        });
      }
    }
  }
  return rows;
}

function evaluatePredictions(outcomes, predictions) {
  if (!predictions.length) return null;
  const byPlayer = new Map();
  outcomes.forEach((row) => {
    const key = row.playerKey;
    const rows = byPlayer.get(key) || [];
    rows.push(row);
    byPlayer.set(key, rows);
  });

  const evaluated = predictions.flatMap((prediction) => {
    const key = normalizeKey(prediction.playerKey || prediction.playerId || prediction.playerName || prediction.name);
    const direction = String(prediction.direction || prediction.call || '').toLowerCase().includes('fall') ? 'faller'
      : String(prediction.direction || prediction.call || '').toLowerCase().includes('down') ? 'faller'
        : 'riser';
    const date = String(prediction.date || prediction.createdAt || '').slice(0, 10);
    const match = (byPlayer.get(key) || []).find((row) => !date || row.startDate >= date) || null;
    if (!match) return [];
    return [{
      playerName: match.playerName,
      predictionDate: date || match.startDate,
      direction,
      actualOutcome: match.outcome,
      hit: direction === match.outcome,
      deltaPct: match.deltaPct,
      startValue: match.startValue,
      endValue: match.endValue,
    }];
  });

  const hitCount = evaluated.filter((row) => row.hit).length;
  return {
    predictionCount: predictions.length,
    evaluatedCount: evaluated.length,
    hitCount,
    hitRate: evaluated.length ? Math.round((hitCount / evaluated.length) * 1000) / 10 : null,
    misses: evaluated.filter((row) => !row.hit).slice(0, 25),
  };
}

function main() {
  const archive = readJson(archivePath, null);
  if (!archive) throw new Error(`Archive not found: ${archivePath}`);
  const outcomes = buildOutcomeRows(archive);
  const predictionsPayload = readJson(predictionPath, []);
  const predictions = Array.isArray(predictionsPayload)
    ? predictionsPayload
    : Array.isArray(predictionsPayload.predictions)
      ? predictionsPayload.predictions
      : [];
  const risers = outcomes.filter((row) => row.outcome === 'riser').sort((a, b) => b.deltaPct - a.deltaPct).slice(0, 50);
  const fallers = outcomes.filter((row) => row.outcome === 'faller').sort((a, b) => a.deltaPct - b.deltaPct).slice(0, 50);
  const predictionResults = evaluatePredictions(outcomes, predictions);

  const result = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    archiveFile: path.relative(rootDir, archivePath),
    horizonDays,
    minMovePct,
    playerCount: archive.playerCount || archive.players?.length || 0,
    outcomeCount: outcomes.length,
    riserCount: outcomes.filter((row) => row.outcome === 'riser').length,
    fallerCount: outcomes.filter((row) => row.outcome === 'faller').length,
    flatCount: outcomes.filter((row) => row.outcome === 'flat').length,
    predictions: predictionResults,
    topRisers: risers,
    topFallers: fallers,
  };

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`);
  console.log(`Backtested ${result.outcomeCount} outcomes. Risers: ${result.riserCount}. Fallers: ${result.fallerCount}.`);
}

main();
