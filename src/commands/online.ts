import chalk from 'chalk';
import inquirer from 'inquirer';
import { getConfig, setConfig, getTotalCommits, getCaughtCount, getUniqueCaughtIds } from '../services/database.js';
import { initSupabase, isSupabaseConfigured, registerTrainer, syncLeaderboard, getMyRank } from '../services/supabase.js';
import { getBattleStats } from '../services/database.js';

export async function onlineCommand(): Promise<void> {
  console.log(chalk.yellow(`\n  🌐 온라인 모드 설정\n`));

  if (isSupabaseConfigured()) {
    // 이미 설정됨 → 상태 표시
    const username = getConfig('github_username') || '(미설정)';
    const displayName = getConfig('my_username') || '(미설정)';
    console.log(chalk.green('  ✅ 온라인 모드 활성화 상태'));
    console.log(chalk.gray(`  GitHub: ${username}`));
    console.log(chalk.gray(`  트레이너: ${displayName}`));

    const rank = await getMyRank(username);
    if (rank > 0) {
      console.log(chalk.cyan(`  🏆 글로벌 랭킹: ${rank}위`));
    }

    console.log();

    const { action } = await inquirer.prompt([{
      type: 'list',
      name: 'action',
      message: '무엇을 할까요?',
      choices: [
        { name: '🔄 통계 동기화', value: 'sync' },
        { name: '⚙️  설정 변경', value: 'reconfigure' },
        { name: '↩️  돌아가기', value: 'back' },
      ],
    }]);

    if (action === 'sync') {
      await syncStats();
    } else if (action === 'reconfigure') {
      await configure();
    }
    return;
  }

  // 신규 설정
  console.log(chalk.gray('  Supabase 프로젝트가 필요합니다.'));
  console.log(chalk.gray('  https://supabase.com 에서 무료 프로젝트를 생성하세요.\n'));

  await configure();
}

async function configure(): Promise<void> {
  const { url } = await inquirer.prompt([{
    type: 'input',
    name: 'url',
    message: 'Supabase URL:',
    default: getConfig('supabase_url') || '',
    validate: (v: string) => v.trim().startsWith('https://') || 'https://로 시작하는 URL을 입력하세요',
  }]);

  const { key } = await inquirer.prompt([{
    type: 'input',
    name: 'key',
    message: 'Supabase Anon Key:',
    default: getConfig('supabase_key') || '',
    validate: (v: string) => v.trim().length > 20 || '유효한 키를 입력하세요',
  }]);

  const { username } = await inquirer.prompt([{
    type: 'input',
    name: 'username',
    message: 'GitHub 유저네임:',
    default: getConfig('github_username') || '',
    validate: (v: string) => v.trim().length > 0 || '유저네임을 입력하세요',
  }]);

  const { displayName } = await inquirer.prompt([{
    type: 'input',
    name: 'displayName',
    message: '트레이너 이름:',
    default: getConfig('my_username') || '',
    validate: (v: string) => v.trim().length > 0 || '이름을 입력하세요',
  }]);

  // 저장
  setConfig('supabase_url', url.trim());
  setConfig('supabase_key', key.trim());
  setConfig('github_username', username.trim());
  setConfig('my_username', displayName.trim());

  // 연결 테스트
  console.log(chalk.cyan('\n  🔗 Supabase 연결 중...\n'));

  const client = initSupabase(url.trim(), key.trim());
  if (!client) {
    console.log(chalk.red('  연결 실패!'));
    return;
  }

  // 트레이너 등록
  const registered = await registerTrainer(username.trim(), displayName.trim());
  if (registered) {
    console.log(chalk.green('  ✅ 온라인 모드 활성화!'));
    console.log(chalk.green('  ✅ 글로벌 리더보드에 등록되었습니다.'));

    // 초기 통계 동기화
    await syncStats();
  } else {
    console.log(chalk.yellow('  ⚠️  트레이너 등록에 실패했습니다. Supabase 테이블을 확인하세요.'));
  }
}

async function syncStats(): Promise<void> {
  const username = getConfig('github_username');
  if (!username) return;

  const totalCommits = getTotalCommits();
  const totalCaught = getCaughtCount();
  const pokedexCount = getUniqueCaughtIds().length;
  const battleStats = getBattleStats();

  await syncLeaderboard(username, {
    totalCommits,
    totalCaught,
    battleWins: battleStats.wins,
    battleLosses: battleStats.losses,
    pokedexCount,
  });

  console.log(chalk.green('  🔄 통계가 동기화되었습니다!'));
  console.log(chalk.gray(`  커밋: ${totalCommits} | 포획: ${totalCaught} | 도감: ${pokedexCount} | 승리: ${battleStats.wins}`));
}
