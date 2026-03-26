export interface ProcessedCommit {
  sha: string;
  repo: string;
  author: string;
  processed_at: string;
}

export interface Encounter {
  id: number;
  pokemon_id: number;
  pokemon_name: string;
  level: number;
  expires_at: string;
  commit_sha: string;
  caught: number; // 0: 대기, 1: 포획, 2: 도망
  rarity: string;
}

export interface CaughtPokemon {
  id: number;
  pokemon_id: number;
  pokemon_name: string;
  level: number;
  caught_at: string;
  commit_sha: string;
  rarity: string;
  experience: number;
  bonus_hp: number;
  bonus_atk: number;
  bonus_def: number;
  enhance_count: number;
}

export interface PokemonInfo {
  id: number;
  name: string;
  koreanName: string;
  spriteUrl: string;
  rarity: Rarity;
  types: string[]; // e.g. ['불꽃', '비행']
  evolutionChainId?: number;
  evolvesTo?: number; // 진화 후 pokemon_id
}

export type Rarity = 'common' | 'uncommon' | 'rare' | 'legendary' | 'mythical';

export interface GitHubCommit {
  sha: string;
  commit: {
    author: {
      name: string;
      date: string;
    };
    message: string;
  };
  stats?: {
    total: number;
    additions: number;
    deletions: number;
  };
}

export interface AppConfig {
  githubToken: string;
  repos: string[]; // "owner/repo" 형식
}

export interface BallType {
  name: string;
  icon: string;
  bonus: number;
  requiredCommits: number;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlockedAt?: string;
}

// --- 사냥 시스템 ---
export interface HuntZone {
  name: string;
  icon: string;
  staminaCost: number;
  rarityWeights: Record<Rarity, number>;
}

// --- 레벨업 시스템 ---
export interface TrainingType {
  name: string;
  icon: string;
  expGain: number;
  staminaCost: number;
}

// --- 모험 시스템 ---
export type AdventureType = 'short' | 'medium' | 'long';

export interface Adventure {
  id: number;
  caught_pokemon_id: number;
  pokemon_name: string;
  adventure_type: AdventureType;
  started_at: string;
  ends_at: string;
  completed: number; // 0: 진행중, 1: 완료(수령대기), 2: 수령완료
  reward_exp: number;
  reward_stamina: number;
  reward_pokemon_id: number | null;
}

export interface AdventureConfig {
  name: string;
  icon: string;
  type: AdventureType;
  durationMinutes: number;
  expReward: [number, number]; // [min, max]
  staminaReward: [number, number];
  pokemonChance: number; // 0~1
}

// --- 스킬 시스템 ---
export type PokemonType =
  | 'fire' | 'water' | 'grass' | 'electric' | 'ice'
  | 'fighting' | 'poison' | 'ground' | 'flying' | 'psychic'
  | 'bug' | 'rock' | 'ghost' | 'dragon' | 'dark' | 'normal'
  | 'steel' | 'fairy';

export type SkillEffect = 'damage' | 'heal' | 'drain' | 'burn' | 'paralyze';

export interface Skill {
  name: string;
  icon: string;
  type: PokemonType;
  power: number;       // 데미지/힐 배율
  mpCost: number;
  effect: SkillEffect;
  description: string;
}

// --- PVP 배틀 시스템 ---
export interface BattlePokemonState {
  pokemonId: number;
  name: string;
  koreanName: string;
  level: number;
  types: PokemonType[];
  maxHp: number;
  hp: number;
  maxMp: number;
  mp: number;
  bonusAtk: number;
  bonusDef: number;
  skills: Skill[];
  isDefending: boolean;
  isBurned: boolean;
  isParalyzed: boolean;
}

export interface BattleLog {
  id: number;
  trainer_type: string;
  my_pokemon_id: number;
  my_pokemon_name: string;
  opponent_pokemon_id: number;
  opponent_pokemon_name: string;
  result: 'win' | 'lose' | 'flee';
  exp_gained: number;
  battled_at: string;
}

// --- Supabase 공유 데이터 ---
export interface SupabaseTrainer {
  id?: string;
  github_username: string;
  display_name: string;
  total_commits: number;
  total_caught: number;
  total_battle_wins: number;
  pokedex_count: number;
  created_at?: string;
  updated_at?: string;
}

export interface LeaderboardEntry {
  github_username: string;
  display_name: string;
  total_commits: number;
  total_caught: number;
  battle_wins: number;
  battle_losses: number;
  pokedex_count: number;
  score: number;
  updated_at?: string;
}

export interface BattleTeamEntry {
  id?: string;
  github_username: string;
  team_data: { pokemonId: number; pokemonName: string; level: number }[];
  updated_at?: string;
}

export interface BattleRecordEntry {
  id?: string;
  challenger: string;
  opponent: string;
  challenger_pokemon: string;
  opponent_pokemon: string;
  result: 'win' | 'lose' | 'flee';
  exp_gained: number;
  created_at?: string;
}
