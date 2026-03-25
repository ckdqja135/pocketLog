import chalk from 'chalk';
import inquirer from 'inquirer';
import {
  getEncounterById,
  markEncounterCaught,
  markEncounterFled,
  addCaughtPokemon,
  getTotalCommits,
  getCommitStreak,
  getStreakBonus,
} from '../services/database.js';
import { attemptCatch, getCatchRate, getAvailableBalls } from '../services/pokemon.js';
import { showPokemonImage } from '../ui/display.js';
import { encounterCommand } from './encounter.js';
import { checkBadges } from './badges.js';

export async function catchCommand(): Promise<void> {
  const selectedId = await encounterCommand();
  if (selectedId === null) return;

  const encounter = getEncounterById(selectedId);
  if (!encounter) {
    console.log(chalk.red('  포켓몬을 찾을 수 없습니다.'));
    return;
  }

  // 만료 확인
  const utcStr = encounter.expires_at.includes('T') ? encounter.expires_at : encounter.expires_at + 'Z';
  if (new Date(utcStr).getTime() < Date.now()) {
    console.log(chalk.red(`  ${encounter.pokemon_name}은(는) 이미 도망갔습니다!`));
    markEncounterFled(encounter.id);
    return;
  }

  // 포켓몬 이미지 출력
  const spriteUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${encounter.pokemon_id}.png`;
  await showPokemonImage(spriteUrl);

  console.log(chalk.yellow(`\n  야생의 ${chalk.bold(encounter.pokemon_name)} Lv.${encounter.level} 에게`));

  // 연속 커밋 보너스 표시
  const streak = getCommitStreak();
  const streakBonus = getStreakBonus();
  if (streak > 0) {
    console.log(chalk.green(`  🔥 연속 커밋 ${streak}일! 포획률 +${Math.round(streakBonus * 100)}%`));
  }

  // 볼 선택
  const totalCommits = getTotalCommits();
  const availableBalls = getAvailableBalls(totalCommits);

  let selectedBall = availableBalls[0]; // 기본 몬스터볼

  if (availableBalls.length > 1) {
    const { ball } = await inquirer.prompt([
      {
        type: 'list',
        name: 'ball',
        message: '어떤 볼을 사용할까요?',
        choices: availableBalls.map((b) => {
          const rate = getCatchRate(encounter.level, b.bonus, streakBonus);
          return {
            name: `${b.icon} ${b.name}  (포획률: ${Math.min(100, Math.round(rate * 100))}%)`,
            value: b,
          };
        }),
      },
    ]);
    selectedBall = ball;
  } else {
    const rate = getCatchRate(encounter.level, selectedBall.bonus, streakBonus);
    console.log(chalk.gray(`  ${selectedBall.icon} ${selectedBall.name} 사용 (포획률: ${Math.round(rate * 100)}%)`));
  }

  console.log();

  // 포획 시도 애니메이션
  process.stdout.write(chalk.white(`  ${selectedBall.icon} ${selectedBall.name}을(를) 던졌다!`));
  await delay(500);
  process.stdout.write(chalk.white(' .'));
  await delay(500);
  process.stdout.write(chalk.white('.'));
  await delay(500);
  process.stdout.write(chalk.white('.'));
  await delay(500);
  console.log();

  const success = attemptCatch(encounter.level, selectedBall.bonus, streakBonus);

  if (success) {
    console.log(chalk.green.bold(`\n  ✨ 축하합니다! ${encounter.pokemon_name}을(를) 잡았다!`));
    markEncounterCaught(encounter.id);
    addCaughtPokemon(
      encounter.pokemon_id,
      encounter.pokemon_name,
      encounter.level,
      encounter.commit_sha,
      encounter.rarity || 'common'
    );
    // 뱃지 체크
    const newBadges = checkBadges();
    for (const b of newBadges) {
      console.log(chalk.yellow(`  🎊 업적 달성! ${b}`));
    }
  } else {
    console.log(chalk.red(`\n  💨 앗! ${encounter.pokemon_name}이(가) 도망쳤다!`));
    markEncounterFled(encounter.id);
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
