import { createRequire } from 'module';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { Encounter, CaughtPokemon } from '../types/index.js';

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
      caught INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS caught_pokemon (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pokemon_id INTEGER NOT NULL,
      pokemon_name TEXT NOT NULL,
      level INTEGER NOT NULL,
      caught_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      commit_sha TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
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
export function addEncounter(pokemonId: number, pokemonName: string, level: number, expiresAt: string, commitSha: string): void {
  getDb().prepare(
    'INSERT INTO encounters (pokemon_id, pokemon_name, level, expires_at, commit_sha) VALUES (?, ?, ?, ?, ?)'
  ).run(pokemonId, pokemonName, level, expiresAt, commitSha);
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
export function addCaughtPokemon(pokemonId: number, pokemonName: string, level: number, commitSha: string): void {
  getDb().prepare(
    'INSERT INTO caught_pokemon (pokemon_id, pokemon_name, level, commit_sha) VALUES (?, ?, ?, ?)'
  ).run(pokemonId, pokemonName, level, commitSha);
}

export function getAllCaughtPokemon(): CaughtPokemon[] {
  return getDb().prepare('SELECT * FROM caught_pokemon ORDER BY caught_at DESC').all() as CaughtPokemon[];
}

export function getCaughtCount(): number {
  const row = getDb().prepare('SELECT COUNT(*) as count FROM caught_pokemon').get() as { count: number };
  return row.count;
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
