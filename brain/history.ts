import fs from 'fs';
import path from 'path';
import { HistoryRecord } from './types';

const HISTORY_PATH = path.resolve(__dirname, '..', 'reports', 'run-history.ndjson');

export async function readHistory(): Promise<HistoryRecord[]> {
  try {
    const raw = await fs.promises.readFile(HISTORY_PATH, 'utf8');
    return raw
      .split('\n')
      .filter(Boolean)
      .map(line => JSON.parse(line) as HistoryRecord);
  } catch (e: any) {
    if (e.code === 'ENOENT') return [];
    throw e;
  }
}

export async function appendHistory(records: HistoryRecord[]): Promise<void> {
  if (records.length === 0) return;
  const lines = records.map(r => JSON.stringify(r)).join('\n') + '\n';
  await fs.promises.appendFile(HISTORY_PATH, lines, 'utf8');
}
