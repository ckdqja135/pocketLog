import chalk from 'chalk';
import { getLeaderboard, getCaughtCount, getConfig } from '../services/database.js';
import { isSupabaseConfigured, getGlobalLeaderboard, getMyRank } from '../services/supabase.js';

export async function leaderboardCommand(): Promise<void> {
  // Supabase 설정되어 있으면 글로벌 리더보드
  if (isSupabaseConfigured()) {
    await showGlobalLeaderboard();
    return;
  }

  // 로컬 폴백
  await showLocalLeaderboard();
}

async function showGlobalLeaderboard(): Promise<void> {
  console.log(chalk.yellow('\n  🌐 글로벌 리더보드\n'));

  const board = await getGlobalLeaderboard(20);
  if (board.length === 0) {
    console.log(chalk.gray('  아직 등록된 트레이너가 없습니다.'));
    console.log(chalk.gray('  online 명령어로 등록하세요!'));
    return;
  }

  console.log(chalk.gray('  ──────────────────────────────────────────────────────────'));
  console.log(
    `  ${chalk.gray('순위')}  ${chalk.white('트레이너'.padEnd(16))} ${chalk.cyan('점수'.padStart(6))} ${chalk.white('커밋'.padStart(5))} ${chalk.green('포획'.padStart(5))} ${chalk.yellow('승리'.padStart(5))} ${chalk.magenta('도감'.padStart(5))}`
  );
  console.log(chalk.gray('  ──────────────────────────────────────────────────────────'));

  const medals = ['🥇', '🥈', '🥉'];

  board.forEach((entry, index) => {
    const medal = index < 3 ? medals[index] : chalk.gray(`${(index + 1).toString().padStart(2)}.`);
    const nameColor = index === 0 ? chalk.yellow.bold : index < 3 ? chalk.white.bold : chalk.white;
    const name = (entry.display_name || entry.github_username).slice(0, 14);

    console.log(
      `  ${medal}  ${nameColor(name.padEnd(16))} ${chalk.cyan(entry.score.toString().padStart(6))} ${chalk.white(entry.total_commits.toString().padStart(5))} ${chalk.green(entry.total_caught.toString().padStart(5))} ${chalk.yellow(entry.battle_wins.toString().padStart(5))} ${chalk.magenta(entry.pokedex_count.toString().padStart(5))}`
    );
  });

  console.log(chalk.gray('  ──────────────────────────────────────────────────────────'));

  // 내 순위
  const myUsername = getConfig('github_username');
  if (myUsername) {
    const rank = await getMyRank(myUsername);
    if (rank > 0) {
      console.log(chalk.cyan(`\n  📍 내 순위: ${rank}위`));
    }
  }

  console.log(chalk.gray('\n  점수 = 커밋×1 + 포획×5 + 승리×10 + 도감×3'));
}

async function showLocalLeaderboard(): Promise<void> {
  const board = getLeaderboard();

  if (board.length === 0) {
    console.log(chalk.gray('  아직 커밋 데이터가 없습니다.'));
    return;
  }

  const totalCaught = getCaughtCount();

  console.log(chalk.yellow('\n  🏆 로컬 리더보드\n'));
  console.log(chalk.gray('  ─────────────────────────────────────────'));
  console.log(
    `  ${chalk.gray('순위')}  ${chalk.white('이름'.padEnd(20))} ${chalk.white('커밋')}`
  );
  console.log(chalk.gray('  ─────────────────────────────────────────'));

  const medals = ['🥇', '🥈', '🥉'];

  board.slice(0, 15).forEach((entry, index) => {
    const medal = index < 3 ? medals[index] : chalk.gray(`${(index + 1).toString().padStart(2)}.`);
    const nameColor = index === 0 ? chalk.yellow.bold : index < 3 ? chalk.white.bold : chalk.white;

    const maxCommits = board[0].commits;
    const barLen = Math.max(1, Math.round((entry.commits / maxCommits) * 15));
    const bar = chalk.green('█'.repeat(barLen));

    console.log(
      `  ${medal}  ${nameColor(entry.author.padEnd(20))} ${bar} ${chalk.cyan(entry.commits.toString())}`
    );
  });

  console.log(chalk.gray('  ─────────────────────────────────────────'));
  console.log(chalk.gray(`  총 포획: ${totalCaught}마리`));
  console.log(chalk.gray('\n  💡 online 명령어로 글로벌 리더보드에 참여하세요!'));
}
