import got from 'got';
import chalk from 'chalk';
import { GitHubCommit } from '../types/index.js';
import {
  getConfig,
  isCommitProcessed,
  markCommitProcessed,
  addEncounter,
  addStamina,
  getTotalCommits,
} from './database.js';
import { isSupabaseConfigured, syncLeaderboard } from './supabase.js';
import { getRandomPokemonId, getPokemonInfo, calculateLevel, RARITY_CONFIG } from './pokemon.js';

let pollingTimer: ReturnType<typeof setInterval> | null = null;
let isFirstPoll = true;

async function fetchAllUserRepos(token: string): Promise<string[]> {
  const repos: string[] = [];
  let page = 1;
  while (true) {
    try {
      const response = await got('https://api.github.com/user/repos', {
        headers: {
          Authorization: `token ${token}`,
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'pokelog-cli',
        },
        searchParams: {
          per_page: 100,
          page,
          sort: 'pushed',
        },
        responseType: 'json',
      });
      const data = response.body as any[];
      if (data.length === 0) break;
      repos.push(...data.map((r: any) => r.full_name));
      if (data.length < 100) break;
      page++;
    } catch {
      break;
    }
  }
  return repos;
}

async function fetchRecentCommits(repo: string, token: string): Promise<GitHubCommit[]> {
  try {
    const response = await got(`https://api.github.com/repos/${repo}/commits`, {
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'pokelog-cli',
      },
      searchParams: {
        per_page: 10,
      },
      responseType: 'json',
    });
    return response.body as GitHubCommit[];
  } catch (err: any) {
    if (err.response?.statusCode === 401) {
      console.log(chalk.red('\n[폴링] GitHub 토큰이 유효하지 않습니다. config 명령으로 재설정해주세요.'));
    } else if (err.response?.statusCode === 404) {
      console.log(chalk.red(`\n[폴링] 레포지토리를 찾을 수 없습니다: ${repo}`));
    }
    return [];
  }
}

async function getCommitDiffSize(repo: string, sha: string, token: string): Promise<number> {
  try {
    const response = await got(`https://api.github.com/repos/${repo}/commits/${sha}`, {
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'pokelog-cli',
      },
      responseType: 'json',
    });
    const data = response.body as any;
    return data.stats?.total || 10;
  } catch {
    return 10;
  }
}

async function processNewCommits(debug: boolean = false): Promise<void> {
  const token = getConfig('github_token');
  const reposStr = getConfig('repos');

  if (!token || !reposStr) {
    if (debug) console.log(chalk.red('  [디버그] GitHub 토큰 또는 레포 설정이 없습니다.'));
    return;
  }

  let repos: string[];
  if (reposStr.trim() === '*') {
    repos = await fetchAllUserRepos(token);
    if (debug) console.log(chalk.gray(`  [디버그] 전체 레포 ${repos.length}개 발견`));
  } else {
    repos = reposStr.split(',').map((r) => r.trim()).filter(Boolean);
  }

  if (debug) console.log(chalk.gray(`  [디버그] 감시 대상: ${repos.slice(0, 5).join(', ')}${repos.length > 5 ? ` 외 ${repos.length - 5}개` : ''}`));

  let newCommitCount = 0;

  for (const repo of repos) {
    const commits = await fetchRecentCommits(repo, token);
    if (debug && commits.length > 0) {
      console.log(chalk.gray(`  [디버그] ${repo}: 커밋 ${commits.length}개 조회됨`));
    }

    for (const commit of commits) {
      if (isCommitProcessed(commit.sha)) continue;
      newCommitCount++;

      const diffSize = await getCommitDiffSize(repo, commit.sha, token);
      const authorName = commit.commit.author.name;

      markCommitProcessed(commit.sha, repo, authorName);

      // 첫 폴링 시에는 기존 커밋을 조용히 등록만 (알림 없이)
      if (isFirstPoll) continue;

      // 새 커밋마다 스태미나 +1
      addStamina(1);

      // Supabase 리더보드 동기화 (비동기, 에러 무시)
      if (isSupabaseConfigured()) {
        const ghUser = getConfig('github_username');
        if (ghUser) {
          syncLeaderboard(ghUser, { totalCommits: getTotalCommits() }).catch(() => {});
        }
      }

      const pokemonId = getRandomPokemonId();
      const pokemonInfo = await getPokemonInfo(pokemonId);
      const level = calculateLevel(diffSize);

      // SQLite datetime 호환 형식 (UTC)
      const expires = new Date(Date.now() + 70 * 60 * 1000);
      const expiresAt = expires.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '');

      addEncounter(pokemonInfo.id, pokemonInfo.koreanName, level, expiresAt, commit.sha, pokemonInfo.rarity);

      const rarityInfo = RARITY_CONFIG[pokemonInfo.rarity];
      const rarityTag = pokemonInfo.rarity !== 'common'
        ? chalk.hex(rarityInfo.color)(` [${rarityInfo.icon} ${rarityInfo.label}]`)
        : '';

      console.log(
        chalk.yellow(`\n🌿 야생의 ${chalk.bold(pokemonInfo.koreanName)} Lv.${level} 이(가) 나타났다!`) + rarityTag
      );
      console.log(chalk.gray(`   (커밋: ${commit.sha.slice(0, 7)} by ${authorName})`));
      console.log(chalk.cyan('   → catch 를 입력하여 포획하세요!'));
      process.stdout.write(chalk.hex('#4FC3F7')('pokelog> '));

      await delay(2000);
    }
  }

  if (debug) {
    if (newCommitCount === 0) {
      console.log(chalk.gray('  [디버그] 새로운 커밋이 없습니다. (이미 처리된 커밋만 발견)'));
    } else {
      console.log(chalk.green(`  [디버그] 새 커밋 ${newCommitCount}개 처리 완료`));
    }
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function startPolling(): void {
  if (pollingTimer) return;

  const token = getConfig('github_token');
  const repos = getConfig('repos');

  if (!token || !repos) {
    console.log(chalk.gray('GitHub 설정이 없습니다. config 명령으로 설정해주세요.'));
    return;
  }

  // 첫 폴링: 기존 커밋 조용히 등록
  processNewCommits().then(() => {
    isFirstPoll = false;
  }).catch(() => {
    isFirstPoll = false;
  });

  const intervalMin = parseInt(getConfig('poll_interval') || '5') || 5;
  pollingTimer = setInterval(() => {
    processNewCommits().catch(() => {});
  }, intervalMin * 60 * 1000);

  console.log(chalk.green(`📡 GitHub 폴링을 시작합니다. (${intervalMin}분 간격)`));
}

// 수동 폴링 (디버그 모드)
export async function manualPoll(): Promise<void> {
  console.log(chalk.cyan('\n  🔍 수동 폴링 실행...\n'));
  const wasFirstPoll = isFirstPoll;
  isFirstPoll = false; // 수동 폴링은 항상 조우 생성
  try {
    await processNewCommits(true);
  } finally {
    if (wasFirstPoll) isFirstPoll = wasFirstPoll;
  }
}

export function stopPolling(): void {
  if (pollingTimer) {
    clearInterval(pollingTimer);
    pollingTimer = null;
  }
}
