import fs from 'fs';
import path from 'path';

interface KTCValues {
  [key: string]: { name: string; ktc_value: number };
}

let ktcValuesCache: KTCValues | null = null;
let ktcValuesLastWeekCache: KTCValues | null = null;

export async function loadKTCValues(): Promise<KTCValues> {
  if (ktcValuesCache) return ktcValuesCache;

  try {
    const filePath = path.join(process.cwd(), 'client', 'public', 'ktc_values.json');
    const data = fs.readFileSync(filePath, 'utf-8');
    ktcValuesCache = JSON.parse(data);
    return ktcValuesCache || {};
  } catch (error) {
    console.error('Failed to load KTC values:', error);
    return {};
  }
}

export async function loadKTCValuesLastWeek(): Promise<KTCValues> {
  if (ktcValuesLastWeekCache) return ktcValuesLastWeekCache;

  try {
    const filePath = path.join(process.cwd(), 'client', 'public', 'ktc_values_last_week.json');
    const data = fs.readFileSync(filePath, 'utf-8');
    ktcValuesLastWeekCache = JSON.parse(data);
    return ktcValuesLastWeekCache || {};
  } catch (error) {
    console.error('Failed to load KTC values last week:', error);
    return {};
  }
}

export function clearKTCCache() {
  ktcValuesCache = null;
  ktcValuesLastWeekCache = null;
}
