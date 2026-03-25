import chalk from 'chalk';
import inquirer from 'inquirer';
import { TrainingType } from '../types/index.js';
import {
  getAllCaughtPokemon,
  getStamina,
  useStamina,
  addExperience,
  isPokemonOnAdventure,
} from '../services/database.js';
import { getEvolution } from '../services/pokemon.js';
import { pokemonTypeColor } from '../ui/display.js';

const TRAINING_TYPES: TrainingType[] = [
  { name: '기본 훈련', icon: '💪', expGain: 5, staminaCost: 0 },
  { name: '강화 훈련', icon: '🏋️', expGain: 15, staminaCost: 1 },
  { name: '특훈', icon: '🎯', expGain: 30, staminaCost: 3 },
];

export async function trainCommand(): Promise<void> {
  const pokemon = getAllCaughtPokemon();

  if (pokemon.length === 0) {
    console.log(chalk.gray('  훈련할 포켓몬이 없습니다. 먼저 포켓몬을 잡아주세요!'));
    return;
  }

  const stamina = getStamina();
  console.log(chalk.yellow(`\n  💪 포켓몬 훈련`));
  console.log(chalk.gray(`  현재 스태미나: ${'⚡'.repeat(stamina)}${'░'.repeat(Math.max(0, 10 - stamina))} ${stamina}/10\n`));

  // 모험 중이 아닌 포켓몬만 필터링
  const availablePokemon = pokemon.filter((p) => !isPokemonOnAdventure(p.id));

  if (availablePokemon.length === 0) {
    console.log(chalk.gray('  모든 포켓몬이 모험 중입니다!'));
    return;
  }

  const { selected } = await inquirer.prompt([
    {
      type: 'list',
      name: 'selected',
      message: '어떤 포켓몬을 훈련시킬까요?',
      choices: availablePokemon.slice(0, 20).map((p) => {
        const exp = p.experience || 0;
        const needed = p.level * 10;
        const bar = createExpBar(exp, needed);
        return {
          name: `${chalk.hex(pokemonTypeColor(p.pokemon_id))(p.pokemon_name.padEnd(12))} Lv.${p.level.toString().padStart(2)} ${bar} (${exp}/${needed})`,
          value: p,
        };
      }),
    },
  ]);

  if (selected.level >= 100) {
    console.log(chalk.yellow(`  ${selected.pokemon_name}은(는) 이미 최대 레벨입니다!`));
    return;
  }

  // 훈련 유형 선택
  const availableTraining = TRAINING_TYPES.filter((t) => t.staminaCost <= stamina);

  const { training } = await inquirer.prompt([
    {
      type: 'list',
      name: 'training',
      message: '훈련 유형을 선택하세요:',
      choices: availableTraining.map((t) => ({
        name: `${t.icon} ${t.name}  (EXP +${t.expGain}${t.staminaCost > 0 ? `, 스태미나 -${t.staminaCost}` : ', 무료'})`,
        value: t,
      })),
    },
  ]);

  // 스태미나 소모
  if (training.staminaCost > 0) {
    const success = useStamina(training.staminaCost);
    if (!success) {
      console.log(chalk.red('  스태미나가 부족합니다!'));
      return;
    }
  }

  // 훈련 애니메이션
  console.log();
  process.stdout.write(chalk.cyan(`  ${training.icon} ${selected.pokemon_name}이(가) ${training.name} 중`));
  await delay(500);
  process.stdout.write('.');
  await delay(500);
  process.stdout.write('.');
  await delay(500);
  process.stdout.write('.');
  await delay(500);
  console.log();

  // 경험치 추가
  const result = addExperience(selected.id, training.expGain);

  console.log(chalk.green(`  ✅ ${selected.pokemon_name}이(가) 경험치 +${training.expGain}를 얻었다!`));

  if (result.leveled) {
    console.log(chalk.yellow.bold(`\n  🎉 축하합니다! ${selected.pokemon_name}의 레벨이 ${result.newLevel}로 올랐다!`));

    // 진화 가능 여부 확인
    const evo = await getEvolution(selected.pokemon_id);
    if (evo) {
      console.log(chalk.magenta(`  💡 ${selected.pokemon_name}은(는) ${evo.evolvesToName}(으)로 진화할 수 있습니다! evolve 명령어를 사용하세요.`));
    }
  } else {
    const needed = result.newLevel * 10;
    console.log(chalk.gray(`  경험치: ${result.totalExp}/${needed} ${createExpBar(result.totalExp, needed)}`));
  }
}

function createExpBar(current: number, max: number): string {
  const barLength = 15;
  const filled = Math.floor((current / max) * barLength);
  const empty = barLength - filled;
  return chalk.green('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
