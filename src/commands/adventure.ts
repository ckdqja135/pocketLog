import chalk from 'chalk';
import inquirer from 'inquirer';
import { AdventureConfig } from '../types/index.js';
import { selectPokemonWithSearch } from '../ui/pokemon-select.js';
import {
  getAllCaughtPokemon,
  getActiveAdventure,
  getCompletedAdventures,
  addAdventure,
  claimAdventure,
  addExperience,
  addStamina,
  addCaughtPokemon,
  isPokemonOnAdventure,
} from '../services/database.js';
import { getRandomPokemonId, getPokemonInfo, RARITY_CONFIG } from '../services/pokemon.js';
import { pokemonTypeColor } from '../ui/display.js';

const ADVENTURE_CONFIGS: AdventureConfig[] = [
  {
    name: '단거리 탐험',
    icon: '🏃',
    type: 'short',
    durationMinutes: 10,
    expReward: [10, 20],
    staminaReward: [1, 2],
    pokemonChance: 0,
  },
  {
    name: '중거리 원정',
    icon: '🧭',
    type: 'medium',
    durationMinutes: 30,
    expReward: [25, 50],
    staminaReward: [2, 3],
    pokemonChance: 0.3,
  },
  {
    name: '장거리 모험',
    icon: '🗺️',
    type: 'long',
    durationMinutes: 60,
    expReward: [50, 100],
    staminaReward: [3, 5],
    pokemonChance: 0.6,
  },
];

export async function adventureCommand(): Promise<void> {
  console.log(chalk.yellow(`\n  🗺️ 포켓몬 모험`));

  // 먼저 완료된 모험이 있는지 확인
  const completed = getCompletedAdventures();
  if (completed.length > 0) {
    console.log(chalk.green(`\n  📬 완료된 모험이 ${completed.length}건 있습니다!\n`));

    for (const adv of completed) {
      console.log(chalk.cyan(`  ${adv.pokemon_name}의 ${getAdventureLabel(adv.adventure_type)} 결과:`));
      console.log(chalk.green(`    ✅ 경험치 +${adv.reward_exp}`));
      console.log(chalk.blue(`    ⚡ 스태미나 +${adv.reward_stamina}`));

      // 경험치 지급
      addExperience(adv.caught_pokemon_id, adv.reward_exp);
      // 스태미나 지급
      addStamina(adv.reward_stamina);

      // 포켓몬 발견
      if (adv.reward_pokemon_id) {
        const info = await getPokemonInfo(adv.reward_pokemon_id);
        const level = Math.floor(Math.random() * 10) + 1;
        const rarityConfig = RARITY_CONFIG[info.rarity];
        console.log(chalk.hex(rarityConfig.color)(
          `    ${rarityConfig.icon} ${info.koreanName} Lv.${level}을(를) 데려왔다! [${rarityConfig.label}]`
        ));
        addCaughtPokemon(adv.reward_pokemon_id, info.koreanName, level, 'adventure', info.rarity);
      }

      claimAdventure(adv.id);
      console.log();
    }
    return;
  }

  // 진행 중인 모험 확인
  const active = getActiveAdventure();
  if (active) {
    const endsAt = new Date(active.ends_at.includes('T') ? active.ends_at : active.ends_at + 'Z');
    const remaining = endsAt.getTime() - Date.now();

    if (remaining > 0) {
      const minutes = Math.ceil(remaining / 60000);
      console.log(chalk.cyan(`\n  ${active.pokemon_name}이(가) ${getAdventureLabel(active.adventure_type)} 중입니다.`));
      console.log(chalk.gray(`  남은 시간: ${minutes}분`));
      console.log(chalk.gray(`  완료되면 다시 adventure를 입력해 보상을 수령하세요.`));
      return;
    }
  }

  // 새 모험 보내기
  const pokemon = getAllCaughtPokemon();
  if (pokemon.length === 0) {
    console.log(chalk.gray('  모험을 보낼 포켓몬이 없습니다. 먼저 포켓몬을 잡아주세요!'));
    return;
  }

  const availablePokemon = pokemon.filter((p) => !isPokemonOnAdventure(p.id));
  if (availablePokemon.length === 0) {
    console.log(chalk.gray('  모든 포켓몬이 모험 중입니다!'));
    return;
  }

  // 포켓몬 선택
  const selected = await selectPokemonWithSearch(
    availablePokemon,
    '어떤 포켓몬을 모험에 보낼까요?',
    (p) => `${chalk.hex(pokemonTypeColor(p.pokemon_id))(p.pokemon_name.padEnd(12))} Lv.${p.level.toString().padStart(2)}`,
  );
  if (!selected) return;

  // 모험 유형 선택
  const { config } = await inquirer.prompt([
    {
      type: 'list',
      name: 'config',
      message: '모험 유형을 선택하세요:',
      choices: [
        ...ADVENTURE_CONFIGS.map((c) => ({
          name: `${c.icon} ${c.name}  (${c.durationMinutes}분, EXP ${c.expReward[0]}~${c.expReward[1]}${c.pokemonChance > 0 ? `, 포켓몬 발견 ${Math.round(c.pokemonChance * 100)}%` : ''})`,
          value: c as AdventureConfig | null,
        })),
        { name: chalk.gray('← 돌아가기'), value: null as AdventureConfig | null },
      ],
    },
  ]);
  if (!config) return;

  // 보상 미리 계산
  const rewardExp = randomBetween(config.expReward[0], config.expReward[1]);
  const rewardStamina = randomBetween(config.staminaReward[0], config.staminaReward[1]);
  const rewardPokemonId = Math.random() < config.pokemonChance ? getRandomPokemonId() : null;

  // 종료 시간 계산
  const endsAt = new Date(Date.now() + config.durationMinutes * 60 * 1000).toISOString();

  addAdventure(selected.id, selected.pokemon_name, config.type, endsAt, rewardExp, rewardStamina, rewardPokemonId);

  console.log(chalk.green(`\n  🚀 ${selected.pokemon_name}이(가) ${config.icon} ${config.name}을(를) 떠났습니다!`));
  console.log(chalk.gray(`  ${config.durationMinutes}분 후에 돌아옵니다. adventure 명령어로 확인하세요.`));
}

function getAdventureLabel(type: string): string {
  switch (type) {
    case 'short': return '🏃 단거리 탐험';
    case 'medium': return '🧭 중거리 원정';
    case 'long': return '🗺️ 장거리 모험';
    default: return '모험';
  }
}

function randomBetween(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}
