import chalk from 'chalk';
import inquirer from 'inquirer';
import { CaughtPokemon } from '../types/index.js';
import { pokemonTypeColor } from './display.js';

/**
 * 포켓몬 목록에서 선택 (이름 검색 + 뒤로가기 포함)
 * @returns 선택된 포켓몬, 또는 null (뒤로가기)
 */
export async function selectPokemonWithSearch(
  pokemon: CaughtPokemon[],
  message: string,
  renderItem: (p: CaughtPokemon) => string,
  backLabel = '← 돌아가기',
): Promise<CaughtPokemon | null> {
  let filtered = pokemon;
  let searchQuery = '';

  while (true) {
    if (searchQuery) {
      console.log(chalk.cyan(`  [검색: "${searchQuery}"] ${filtered.length}/${pokemon.length}마리 표시 중`));
    }

    const pokemonChoices = filtered.map((p) => ({
      name: renderItem(p),
      value: p.id.toString(),
    }));

    const choices = [
      { name: chalk.cyan('🔍 이름으로 검색...'), value: '__search__' },
      ...pokemonChoices,
      { name: chalk.gray(backLabel), value: '__back__' },
    ];

    const { pick } = await inquirer.prompt([{
      type: 'list',
      name: 'pick',
      message,
      choices,
    }]);

    if (pick === '__back__') return null;

    if (pick === '__search__') {
      const { query } = await inquirer.prompt([{
        type: 'input',
        name: 'query',
        message: '검색어 입력 (이름, 빈 칸이면 전체 표시):',
      }]);
      searchQuery = query.trim().toLowerCase();
      if (searchQuery) {
        const result = pokemon.filter((p) =>
          p.pokemon_name.toLowerCase().includes(searchQuery)
        );
        if (result.length === 0) {
          console.log(chalk.yellow(`  "${searchQuery}"와 일치하는 포켓몬이 없습니다. 전체 목록으로 돌아갑니다.`));
          filtered = pokemon;
          searchQuery = '';
        } else {
          filtered = result;
        }
      } else {
        filtered = pokemon;
        searchQuery = '';
      }
      continue;
    }

    const selected = filtered.find((p) => p.id.toString() === pick);
    return selected ?? null;
  }
}

export { pokemonTypeColor };
