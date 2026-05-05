import fs from 'fs';
import path from 'path';

const SNAPSHOT_DIR = path.join(process.cwd(), 'server', 'ktc-snapshots');
const TIME_ZONE = 'America/Vancouver';

function toDateKey(date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function parseArgs() {
  const startFlag = process.argv.find((arg) => arg.startsWith('--start='));
  const endFlag = process.argv.find((arg) => arg.startsWith('--end='));
  return {
    start: startFlag ? startFlag.slice('--start='.length) : '2026-04-29',
    end: endFlag ? endFlag.slice('--end='.length) : toDateKey(new Date()),
  };
}

function listSnapshotDates() {
  if (!fs.existsSync(SNAPSHOT_DIR)) return new Set();
  return new Set(
    fs.readdirSync(SNAPSHOT_DIR)
      .map((file) => {
        const match = file.match(/^ktc-snapshot-(\d{4}-\d{2}-\d{2})\.json$/);
        return match?.[1] || null;
      })
      .filter(Boolean)
  );
}

function nextDateKey(dateKey) {
  const date = new Date(`${dateKey}T12:00:00-07:00`);
  date.setUTCDate(date.getUTCDate() + 1);
  return toDateKey(date);
}

function collectRange(start, end) {
  const keys = [];
  let cursor = start;
  while (cursor <= end) {
    keys.push(cursor);
    cursor = nextDateKey(cursor);
  }
  return keys;
}

const { start, end } = parseArgs();
const expected = collectRange(start, end);
const available = listSnapshotDates();
const missing = expected.filter((dateKey) => !available.has(dateKey));

console.log(JSON.stringify({
  timeZone: TIME_ZONE,
  start,
  end,
  expectedDays: expected.length,
  snapshotCountInRange: expected.filter((dateKey) => available.has(dateKey)).length,
  missing,
}, null, 2));
