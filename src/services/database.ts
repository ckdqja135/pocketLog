import { createRequire } from 'module';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { Encounter, CaughtPokemon, Badge, Adventure, BattleLog } from '../types/index.js';

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

    CREATE TABLE IF NOT EXISTS trainer_stats (
      key TEXT PRIMARY KEY,
      value INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS adventures (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      caught_pokemon_id INTEGER NOT NULL,
      pokemon_name TEXT NOT NULL,
      adventure_type TEXT NOT NULL,
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      ends_at DATETIME NOT NULL,
      completed INTEGER DEFAULT 0,
      reward_exp INTEGER DEFAULT 0,
      reward_stamina INTEGER DEFAULT 0,
      reward_pokemon_id INTEGER
    );

    CREATE TABLE IF NOT EXISTS battle_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trainer_type TEXT NOT NULL,
      my_pokemon_id INTEGER NOT NULL,
      my_pokemon_name TEXT NOT NULL,
      opponent_pokemon_id INTEGER NOT NULL,
      opponent_pokemon_name TEXT NOT NULL,
      result TEXT NOT NULL,
      exp_gained INTEGER DEFAULT 0,
      battled_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 마이그레이션
  try {
    database.exec(`ALTER TABLE encounters ADD COLUMN rarity TEXT DEFAULT 'common'`);
  } catch { /* 이미 존재 */ }
  try {
    database.exec(`ALTER TABLE caught_pokemon ADD COLUMN rarity TEXT DEFAULT 'common'`);
  } catch { /* 이미 존재 */ }
  try {
    database.exec(`ALTER TABLE caught_pokemon ADD COLUMN experience INTEGER DEFAULT 0`);
  } catch { /* 이미 존재 */ }
  try {
    database.exec(`ALTER TABLE caught_pokemon ADD COLUMN bonus_hp INTEGER DEFAULT 0`);
  } catch { /* 이미 존재 */ }
  try {
    database.exec(`ALTER TABLE caught_pokemon ADD COLUMN bonus_atk INTEGER DEFAULT 0`);
  } catch { /* 이미 존재 */ }
  try {
    database.exec(`ALTER TABLE caught_pokemon ADD COLUMN bonus_def INTEGER DEFAULT 0`);
  } catch { /* 이미 존재 */ }
  try {
    database.exec(`ALTER TABLE caught_pokemon ADD COLUMN enhance_count INTEGER DEFAULT 0`);
  } catch { /* 이미 존재 */ }

  // 스태미나 초기값 설정
  database.prepare('INSERT OR IGNORE INTO trainer_stats (key, value) VALUES (?, ?)').run('stamina', 5);
  database.prepare('INSERT OR IGNORE INTO trainer_stats (key, value) VALUES (?, ?)').run('max_stamina', 10);
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

// --- 스태미나 관련 ---
export function getStamina(): number {
  const row = getDb().prepare('SELECT value FROM trainer_stats WHERE key = ?').get('stamina') as { value: number } | undefined;
  return row?.value ?? 0;
}

export function getMaxStamina(): number {
  const row = getDb().prepare('SELECT value FROM trainer_stats WHERE key = ?').get('max_stamina') as { value: number } | undefined;
  return row?.value ?? 10;
}

export function useStamina(amount: number): boolean {
  const current = getStamina();
  if (current < amount) return false;
  getDb().prepare('UPDATE trainer_stats SET value = value - ? WHERE key = ?').run(amount, 'stamina');
  return true;
}

export function addStamina(amount: number): void {
  const max = getMaxStamina();
  getDb().prepare('UPDATE trainer_stats SET value = MIN(value + ?, ?) WHERE key = ?').run(amount, max, 'stamina');
}

// --- 경험치 & 레벨업 ---
export function getCaughtPokemonById(id: number): CaughtPokemon | undefined {
  return getDb().prepare('SELECT * FROM caught_pokemon WHERE id = ?').get(id) as CaughtPokemon | undefined;
}

export function addExperience(caughtPokemonId: number, exp: number): { leveled: boolean; newLevel: number; totalExp: number } {
  const pokemon = getCaughtPokemonById(caughtPokemonId);
  if (!pokemon) return { leveled: false, newLevel: 0, totalExp: 0 };

  const currentExp = (pokemon.experience || 0) + exp;
  const requiredExp = pokemon.level * 10;
  let newLevel = pokemon.level;
  let remaining = currentExp;

  // 연속 레벨업 처리
  while (remaining >= newLevel * 10 && newLevel < 100) {
    remaining -= newLevel * 10;
    newLevel++;
  }

  getDb().prepare('UPDATE caught_pokemon SET experience = ?, level = ? WHERE id = ?').run(remaining, newLevel, caughtPokemonId);

  return { leveled: newLevel > pokemon.level, newLevel, totalExp: remaining };
}

export function addLevels(caughtPokemonId: number, levels: number): number {
  const pokemon = getCaughtPokemonById(caughtPokemonId);
  if (!pokemon) return 0;
  const newLevel = Math.min(100, pokemon.level + levels);
  getDb().prepare('UPDATE caught_pokemon SET level = ? WHERE id = ?').run(newLevel, caughtPokemonId);
  return newLevel;
}

export interface EnhanceResult {
  newLevel: number;
  bonusHp: number;
  bonusAtk: number;
  bonusDef: number;
  enhanceCount: number;
}

export function enhancePokemon(caughtPokemonId: number, levels: number): EnhanceResult | null {
  const pokemon = getCaughtPokemonById(caughtPokemonId);
  if (!pokemon) return null;

  const newLevel = Math.min(100, pokemon.level + levels);
  const bonusHp = (pokemon.bonus_hp || 0) + 10;
  const bonusAtk = (pokemon.bonus_atk || 0) + 3;
  const bonusDef = (pokemon.bonus_def || 0) + 2;
  const enhanceCount = (pokemon.enhance_count || 0) + 1;

  getDb().prepare(
    'UPDATE caught_pokemon SET level = ?, bonus_hp = ?, bonus_atk = ?, bonus_def = ?, enhance_count = ? WHERE id = ?'
  ).run(newLevel, bonusHp, bonusAtk, bonusDef, enhanceCount, caughtPokemonId);

  return { newLevel, bonusHp, bonusAtk, bonusDef, enhanceCount };
}

// --- 모험 관련 ---
export function addAdventure(caughtPokemonId: number, pokemonName: string, adventureType: string, endsAt: string, rewardExp: number, rewardStamina: number, rewardPokemonId: number | null): void {
  getDb().prepare(
    'INSERT INTO adventures (caught_pokemon_id, pokemon_name, adventure_type, ends_at, reward_exp, reward_stamina, reward_pokemon_id) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(caughtPokemonId, pokemonName, adventureType, endsAt, rewardExp, rewardStamina, rewardPokemonId);
}

export function getActiveAdventure(): Adventure | undefined {
  return getDb().prepare(
    "SELECT * FROM adventures WHERE completed = 0 ORDER BY started_at DESC LIMIT 1"
  ).get() as Adventure | undefined;
}

export function getCompletedAdventures(): Adventure[] {
  // 시간이 지난 모험을 완료 상태로 업데이트
  getDb().prepare(
    "UPDATE adventures SET completed = 1 WHERE completed = 0 AND ends_at <= datetime('now')"
  ).run();
  return getDb().prepare(
    "SELECT * FROM adventures WHERE completed = 1"
  ).all() as Adventure[];
}

export function claimAdventure(id: number): void {
  getDb().prepare('UPDATE adventures SET completed = 2 WHERE id = ?').run(id);
}

export function isPokemonOnAdventure(caughtPokemonId: number): boolean {
  const row = getDb().prepare(
    'SELECT 1 FROM adventures WHERE caught_pokemon_id = ? AND completed = 0'
  ).get(caughtPokemonId);
  return !!row;
}

// --- 배틀 관련 ---
export function addBattleLog(
  trainerType: string, myPokemonId: number, myPokemonName: string,
  opponentPokemonId: number, opponentPokemonName: string,
  result: string, expGained: number
): void {
  getDb().prepare(
    'INSERT INTO battle_log (trainer_type, my_pokemon_id, my_pokemon_name, opponent_pokemon_id, opponent_pokemon_name, result, exp_gained) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(trainerType, myPokemonId, myPokemonName, opponentPokemonId, opponentPokemonName, result, expGained);
}

export function getLastBattleTime(): string | undefined {
  const row = getDb().prepare(
    'SELECT battled_at FROM battle_log ORDER BY battled_at DESC LIMIT 1'
  ).get() as { battled_at: string } | undefined;
  return row?.battled_at;
}

export function getBattleStats(): { wins: number; losses: number; flees: number } {
  const wins = (getDb().prepare("SELECT COUNT(*) as c FROM battle_log WHERE result = 'win'").get() as { c: number }).c;
  const losses = (getDb().prepare("SELECT COUNT(*) as c FROM battle_log WHERE result = 'lose'").get() as { c: number }).c;
  const flees = (getDb().prepare("SELECT COUNT(*) as c FROM battle_log WHERE result = 'flee'").get() as { c: number }).c;
  return { wins, losses, flees };
}

// --- PVP: 다른 유저 목록 (커밋 기반) ---
export function getOtherUsers(myName?: string): { author: string; commits: number }[] {
  const rows = getDb().prepare(
    'SELECT author, COUNT(*) as commits FROM processed_commits GROUP BY author ORDER BY commits DESC'
  ).all() as { author: string; commits: number }[];

  if (myName) {
    return rows.filter((r) => r.author !== myName);
  }
  return rows;
}

export function getMyUsername(): string | undefined {
  return getConfig('my_username') || undefined;
}

export function getPvpRecord(opponent: string): { wins: number; losses: number } {
  const wins = (getDb().prepare(
    "SELECT COUNT(*) as c FROM battle_log WHERE trainer_type = ? AND result = 'win'"
  ).get(opponent) as { c: number }).c;
  const losses = (getDb().prepare(
    "SELECT COUNT(*) as c FROM battle_log WHERE trainer_type = ? AND result = 'lose'"
  ).get(opponent) as { c: number }).c;
  return { wins, losses };
}
