import chalk from 'chalk';
import {
  getTotalCommits,
  getTotalEncounters,
  getCaughtCount,
  getEscapedCount,
  getActiveEncounters,
} from '../services/database.js';

export async function statusCommand(): Promise<void> {
  const totalCommits = getTotalCommits();
  const totalEncounters = getTotalEncounters();
  const caughtCount = getCaughtCount();
  const escapedCount = getEscapedCount();
  const activeEncounters = getActiveEncounters().length;
  const catchRate = totalEncounters > 0
    ? Math.round((caughtCount / totalEncounters) * 100)
    : 0;

  console.log(chalk.yellow('\n  📊 트레이너 통계\n'));
  console.log(chalk.gray('  ─────────────────────────────────────'));
  console.log(`  ${chalk.white('총 감지된 커밋')}    ${chalk.green.bold(totalCommits.toString())}`);
  console.log(`  ${chalk.white('총 조우 횟수')}      ${chalk.green.bold(totalEncounters.toString())}`);
  console.log(`  ${chalk.white('포획한 포켓몬')}     ${chalk.green.bold(caughtCount.toString())}`);
  console.log(`  ${chalk.white('도망간 포켓몬')}     ${chalk.red.bold(escapedCount.toString())}`);
  console.log(`  ${chalk.white('현재 대기 중')}      ${chalk.yellow.bold(activeEncounters.toString())}`);
  console.log(`  ${chalk.white('포획률')}            ${chalk.cyan.bold(catchRate + '%')}`);
  console.log(chalk.gray('  ─────────────────────────────────────'));
}
