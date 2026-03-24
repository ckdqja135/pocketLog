import chalk from 'chalk';
import {
  getEncounterById,
  markEncounterCaught,
  markEncounterFled,
  addCaughtPokemon,
} from '../services/database.js';
import { attemptCatch, getCatchRate } from '../services/pokemon.js';
import { showPokemonImage } from '../ui/display.js';
import { encounterCommand } from './encounter.js';

export async function catchCommand(): Promise<void> {
  const selectedId = await encounterCommand();
  if (selectedId === null) return;

  const encounter = getEncounterById(selectedId);
  if (!encounter) {
    console.log(chalk.red('  포켓몬을 찾을 수 없습니다.'));
    return;
  }

  // 만료 확인
  if (new Date(encounter.expires_at).getTime() < Date.now()) {
    console.log(chalk.red(`  ${encounter.pokemon_name}은(는) 이미 도망갔습니다!`));
    markEncounterFled(encounter.id);
    return;
  }

  // 포켓몬 이미지 출력
  const spriteUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${encounter.pokemon_id}.png`;
  await showPokemonImage(spriteUrl);

  const rate = getCatchRate(encounter.level);
  console.log(chalk.yellow(`\n  야생의 ${chalk.bold(encounter.pokemon_name)} Lv.${encounter.level} 에게`));
  console.log(chalk.gray(`  포획 확률: ${Math.round(rate * 100)}%`));
  console.log();

  // 포획 시도 애니메이션
  process.stdout.write(chalk.white('  몬스터볼을 던졌다!'));
  await delay(500);
  process.stdout.write(chalk.white(' .'));
  await delay(500);
  process.stdout.write(chalk.white('.'));
  await delay(500);
  process.stdout.write(chalk.white('.'));
  await delay(500);
  console.log();

  const success = attemptCatch(encounter.level);

  if (success) {
    console.log(chalk.green.bold(`\n  ✨ 축하합니다! ${encounter.pokemon_name}을(를) 잡았다!`));
    markEncounterCaught(encounter.id);
    addCaughtPokemon(
      encounter.pokemon_id,
      encounter.pokemon_name,
      encounter.level,
      encounter.commit_sha
    );
  } else {
    console.log(chalk.red(`\n  💨 앗! ${encounter.pokemon_name}이(가) 도망쳤다!`));
    markEncounterFled(encounter.id);
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
