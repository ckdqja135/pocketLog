#!/usr/bin/env node

import chalk from 'chalk';
import readline from 'readline';
import { showBanner, getPrompt } from './ui/banner.js';
import { getDb, expireEncounters, getConfig } from './services/database.js';
import { startPolling, stopPolling } from './services/poller.js';
import { encounterCommand } from './commands/encounter.js';
import { catchCommand } from './commands/catch.js';
import { bagCommand } from './commands/bag.js';
import { statusCommand } from './commands/status.js';
import { configCommand } from './commands/config.js';
import { helpCommand } from './commands/help.js';

let expiryTimer: ReturnType<typeof setInterval> | null = null;
let rl: readline.Interface;

// inquirer 사용 명령어 실행 전 readline을 닫고, 끝나면 다시 열어야 충돌 방지
function closeRl(): void {
  if (rl) {
    rl.close();
  }
}

function createRl(): readline.Interface {
  rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return rl;
}

async function handleCommand(input: string): Promise<boolean> {
  const cmd = input.trim().toLowerCase();

  switch (cmd) {
    case 'encounter':
      closeRl();
      await encounterCommand();
      createRl();
      break;
    case 'catch':
      closeRl();
      await catchCommand();
      createRl();
      break;
    case 'bag':
      await bagCommand();
      break;
    case 'status':
      await statusCommand();
      break;
    case 'config':
      closeRl();
      await configCommand();
      createRl();
      break;
    case 'help':
      helpCommand();
      break;
    case 'exit':
    case 'quit':
      console.log(chalk.yellow('\n  👋 다음에 또 만나요, 트레이너!\n'));
      return true;
    case '':
      break;
    default:
      console.log(chalk.gray(`  알 수 없는 명령어: ${cmd}`));
      console.log(chalk.gray('  help를 입력하면 명령어 목록을 볼 수 있습니다.'));
      break;
  }

  return false;
}

async function main(): Promise<void> {
  // DB 초기화
  getDb();

  // 배너 출력
  await showBanner();

  // 만료된 조우 처리 (1분마다)
  expiryTimer = setInterval(() => {
    expireEncounters();
  }, 60 * 1000);

  // GitHub 폴링 시작 (설정이 있는 경우)
  const token = getConfig('github_token');
  const repos = getConfig('repos');
  if (token && repos) {
    startPolling();
  } else {
    console.log(chalk.gray('  GitHub 설정이 없습니다. config 명령으로 설정해주세요.\n'));
  }

  // REPL 루프
  createRl();

  const promptUser = (): void => {
    rl.question(getPrompt(), async (input) => {
      try {
        const shouldExit = await handleCommand(input);
        if (shouldExit) {
          cleanup();
          rl.close();
          process.exit(0);
        }
      } catch (err: any) {
        console.log(chalk.red(`  오류 발생: ${err.message}`));
      }
      promptUser();
    });
  };

  promptUser();
}

function cleanup(): void {
  stopPolling();
  if (expiryTimer) {
    clearInterval(expiryTimer);
    expiryTimer = null;
  }
}

process.on('SIGINT', () => {
  console.log(chalk.yellow('\n\n  👋 다음에 또 만나요, 트레이너!\n'));
  cleanup();
  process.exit(0);
});

main().catch((err) => {
  console.error(chalk.red('치명적 오류:'), err);
  process.exit(1);
});
