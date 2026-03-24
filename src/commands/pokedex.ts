import chalk from 'chalk';
import inquirer from 'inquirer';
import { getUniqueCaughtIds, getUniqueEncounteredIds, getAllCaughtPokemon } from '../services/database.js';
import { RARITY_CONFIG } from '../services/pokemon.js';
import type { Rarity } from '../types/index.js';

const TOTAL_POKEMON = 386;

export async function pokedexCommand(): Promise<void> {
  const caughtIds = getUniqueCaughtIds();
  const encounteredIds = getUniqueEncounteredIds();
  const allEncountered = new Set([...caughtIds, ...encounteredIds]);
  const caughtSet = new Set(caughtIds);

  const completionRate = Math.round((caughtIds.length / TOTAL_POKEMON) * 100);
  const discoveryRate = Math.round((allEncountered.size / TOTAL_POKEMON) * 100);

  console.log(chalk.yellow('\n  📖 포켓몬 도감\n'));
  console.log(chalk.gray('  ─────────────────────────────────────'));
  console.log(`  ${chalk.white('발견')}    ${chalk.cyan.bold(allEncountered.size.toString())} / ${TOTAL_POKEMON} (${discoveryRate}%)`);
  console.log(`  ${chalk.white('포획')}    ${chalk.green.bold(caughtIds.length.toString())} / ${TOTAL_POKEMON} (${completionRate}%)`);

  // 진행 바
  const barWidth = 30;
  const filledCaught = Math.round((caughtIds.length / TOTAL_POKEMON) * barWidth);
  const filledSeen = Math.round((allEncountered.size / TOTAL_POKEMON) * barWidth) - filledCaught;
  const empty = barWidth - filledCaught - Math.max(0, filledSeen);
  const bar = chalk.green('█'.repeat(filledCaught)) +
              chalk.cyan('▓'.repeat(Math.max(0, filledSeen))) +
              chalk.gray('░'.repeat(Math.max(0, empty)));
  console.log(`  [${bar}]`);

  // 희귀도별 포획 현황
  console.log(chalk.gray('\n  ─────────────────────────────────────'));
  const caught = getAllCaughtPokemon();
  const rarityCount: Record<string, number> = {};
  for (const p of caught) {
    const r = p.rarity || 'common';
    rarityCount[r] = (rarityCount[r] || 0) + 1;
  }
  for (const [rarity, config] of Object.entries(RARITY_CONFIG)) {
    const count = rarityCount[rarity] || 0;
    console.log(`  ${config.icon} ${chalk.hex(config.color)(config.label.padEnd(6))} ${chalk.white(count.toString())}마리`);
  }

  console.log(chalk.gray('  ─────────────────────────────────────'));

  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: '상세 보기:',
      choices: [
        { name: '번호순 도감 보기', value: 'list' },
        { name: chalk.gray('← 돌아가기'), value: 'back' },
      ],
    },
  ]);

  if (action === 'back') return;

  // 번호순 도감 (페이지네이션)
  const pageSize = 20;
  let page = 0;
  const totalPages = Math.ceil(TOTAL_POKEMON / pageSize);

  while (true) {
    console.log(chalk.yellow(`\n  도감 (${page + 1}/${totalPages} 페이지)\n`));

    const start = page * pageSize + 1;
    const end = Math.min((page + 1) * pageSize, TOTAL_POKEMON);

    for (let id = start; id <= end; id++) {
      const num = `#${id.toString().padStart(3, '0')}`;
      if (caughtSet.has(id)) {
        const pokemon = caught.find((p) => p.pokemon_id === id);
        const name = pokemon?.pokemon_name || '???';
        const rarity = (pokemon?.rarity || 'common') as Rarity;
        const config = RARITY_CONFIG[rarity];
        console.log(`  ${chalk.green(num)} ${chalk.hex(config.color)(name.padEnd(12))} ${config.icon}`);
      } else if (allEncountered.has(id)) {
        console.log(`  ${chalk.cyan(num)} ${chalk.gray('??? (발견됨)')}`);
      } else {
        console.log(`  ${chalk.gray(num)} ${chalk.gray('─────')}`);
      }
    }

    const navChoices: any[] = [];
    if (page > 0) navChoices.push({ name: '◀ 이전', value: 'prev' });
    if (page < totalPages - 1) navChoices.push({ name: '다음 ▶', value: 'next' });
    navChoices.push({ name: chalk.gray('← 돌아가기'), value: 'back' });

    const { nav } = await inquirer.prompt([
      { type: 'list', name: 'nav', message: '이동:', choices: navChoices },
    ]);

    if (nav === 'prev') page--;
    else if (nav === 'next') page++;
    else break;
  }
}
