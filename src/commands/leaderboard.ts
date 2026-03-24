import chalk from 'chalk';
import { getLeaderboard, getCaughtCount } from '../services/database.js';

export async function leaderboardCommand(): Promise<void> {
  const board = getLeaderboard();

  if (board.length === 0) {
    console.log(chalk.gray('  아직 커밋 데이터가 없습니다.'));
    return;
  }

  const totalCaught = getCaughtCount();

  console.log(chalk.yellow('\n  🏆 리더보드\n'));
  console.log(chalk.gray('  ─────────────────────────────────────────'));
  console.log(
    `  ${chalk.gray('순위')}  ${chalk.white('이름'.padEnd(20))} ${chalk.white('커밋')}`
  );
  console.log(chalk.gray('  ─────────────────────────────────────────'));

  const medals = ['🥇', '🥈', '🥉'];

  board.slice(0, 15).forEach((entry, index) => {
    const medal = index < 3 ? medals[index] : chalk.gray(`${(index + 1).toString().padStart(2)}.`);
    const nameColor = index === 0 ? chalk.yellow.bold : index < 3 ? chalk.white.bold : chalk.white;

    // 커밋 수 바
    const maxCommits = board[0].commits;
    const barLen = Math.max(1, Math.round((entry.commits / maxCommits) * 15));
    const bar = chalk.green('█'.repeat(barLen));

    console.log(
      `  ${medal}  ${nameColor(entry.author.padEnd(20))} ${bar} ${chalk.cyan(entry.commits.toString())}`
    );
  });

  console.log(chalk.gray('  ─────────────────────────────────────────'));
  console.log(chalk.gray(`  총 포획: ${totalCaught}마리`));
}
