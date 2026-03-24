import chalk from 'chalk';
import inquirer from 'inquirer';
import { getConfig, setConfig } from '../services/database.js';
import { startPolling, stopPolling } from '../services/poller.js';

export async function configCommand(): Promise<void> {
  const currentToken = getConfig('github_token');
  const currentRepos = getConfig('repos');

  console.log(chalk.yellow('\n  ⚙️  POKELOG 설정\n'));

  if (currentToken) {
    console.log(chalk.gray(`  현재 토큰: ${currentToken.slice(0, 8)}...${currentToken.slice(-4)}`));
  }
  if (currentRepos) {
    console.log(chalk.gray(`  현재 레포: ${currentRepos}`));
  }
  console.log();

  const { token } = await inquirer.prompt([
    {
      type: 'password',
      name: 'token',
      message: 'GitHub Personal Access Token:',
      mask: '*',
      default: currentToken || undefined,
      validate: (input: string) => {
        if (!input || input.trim().length === 0) return '토큰을 입력해주세요.';
        return true;
      },
    },
  ]);

  const { repos } = await inquirer.prompt([
    {
      type: 'input',
      name: 'repos',
      message: '모니터링할 레포 (* 입력 시 전체 레포, 쉼표로 구분):',
      default: currentRepos || undefined,
      validate: (input: string) => {
        if (!input || input.trim().length === 0) return '레포를 입력해주세요.';
        if (input.trim() === '*') return true;
        const parts = input.split(',').map((r) => r.trim());
        for (const part of parts) {
          if (!part.includes('/')) return `잘못된 형식: "${part}" (owner/repo 형식 또는 * 입력)`;
        }
        return true;
      },
    },
  ]);

  setConfig('github_token', token.trim());
  setConfig('repos', repos.trim());

  console.log(chalk.green('\n  ✅ 설정이 저장되었습니다!'));

  // 폴링 재시작
  stopPolling();
  startPolling();
}
