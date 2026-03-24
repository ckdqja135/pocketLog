import { createRequire } from 'module';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { Encounter, CaughtPokemon, Badge } from '../types/index.js';

const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');

const DB_DIR = path.join(os.homedir(), '.pokelog');
const DB_PATH = path.join(DB_DIR, 'pokelog.db');

let db: any;

export function getDb(): any {
  if (!db) {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    initTables();
  }
  return db;
}

function initTables(): void {
  const database = getDb();

  database.exec(`
    CREATE TABLE IF NOT EXISTS processed_commits (
      sha TEXT PRIMARY KEY,
      repo TEXT NOT NULL,
      author TEXT NOT NULL,
      processed_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS encounters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pokemon_id INTEGER NOT NULL,
      pokemon_name TEXT NOT NULL,
      level INTEGER NOT NULL,
      expires_at DATETIME NOT NULL,
      commit_sha TEXT NOT NULL,
      caught INTEGER DEFAULT 0,
      rarity TEXT DEFAULT 'common'
    );

    CREATE TABLE IF NOT EXISTS caught_pokemon (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pokemon_id INTEGER NOT NULL,
      pokemon_name TEXT NOT NULL,
      level INTEGER NOT NULL,
      caught_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      commit_sha TEXT NOT NULL,
      rarity TEXT DEFAULT 'common'
    );

    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS badges (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      icon TEXT NOT NULL,
      unlocked_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 기존 테이블에 rarity 컬럼이 없으면 추가 (마이그레이션)
  try {
    database.exec(`ALTER TABLE encounters ADD COLUMN rarity TEXT DEFAULT 'common'`);
  } catch { /* 이미 존재 */ }
  try {
    database.exec(`ALTER TABLE caught_pokemon ADD COLUMN rarity TEXT DEFAULT 'common'`);
  } catch { /* 이미 존재 */ }
}

// --- 커밋 관련 ---
export function isCommitProcessed(sha: string): boolean {
  const row = getDb().prepare('SELECT 1 FROM processed_commits WHERE sha = ?').get(sha);
  return !!row;
}

export function markCommitProcessed(sha: string, repo: string, author: string): void {
  getDb().prepare(
    'INSERT OR IGNORE INTO processed_commits (sha, repo, author) VALUES (?, ?, ?)'
  ).run(sha, repo, author);
}

// --- 조우 관련 ---
export function addEncounter(pokemonId: number, pokemonName: string, level: number, expiresAt: string, commitSha: string, rarity: string = 'common'): void {
  getDb().prepare(
    'INSERT INTO encounters (pokemon_id, pokemon_name, level, expires_at, commit_sha, rarity) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(pokemonId, pokemonName, level, expiresAt, commitSha, rarity);
}

export function getActiveEncounters(): Encounter[] {
  return getDb().prepare(
    "SELECT * FROM encounters WHERE caught = 0 AND expires_at > datetime('now')"
  ).all() as Encounter[];
}

export function expireEncounters(): number {
  const result = getDb().prepare(
    "UPDATE encounters SET caught = 2 WHERE caught = 0 AND expires_at <= datetime('now')"
  ).run();
  return result.changes;
}

export function markEncounterCaught(id: number): void {
  getDb().prepare('UPDATE encounters SET caught = 1 WHERE id = ?').run(id);
}

export function markEncounterFled(id: number): void {
  getDb().prepare('UPDATE encounters SET caught = 2 WHERE id = ?').run(id);
}

export function getEncounterById(id: number): Encounter | undefined {
  return getDb().prepare('SELECT * FROM encounters WHERE id = ?').get(id) as Encounter | undefined;
}

// --- 포획 관련 ---
export function addCaughtPokemon(pokemonId: number, pokemonName: string, level: number, commitSha: string, rarity: string = 'common'): void {
  getDb().prepare(
    'INSERT INTO caught_pokemon (pokemon_id, pokemon_name, level, commit_sha, rarity) VALUES (?, ?, ?, ?, ?)'
  ).run(pokemonId, pokemonName, level, commitSha, rarity);
}

export function getAllCaughtPokemon(): CaughtPokemon[] {
  return getDb().prepare('SELECT * FROM caught_pokemon ORDER BY caught_at DESC').all() as CaughtPokemon[];
}

export function getCaughtCount(): number {
  const row = getDb().prepare('SELECT COUNT(*) as count FROM caught_pokemon').get() as { count: number };
  return row.count;
}

// 같은 pokemon_id 보유 수
export function getCaughtCountByPokemonId(pokemonId: number): number {
  const row = getDb().prepare('SELECT COUNT(*) as count FROM caught_pokemon WHERE pokemon_id = ?').get(pokemonId) as { count: number };
  return row.count;
}

// 진화 시 기존 포켓몬 3마리 제거
export function removeCaughtPokemon(pokemonId: number, count: number): void {
  const rows = getDb().prepare(
    'SELECT id FROM caught_pokemon WHERE pokemon_id = ? ORDER BY caught_at ASC LIMIT ?'
  ).all(pokemonId, count) as { id: number }[];
  for (const row of rows) {
    getDb().prepare('DELETE FROM caught_pokemon WHERE id = ?').run(row.id);
  }
}

// --- 도감 관련 ---
export function getUniqueCaughtIds(): number[] {
  const rows = getDb().prepare(
    'SELECT DISTINCT pokemon_id FROM caught_pokemon ORDER BY pokemon_id'
  ).all() as { pokemon_id: number }[];
  return rows.map((r) => r.pokemon_id);
}

export function getUniqueEncounteredIds(): number[] {
  const rows = getDb().prepare(
    'SELECT DISTINCT pokemon_id FROM encounters ORDER BY pokemon_id'
  ).all() as { pokemon_id: number }[];
  return rows.map((r) => r.pokemon_id);
}

// --- 설정 관련 ---
export function getConfig(key: string): string | undefined {
  const row = getDb().prepare('SELECT value FROM config WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value;
}

export function setConfig(key: string, value: string): void {
  getDb().prepare(
    'INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)'
  ).run(key, value);
}

// --- 뱃지 관련 ---
export function addBadge(id: string, name: string, description: string, icon: string): boolean {
  try {
    getDb().prepare(
      'INSERT INTO badges (id, name, description, icon) VALUES (?, ?, ?, ?)'
    ).run(id, name, description, icon);
    return true; // 새로 획득
  } catch {
    return false; // 이미 보유
  }
}

export function getAllBadges(): Badge[] {
  return getDb().prepare('SELECT id, name, description, icon, unlocked_at as unlockedAt FROM badges ORDER BY unlocked_at').all() as Badge[];
}

export function hasBadge(id: string): boolean {
  const row = getDb().prepare('SELECT 1 FROM badges WHERE id = ?').get(id);
  return !!row;
}

// --- 통계 ---
export function getTotalCommits(): number {
  const row = getDb().prepare('SELECT COUNT(*) as count FROM processed_commits').get() as { count: number };
  return row.count;
}

export function getTotalEncounters(): number {
  const row = getDb().prepare('SELECT COUNT(*) as count FROM encounters').get() as { count: number };
  return row.count;
}

export function getEscapedCount(): number {
  const row = getDb().prepare('SELECT COUNT(*) as count FROM encounters WHERE caught = 2').get() as { count: number };
  return row.count;
}

// --- 리더보드 ---
export function getLeaderboard(): { author: string; commits: number; caught: number }[] {
  // 커밋 수 기준 (author별)
  const commitRows = getDb().prepare(
    'SELECT author, COUNT(*) as commits FROM processed_commits GROUP BY author ORDER BY commits DESC'
  ).all() as { author: string; commits: number }[];

  return commitRows.map((r) => ({
    author: r.author,
    commits: r.commits,
    caught: 0, // 현재 단일 사용자이므로 전체 포획수 공유
  }));
}

// --- 커밋 통계 ---
export function getCommitsByDay(): { day: string; count: number }[] {
  return getDb().prepare(
    "SELECT date(processed_at) as day, COUNT(*) as count FROM processed_commits GROUP BY day ORDER BY day DESC LIMIT 30"
  ).all() as { day: string; count: number }[];
}

export function getCommitsByHour(): { hour: number; count: number }[] {
  return getDb().prepare(
    "SELECT CAST(strftime('%H', processed_at) AS INTEGER) as hour, COUNT(*) as count FROM processed_commits GROUP BY hour ORDER BY hour"
  ).all() as { hour: number; count: number }[];
}

export function getCommitsByWeekday(): { weekday: number; count: number }[] {
  return getDb().prepare(
    "SELECT CAST(strftime('%w', processed_at) AS INTEGER) as weekday, COUNT(*) as count FROM processed_commits GROUP BY weekday ORDER BY weekday"
  ).all() as { weekday: number; count: number }[];
}

// --- 연속 커밋 (streak) ---
export function getCommitStreak(): number {
  const rows = getDb().prepare(
    "SELECT DISTINCT date(processed_at) as d FROM processed_commits ORDER BY d DESC"
  ).all() as { d: string }[];

  if (rows.length === 0) return 0;

  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < rows.length; i++) {
    const expected = new Date(today);
    expected.setDate(expected.getDate() - i);
    const expectedStr = expected.toISOString().slice(0, 10);

    if (rows[i].d === expectedStr) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

export function getStreakBonus(): number {
  const streak = getCommitStreak();
  return Math.min(0.3, streak * 0.05);
}
