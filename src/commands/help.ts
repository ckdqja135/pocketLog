import chalk from 'chalk';

export function helpCommand(): void {
  console.log(chalk.yellow('\n  📖 명령어 목록\n'));
  console.log(chalk.gray('  ─────────────────────────────────────'));

  const commands = [
    ['encounter', '현재 조우 중인 포켓몬 목록 보기'],
    ['catch',     '포켓몬 포획 시도'],
    ['bag',       '내 포켓몬 보관함'],
    ['status',    '내 통계 (총 커밋 수, 포획 수 등)'],
    ['config',    'GitHub 토큰/레포 설정'],
    ['help',      '도움말'],
    ['exit',      '종료'],
  ];

  for (const [cmd, desc] of commands) {
    console.log(`  ${chalk.cyan(cmd.padEnd(12))} ${chalk.white(desc)}`);
  }

  console.log(chalk.gray('  ─────────────────────────────────────'));
  console.log();
}
