import chalk from 'chalk';
import inquirer from 'inquirer';
import { getActiveEncounters, expireEncounters } from '../services/database.js';
import { formatTimeRemaining } from '../ui/display.js';
import { RARITY_CONFIG } from '../services/pokemon.js';
import type { Rarity } from '../types/index.js';

export async function encounterCommand(): Promise<number | null> {
  // 먼저 만료된 것들 처리
  const expired = expireEncounters();
  if (expired > 0) {
    console.log(chalk.gray(`  ${expired}마리의 포켓몬이 도망갔습니다...`));
  }

  const encounters = getActiveEncounters();

  if (encounters.length === 0) {
    console.log(chalk.gray('  현재 조우 중인 포켓몬이 없습니다.'));
    console.log(chalk.gray('  커밋을 하면 야생 포켓몬이 나타납니다!'));
    return null;
  }

  console.log(chalk.yellow(`\n  🌿 야생 포켓몬 ${encounters.length}마리 발견!\n`));

  const choices = encounters.map((enc) => {
    const rarity = (enc.rarity || 'common') as Rarity;
    const rarityInfo = RARITY_CONFIG[rarity];
    const rarityTag = rarity !== 'common' ? ` ${rarityInfo.icon}${chalk.hex(rarityInfo.color)(`[${rarityInfo.label}]`)}` : '';
    return {
      name: `야생 ${chalk.bold(enc.pokemon_name)} Lv.${enc.level}${rarityTag}  (남은 시간: ${formatTimeRemaining(enc.expires_at)})`,
      value: enc.id,
    };
  });

  choices.push({
    name: chalk.gray('← 돌아가기'),
    value: -1,
  });

  const { selected } = await inquirer.prompt([
    {
      type: 'list',
      name: 'selected',
      message: '포켓몬을 선택하세요:',
      choices,
    },
  ]);

  if (selected === -1) return null;
  return selected;
}
