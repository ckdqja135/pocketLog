import chalk from 'chalk';
import inquirer from 'inquirer';
import {
  getAllCaughtPokemon,
  getCaughtCountByPokemonId,
  removeCaughtPokemon,
  addCaughtPokemon,
  enhancePokemon,
} from '../services/database.js';
import { getEvolution, getPokemonInfo, formatTypes } from '../services/pokemon.js';
import { showPokemonImage } from '../ui/display.js';

const EVOLVE_COST = 3; // 같은 포켓몬 3마리 필요
const ENHANCE_COST = 3; // 강화도 3마리 필요
const ENHANCE_LEVELS = 5; // 강화 시 레벨 +5

export async function evolveCommand(): Promise<void> {
  const caught = getAllCaughtPokemon();
  if (caught.length === 0) {
    console.log(chalk.gray('  보관함에 포켓몬이 없습니다.'));
    return;
  }

  // 같은 포켓몬이 3마리 이상인 것만 필터
  const countMap = new Map<number, { name: string; count: number; rarity: string }>();
  for (const p of caught) {
    const existing = countMap.get(p.pokemon_id);
    if (existing) {
      existing.count++;
    } else {
      countMap.set(p.pokemon_id, { name: p.pokemon_name, count: 1, rarity: p.rarity || 'common' });
    }
  }

  const evolvable: { pokemonId: number; name: string; count: number }[] = [];
  for (const [pokemonId, info] of countMap) {
    if (info.count >= EVOLVE_COST) {
      evolvable.push({ pokemonId, name: info.name, count: info.count });
    }
  }

  if (evolvable.length === 0) {
    console.log(chalk.gray('  진화/강화 가능한 포켓몬이 없습니다.'));
    console.log(chalk.gray(`  같은 포켓몬 ${EVOLVE_COST}마리를 모으면 진화 또는 강화할 수 있습니다!`));
    return;
  }

  // 진화 가능 여부를 미리 확인
  console.log(chalk.gray('\n  진화 정보를 확인하는 중...'));
  const evoMap = new Map<number, { evolvesToId: number; evolvesToName: string } | null>();
  for (const e of evolvable) {
    const evoResult = await getEvolution(e.pokemonId);
    evoMap.set(e.pokemonId, evoResult);
  }

  console.log(chalk.yellow(`\n  🧬 진화 / ⚡ 강화 가능한 포켓몬\n`));

  const choices = evolvable.map((e) => {
    const canEvolve = evoMap.get(e.pokemonId) !== null;
    const tag = canEvolve ? chalk.cyan('[진화]') : chalk.magenta('[강화]');
    return {
      name: `${tag} ${e.name} (보유: ${e.count}마리, 비용: ${EVOLVE_COST}마리)`,
      value: e.pokemonId,
    };
  });
  choices.push({ name: chalk.gray('← 돌아가기'), value: -1 } as any);

  const { selected } = await inquirer.prompt([
    {
      type: 'list',
      name: 'selected',
      message: '포켓몬을 선택하세요:',
      choices,
    },
  ]);

  if (selected === -1) return;

  const selectedInfo = evolvable.find((e) => e.pokemonId === selected);
  if (!selectedInfo) return;

  const evoResult = evoMap.get(selected);

  if (evoResult) {
    // 진화
    await doEvolve(selected, selectedInfo, evoResult);
  } else {
    // 강화
    await doEnhance(selected, selectedInfo, caught);
  }
}

async function doEvolve(
  pokemonId: number,
  selectedInfo: { name: string; count: number },
  evoResult: { evolvesToId: number; evolvesToName: string }
): Promise<void> {
  const evolvedInfo = await getPokemonInfo(evoResult.evolvesToId);

  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: `${selectedInfo.name} ${EVOLVE_COST}마리 → ${evolvedInfo.koreanName} 1마리로 진화하시겠습니까?`,
      default: true,
    },
  ]);

  if (!confirm) return;

  console.log();
  process.stdout.write(chalk.white(`  ${selectedInfo.name}이(가) 진화하고 있다`));
  for (let i = 0; i < 5; i++) {
    await delay(400);
    process.stdout.write(chalk.white('.'));
  }
  console.log();

  removeCaughtPokemon(pokemonId, EVOLVE_COST);
  addCaughtPokemon(evolvedInfo.id, evolvedInfo.koreanName, 1, 'evolution', evolvedInfo.rarity);

  await showPokemonImage(evolvedInfo.spriteUrl);
  const typeTag = formatTypes(evolvedInfo.types);
  console.log(chalk.green.bold(`\n  🎉 축하합니다! ${selectedInfo.name}이(가) ${evolvedInfo.koreanName}(으)로 진화했다!`));
  if (typeTag) console.log(chalk.gray(`  타입: ${typeTag}`));
}

async function doEnhance(
  pokemonId: number,
  selectedInfo: { name: string; count: number },
  caught: ReturnType<typeof getAllCaughtPokemon>
): Promise<void> {
  // 같은 포켓몬 중 가장 레벨 높은 것을 강화 대상으로
  const samePokemon = caught
    .filter((p) => p.pokemon_id === pokemonId)
    .sort((a, b) => b.level - a.level);
  const target = samePokemon[0];

  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: `${selectedInfo.name} ${ENHANCE_COST}마리를 합쳐 Lv.${target.level} → Lv.${target.level + ENHANCE_LEVELS} 로 강화하시겠습니까?`,
      default: true,
    },
  ]);

  if (!confirm) return;

  console.log();
  process.stdout.write(chalk.white(`  ${selectedInfo.name}을(를) 강화하고 있다`));
  for (let i = 0; i < 5; i++) {
    await delay(400);
    process.stdout.write(chalk.magenta('.'));
  }
  console.log();

  // 나머지 2마리 제거 (가장 레벨 높은 1마리는 유지)
  const toRemove = samePokemon.slice(1, ENHANCE_COST);
  for (const p of toRemove) {
    removeCaughtPokemon(pokemonId, 1);
  }

  // 강화: 레벨 + 스탯 보너스
  const result = enhancePokemon(target.id, ENHANCE_LEVELS);
  if (!result) return;

  const info = await getPokemonInfo(pokemonId);
  await showPokemonImage(info.spriteUrl);
  const typeTag = formatTypes(info.types);
  console.log(chalk.magenta.bold(`\n  ⚡ 강화 성공! ${selectedInfo.name} Lv.${result.newLevel} (+${result.enhanceCount}강)`));
  if (typeTag) console.log(chalk.gray(`  타입: ${typeTag}`));
  console.log(chalk.cyan(`  HP +10 (총 +${result.bonusHp})  ATK +3 (총 +${result.bonusAtk})  DEF +2 (총 +${result.bonusDef})`));
  console.log(chalk.gray(`  (${ENHANCE_COST - 1}마리를 합쳐 레벨 +${ENHANCE_LEVELS})`));
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
