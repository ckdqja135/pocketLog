import chalk from 'chalk';
import inquirer from 'inquirer';
import { getConfig, setConfig } from '../services/database.js';
import { stopPolling, startPolling } from '../services/poller.js';

export async function settingsCommand(): Promise<void> {
  const currentInterval = getConfig('poll_interval') || '5';
  const currentBranch = getConfig('watch_branch') || '';

  console.log(chalk.yellow('\n  🔧 알림 설정\n'));
  console.log(chalk.gray('  ─────────────────────────────────────'));
  console.log(`  ${chalk.white('폴링 간격')}    ${chalk.cyan(currentInterval + '분')}`);
  console.log(`  ${chalk.white('감시 브랜치')}  ${chalk.cyan(currentBranch || '전체')}`);
  console.log(chalk.gray('  ─────────────────────────────────────'));

  const { interval } = await inquirer.prompt([
    {
      type: 'list',
      name: 'interval',
      message: '폴링 간격 (분):',
      choices: [
        { name: '1분 (빠름)', value: '1' },
        { name: '3분', value: '3' },
        { name: '5분 (기본)', value: '5' },
        { name: '10분', value: '10' },
        { name: '15분', value: '15' },
      ],
      default: currentInterval,
    },
  ]);

  const { branch } = await inquirer.prompt([
    {
      type: 'input',
      name: 'branch',
      message: '감시할 브랜치 (전체 감시: 빈칸):',
      default: currentBranch,
    },
  ]);

  setConfig('poll_interval', interval);
  setConfig('watch_branch', branch.trim());

  console.log(chalk.green('\n  ✅ 설정이 저장되었습니다!'));

  // 폴링 재시작
  stopPolling();
  startPolling();
}
