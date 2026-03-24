import got from 'got';
import chalk from 'chalk';
import { GitHubCommit } from '../types/index.js';
import {
  getConfig,
  isCommitProcessed,
  markCommitProcessed,
  addEncounter,
} from './database.js';
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

async function processNewCommits(): Promise<void> {
  const token = getConfig('github_token');
  const reposStr = getConfig('repos');

  if (!token || !reposStr) return;

  let repos: string[];
  if (reposStr.trim() === '*') {
    repos = await fetchAllUserRepos(token);
  } else {
    repos = reposStr.split(',').map((r) => r.trim()).filter(Boolean);
  }

  for (const repo of repos) {
    const commits = await fetchRecentCommits(repo, token);

    for (const commit of commits) {
      if (isCommitProcessed(commit.sha)) continue;

      const diffSize = await getCommitDiffSize(repo, commit.sha, token);
      const authorName = commit.commit.author.name;

      markCommitProcessed(commit.sha, repo, authorName);

      // 첫 폴링 시에는 기존 커밋을 조용히 등록만 (알림 없이)
      if (isFirstPoll) continue;

      const pokemonId = getRandomPokemonId();
      const pokemonInfo = await getPokemonInfo(pokemonId);
      const level = calculateLevel(diffSize);

      const expiresAt = new Date(Date.now() + 70 * 60 * 1000).toISOString();

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

export function stopPolling(): void {
  if (pollingTimer) {
    clearInterval(pollingTimer);
    pollingTimer = null;
  }
}
