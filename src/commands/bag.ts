import chalk from 'chalk';
import { getAllCaughtPokemon } from '../services/database.js';
import { pokemonTypeColor } from '../ui/display.js';

export async function bagCommand(): Promise<void> {
  const pokemon = getAllCaughtPokemon();

  if (pokemon.length === 0) {
    console.log(chalk.gray('  보관함이 비어있습니다.'));
    console.log(chalk.gray('  포켓몬을 포획하면 여기에 저장됩니다!'));
    return;
  }

  console.log(chalk.yellow(`\n  🎒 내 포켓몬 보관함 (${pokemon.length}마리)\n`));
  console.log(chalk.gray('  ─────────────────────────────────────'));

  pokemon.forEach((p, index) => {
    const color = pokemonTypeColor(p.pokemon_id);
    const date = new Date(p.caught_at).toLocaleDateString('ko-KR');
    console.log(
      `  ${chalk.gray(`#${(index + 1).toString().padStart(3, '0')}`)} ` +
      `${chalk.hex(color).bold(p.pokemon_name.padEnd(12))} ` +
      `${chalk.white(`Lv.${p.level.toString().padStart(2)}`)}  ` +
      `${chalk.gray(date)}`
    );
  });

  console.log(chalk.gray('  ─────────────────────────────────────'));
}
