import chalk from 'chalk';
import inquirer from 'inquirer';
import {
  getAllCaughtPokemon,
  getCaughtCountByPokemonId,
  removeCaughtPokemon,
  addCaughtPokemon,
} from '../services/database.js';
import { getEvolution, getPokemonInfo } from '../services/pokemon.js';
import { showPokemonImage } from '../ui/display.js';

const EVOLVE_COST = 3; // 같은 포켓몬 3마리 필요

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
    console.log(chalk.gray('  진화 가능한 포켓몬이 없습니다.'));
    console.log(chalk.gray(`  같은 포켓몬 ${EVOLVE_COST}마리를 모으면 진화할 수 있습니다!`));
    return;
  }

  console.log(chalk.yellow(`\n  🧬 진화 가능한 포켓몬\n`));

  const choices = evolvable.map((e) => ({
    name: `${e.name} (보유: ${e.count}마리, 비용: ${EVOLVE_COST}마리)`,
    value: e.pokemonId,
  }));
  choices.push({ name: chalk.gray('← 돌아가기'), value: -1 } as any);

  const { selected } = await inquirer.prompt([
    {
      type: 'list',
      name: 'selected',
      message: '진화할 포켓몬을 선택하세요:',
      choices,
    },
  ]);

  if (selected === -1) return;

  const selectedInfo = evolvable.find((e) => e.pokemonId === selected);
  if (!selectedInfo) return;

  // PokeAPI에서 진화 정보 가져오기
  console.log(chalk.gray('\n  진화 정보를 확인하는 중...'));
  const evoResult = await getEvolution(selected);

  if (!evoResult) {
    console.log(chalk.red(`  ${selectedInfo.name}은(는) 더 이상 진화할 수 없습니다!`));
    return;
  }

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

  // 진화 애니메이션
  console.log();
  process.stdout.write(chalk.white(`  ${selectedInfo.name}이(가) 진화하고 있다`));
  for (let i = 0; i < 5; i++) {
    await delay(400);
    process.stdout.write(chalk.white('.'));
  }
  console.log();

  // 기존 포켓몬 제거 + 진화 포켓몬 추가
  removeCaughtPokemon(selected, EVOLVE_COST);
  addCaughtPokemon(evolvedInfo.id, evolvedInfo.koreanName, 1, 'evolution', evolvedInfo.rarity);

  await showPokemonImage(evolvedInfo.spriteUrl);
  console.log(chalk.green.bold(`\n  🎉 축하합니다! ${selectedInfo.name}이(가) ${evolvedInfo.koreanName}(으)로 진화했다!`));
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
