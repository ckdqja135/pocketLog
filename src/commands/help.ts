import chalk from 'chalk';

export function helpCommand(): void {
  console.log(chalk.yellow('\n  📖 명령어 목록\n'));
  console.log(chalk.gray('  ─────────────────────────────────────'));

  const sections = [
    {
      title: '포켓몬',
      commands: [
        ['encounter', '현재 조우 중인 포켓몬 목록 보기'],
        ['catch',     '포켓몬 포획 시도'],
        ['bag',       '내 포켓몬 보관함'],
        ['evolve',    '포켓몬 진화 (같은 포켓몬 3마리 필요)'],
        ['pokedex',   '포켓몬 도감 (수집률)'],
      ],
    },
    {
      title: '액션',
      commands: [
        ['hunt',      '🎯 포켓몬 사냥 (지역 탐색, 스태미나 소모)'],
        ['train',     '💪 포켓몬 훈련 (레벨업)'],
        ['adventure', '🗺️ 포켓몬 모험 보내기 (방치형 보상)'],
        ['battle',    '⚔️ NPC 트레이너와 배틀'],
      ],
    },
    {
      title: '트레이너',
      commands: [
        ['status',      '내 통계 + 커밋 히트맵'],
        ['badges',      '업적/뱃지 목록'],
        ['leaderboard', '팀 리더보드'],
      ],
    },
    {
      title: '설정',
      commands: [
        ['config',   'GitHub 토큰/레포 설정'],
        ['settings', '알림/폴링 설정'],
        ['help',     '도움말'],
        ['exit',     '종료'],
      ],
    },
  ];

  for (const section of sections) {
    console.log(chalk.yellow(`\n  [ ${section.title} ]`));
    for (const [cmd, desc] of section.commands) {
      console.log(`  ${chalk.cyan(cmd.padEnd(14))} ${chalk.white(desc)}`);
    }
  }

  console.log(chalk.gray('\n  ─────────────────────────────────────'));
  console.log();
}
