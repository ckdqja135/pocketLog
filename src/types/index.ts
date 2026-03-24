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
}

export interface CaughtPokemon {
  id: number;
  pokemon_id: number;
  pokemon_name: string;
  level: number;
  caught_at: string;
  commit_sha: string;
}

export interface PokemonInfo {
  id: number;
  name: string;
  koreanName: string;
  spriteUrl: string;
}

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
