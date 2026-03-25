import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getConfig, setConfig } from './database.js';
import { LeaderboardEntry, BattleTeamEntry, BattleRecordEntry } from '../types/index.js';

let supabase: SupabaseClient | null = null;

// --- 초기화 ---
export function initSupabase(url?: string, anonKey?: string): SupabaseClient | null {
  const supabaseUrl = url || getConfig('supabase_url');
  const supabaseKey = anonKey || getConfig('supabase_key');

  if (!supabaseUrl || !supabaseKey) return null;

  supabase = createClient(supabaseUrl, supabaseKey);
  return supabase;
}

export function getSupabase(): SupabaseClient | null {
  if (!supabase) {
    return initSupabase();
  }
  return supabase;
}

export function isSupabaseConfigured(): boolean {
  return !!getConfig('supabase_url') && !!getConfig('supabase_key');
}

// --- 트레이너 ---
export async function registerTrainer(githubUsername: string, displayName: string): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;

  try {
    // upsert: 이미 있으면 업데이트, 없으면 생성
    const { error } = await sb.from('trainers').upsert({
      github_username: githubUsername,
      display_name: displayName,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'github_username' });

    if (error) throw error;

    // 리더보드에도 등록
    await sb.from('leaderboard').upsert({
      github_username: githubUsername,
      display_name: displayName,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'github_username' });

    return true;
  } catch {
    return false;
  }
}

// --- 리더보드 ---
export async function syncLeaderboard(githubUsername: string, stats: {
  totalCommits?: number;
  totalCaught?: number;
  battleWins?: number;
  battleLosses?: number;
  pokedexCount?: number;
}): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;

  try {
    const updateData: Record<string, any> = {
      github_username: githubUsername,
      updated_at: new Date().toISOString(),
    };

    if (stats.totalCommits !== undefined) updateData.total_commits = stats.totalCommits;
    if (stats.totalCaught !== undefined) updateData.total_caught = stats.totalCaught;
    if (stats.battleWins !== undefined) updateData.battle_wins = stats.battleWins;
    if (stats.battleLosses !== undefined) updateData.battle_losses = stats.battleLosses;
    if (stats.pokedexCount !== undefined) updateData.pokedex_count = stats.pokedexCount;

    // 점수 계산: 커밋×1 + 포획×5 + 승리×10 + 도감×3
    const current = await sb.from('leaderboard')
      .select('*')
      .eq('github_username', githubUsername)
      .single();

    const existing = current.data || {};
    const commits = stats.totalCommits ?? existing.total_commits ?? 0;
    const caught = stats.totalCaught ?? existing.total_caught ?? 0;
    const wins = stats.battleWins ?? existing.battle_wins ?? 0;
    const pokedex = stats.pokedexCount ?? existing.pokedex_count ?? 0;
    updateData.score = commits * 1 + caught * 5 + wins * 10 + pokedex * 3;

    await sb.from('leaderboard').upsert(updateData, { onConflict: 'github_username' });
  } catch {
    // 네트워크 오류 무시
  }
}

export async function getGlobalLeaderboard(limit: number = 20): Promise<LeaderboardEntry[]> {
  const sb = getSupabase();
  if (!sb) return [];

  try {
    const { data, error } = await sb.from('leaderboard')
      .select('*')
      .order('score', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data || []) as LeaderboardEntry[];
  } catch {
    return [];
  }
}

export async function getMyRank(githubUsername: string): Promise<number> {
  const sb = getSupabase();
  if (!sb) return 0;

  try {
    const { data } = await sb.from('leaderboard')
      .select('github_username')
      .order('score', { ascending: false });

    if (!data) return 0;
    const idx = data.findIndex((r: any) => r.github_username === githubUsername);
    return idx >= 0 ? idx + 1 : 0;
  } catch {
    return 0;
  }
}

// --- 배틀 팀 ---
export async function publishBattleTeam(githubUsername: string, team: BattleTeamEntry['team_data']): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;

  try {
    // 기존 팀 삭제 후 새로 등록
    await sb.from('battle_teams').delete().eq('github_username', githubUsername);

    const { error } = await sb.from('battle_teams').insert({
      github_username: githubUsername,
      team_data: team,
      updated_at: new Date().toISOString(),
    });

    if (error) throw error;
    return true;
  } catch {
    return false;
  }
}

export async function fetchBattleTeam(githubUsername: string): Promise<BattleTeamEntry | null> {
  const sb = getSupabase();
  if (!sb) return null;

  try {
    const { data, error } = await sb.from('battle_teams')
      .select('*')
      .eq('github_username', githubUsername)
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) return null;
    return data as BattleTeamEntry;
  } catch {
    return null;
  }
}

export async function getAllBattleTeams(): Promise<BattleTeamEntry[]> {
  const sb = getSupabase();
  if (!sb) return [];

  try {
    const { data } = await sb.from('battle_teams')
      .select('*')
      .order('updated_at', { ascending: false });

    return (data || []) as BattleTeamEntry[];
  } catch {
    return [];
  }
}

// --- 배틀 전적 ---
export async function recordBattleResult(record: Omit<BattleRecordEntry, 'id' | 'created_at'>): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;

  try {
    await sb.from('battle_records').insert(record);
  } catch {
    // 네트워크 오류 무시
  }
}

export async function getPvpRecordOnline(myUsername: string, opponentUsername: string): Promise<{ wins: number; losses: number }> {
  const sb = getSupabase();
  if (!sb) return { wins: 0, losses: 0 };

  try {
    const { data: winsData } = await sb.from('battle_records')
      .select('id', { count: 'exact' })
      .eq('challenger', myUsername)
      .eq('opponent', opponentUsername)
      .eq('result', 'win');

    const { data: lossesData } = await sb.from('battle_records')
      .select('id', { count: 'exact' })
      .eq('challenger', myUsername)
      .eq('opponent', opponentUsername)
      .eq('result', 'lose');

    return {
      wins: winsData?.length || 0,
      losses: lossesData?.length || 0,
    };
  } catch {
    return { wins: 0, losses: 0 };
  }
}
