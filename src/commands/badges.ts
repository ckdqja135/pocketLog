import chalk from 'chalk';
import {
  getAllBadges,
  addBadge,
  hasBadge,
  getCaughtCount,
  getTotalCommits,
  getCommitStreak,
  getUniqueCaughtIds,
  getAllCaughtPokemon,
} from '../services/database.js';

interface BadgeDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
  check: () => boolean;
}

const BADGE_DEFINITIONS: BadgeDefinition[] = [
  {
    id: 'first_catch',
    name: '첫 포획',
    description: '처음으로 포켓몬을 포획했다!',
    icon: '🏅',
    check: () => getCaughtCount() >= 1,
  },
  {
    id: 'catch_10',
    name: '초보 트레이너',
    description: '포켓몬 10마리 포획',
    icon: '🥉',
    check: () => getCaughtCount() >= 10,
  },
  {
    id: 'catch_50',
    name: '숙련 트레이너',
    description: '포켓몬 50마리 포획',
    icon: '🥈',
    check: () => getCaughtCount() >= 50,
  },
  {
    id: 'catch_100',
    name: '마스터 트레이너',
    description: '포켓몬 100마리 포획',
    icon: '🥇',
    check: () => getCaughtCount() >= 100,
  },
  {
    id: 'commit_10',
    name: '코딩 입문',
    description: '커밋 10개 달성',
    icon: '💻',
    check: () => getTotalCommits() >= 10,
  },
  {
    id: 'commit_100',
    name: '코딩 마니아',
    description: '커밋 100개 달성',
    icon: '⌨️',
    check: () => getTotalCommits() >= 100,
  },
  {
    id: 'commit_500',
    name: '코딩 중독',
    description: '커밋 500개 달성',
    icon: '🔥',
    check: () => getTotalCommits() >= 500,
  },
  {
    id: 'streak_3',
    name: '3일 연속',
    description: '3일 연속 커밋',
    icon: '📅',
    check: () => getCommitStreak() >= 3,
  },
  {
    id: 'streak_7',
    name: '주간 챔피언',
    description: '7일 연속 커밋',
    icon: '🗓️',
    check: () => getCommitStreak() >= 7,
  },
  {
    id: 'streak_30',
    name: '한 달의 기적',
    description: '30일 연속 커밋',
    icon: '👑',
    check: () => getCommitStreak() >= 30,
  },
  {
    id: 'dex_10',
    name: '도감 수집가',
    description: '10종류 이상 포켓몬 포획',
    icon: '📖',
    check: () => getUniqueCaughtIds().length >= 10,
  },
  {
    id: 'dex_50',
    name: '도감 연구가',
    description: '50종류 이상 포켓몬 포획',
    icon: '🔬',
    check: () => getUniqueCaughtIds().length >= 50,
  },
  {
    id: 'legendary_catch',
    name: '전설의 트레이너',
    description: '전설 포켓몬 포획',
    icon: '🌟',
    check: () => getAllCaughtPokemon().some((p) => p.rarity === 'legendary'),
  },
  {
    id: 'mythical_catch',
    name: '신화의 증인',
    description: '신화 포켓몬 포획',
    icon: '✨',
    check: () => getAllCaughtPokemon().some((p) => p.rarity === 'mythical'),
  },
];

// 업적 달성 여부 체크 후 새 뱃지 반환
export function checkBadges(): string[] {
  const newBadges: string[] = [];
  for (const def of BADGE_DEFINITIONS) {
    if (!hasBadge(def.id) && def.check()) {
      const added = addBadge(def.id, def.name, def.description, def.icon);
      if (added) {
        newBadges.push(`${def.icon} ${def.name}`);
      }
    }
  }
  return newBadges;
}

export async function badgesCommand(): Promise<void> {
  // 먼저 새 업적 체크
  const newBadges = checkBadges();
  if (newBadges.length > 0) {
    console.log(chalk.green('\n  🎊 새로운 업적 달성!'));
    for (const b of newBadges) {
      console.log(chalk.green(`     ${b}`));
    }
  }

  const badges = getAllBadges();
  const totalDefs = BADGE_DEFINITIONS.length;

  console.log(chalk.yellow(`\n  🏆 업적 (${badges.length}/${totalDefs})\n`));
  console.log(chalk.gray('  ─────────────────────────────────────'));

  for (const def of BADGE_DEFINITIONS) {
    const unlocked = badges.find((b) => b.id === def.id);
    if (unlocked) {
      const date = unlocked.unlockedAt
        ? new Date(unlocked.unlockedAt).toLocaleDateString('ko-KR')
        : '';
      console.log(
        `  ${def.icon} ${chalk.white.bold(def.name.padEnd(14))} ${chalk.gray(def.description)}  ${chalk.gray(date)}`
      );
    } else {
      console.log(
        `  ${chalk.gray('🔒')} ${chalk.gray(def.name.padEnd(14))} ${chalk.gray(def.description)}`
      );
    }
  }

  console.log(chalk.gray('  ─────────────────────────────────────'));
}
