import chalk from 'chalk';
import inquirer from 'inquirer';
import { HuntZone, Rarity } from '../types/index.js';
import {
  getStamina,
  useStamina,
  addCaughtPokemon,
  getTotalCommits,
  getStreakBonus,
  getCommitStreak,
} from '../services/database.js';
import { getPokemonInfo, getAvailableBalls, getCatchRate, attemptCatch, RARITY_CONFIG } from '../services/pokemon.js';
import { showPokemonImage } from '../ui/display.js';
import { checkBadges } from './badges.js';

const MAX_POKEMON_ID = 386;

const HUNT_ZONES: HuntZone[] = [
  {
    name: '풀숲',
    icon: '🌿',
    staminaCost: 1,
    rarityWeights: { common: 60, uncommon: 30, rare: 8, legendary: 1.5, mythical: 0.5 },
  },
  {
    name: '동굴',
    icon: '🪨',
    staminaCost: 2,
    rarityWeights: { common: 20, uncommon: 40, rare: 30, legendary: 8, mythical: 2 },
  },
  {
    name: '바다',
    icon: '🌊',
    staminaCost: 3,
    rarityWeights: { common: 10, uncommon: 25, rare: 40, legendary: 18, mythical: 7 },
  },
];

// 희귀도 분류 (pokemon.ts와 동일 로직 재사용)
const LEGENDARY_IDS = [144, 145, 146, 150, 243, 244, 245, 249, 250, 377, 378, 379, 380, 381, 382, 383, 384];
const MYTHICAL_IDS = [151, 251, 385, 386];
const RARE_IDS = [3, 6, 9, 154, 157, 160, 254, 257, 260, 130, 131, 143, 149, 248, 289, 306, 330, 348, 362, 373, 376, 134, 135, 136, 196, 197];

function getRarity(pokemonId: number): Rarity {
  if (MYTHICAL_IDS.includes(pokemonId)) return 'mythical';
  if (LEGENDARY_IDS.includes(pokemonId)) return 'legendary';
  if (RARE_IDS.includes(pokemonId)) return 'rare';
  const uncommonRanges = [
    2,5,8,15,18,22,25,26,28,31,34,36,38,40,42,45,47,49,51,53,55,57,59,62,65,68,71,73,76,78,80,82,85,87,89,91,94,97,99,101,103,105,107,108,110,112,113,114,115,119,121,122,123,124,125,126,127,128,137,139,141,142,148,
    153,156,159,164,168,171,178,181,182,184,186,189,195,199,203,205,208,210,211,212,213,214,217,219,221,224,225,226,227,229,230,232,233,234,237,241,242,247,
    253,256,259,264,267,269,272,275,277,279,282,284,286,288,295,297,301,303,305,308,310,311,312,317,319,321,323,326,327,329,332,334,337,338,340,342,344,346,350,354,356,358,359,365,367,368,370,372,375,
  ];
  if (uncommonRanges.includes(pokemonId)) return 'uncommon';
  return 'common';
}

function getRandomPokemonByZone(zone: HuntZone): number {
  const roll = Math.random() * 100;
  let targetRarity: Rarity;

  let cumulative = 0;
  const rarities: Rarity[] = ['mythical', 'legendary', 'rare', 'uncommon', 'common'];
  targetRarity = 'common';
  for (const r of rarities) {
    cumulative += zone.rarityWeights[r];
    if (roll < cumulative) {
      targetRarity = r;
      break;
    }
  }

  const candidates: number[] = [];
  for (let id = 1; id <= MAX_POKEMON_ID; id++) {
    if (getRarity(id) === targetRarity) candidates.push(id);
  }

  if (candidates.length === 0) return Math.floor(Math.random() * MAX_POKEMON_ID) + 1;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

export async function huntCommand(): Promise<void> {
  const stamina = getStamina();

  console.log(chalk.yellow(`\n  🎯 포켓몬 사냥`));
  console.log(chalk.gray(`  현재 스태미나: ${'⚡'.repeat(stamina)}${'░'.repeat(Math.max(0, 10 - stamina))} ${stamina}/10\n`));

  if (stamina === 0) {
    console.log(chalk.red('  스태미나가 부족합니다! 커밋을 하거나 모험 보상으로 충전하세요.'));
    return;
  }

  const availableZones = HUNT_ZONES.filter((z) => z.staminaCost <= stamina);

  const { zone } = await inquirer.prompt([
    {
      type: 'list',
      name: 'zone',
      message: '어디로 사냥을 떠날까요?',
      choices: [
        ...availableZones.map((z) => ({
          name: `${z.icon} ${z.name}  (스태미나 ${z.staminaCost} 소모) - 희귀 확률: ${z.rarityWeights.rare + z.rarityWeights.legendary + z.rarityWeights.mythical}%`,
          value: z as HuntZone | null,
        })),
        { name: chalk.gray('← 돌아가기'), value: null as HuntZone | null },
      ],
    },
  ]);
  if (!zone) return;

  // 스태미나 소모
  const success = useStamina(zone.staminaCost);
  if (!success) {
    console.log(chalk.red('  스태미나가 부족합니다!'));
    return;
  }

  const remainingStamina = getStamina();
  console.log(chalk.gray(`  스태미나 소모: -${zone.staminaCost} (남은 스태미나: ${remainingStamina})`));

  // 포켓몬 조우
  console.log(chalk.cyan(`\n  ${zone.icon} ${zone.name}을(를) 탐색하는 중...`));
  await delay(1000);

  const pokemonId = getRandomPokemonByZone(zone);
  const info = await getPokemonInfo(pokemonId);
  const level = Math.floor(Math.random() * 20) + 1;
  const rarityConfig = RARITY_CONFIG[info.rarity];

  await showPokemonImage(info.spriteUrl);

  console.log(chalk.hex(rarityConfig.color)(
    `\n  ${rarityConfig.icon} 야생의 ${chalk.bold(info.koreanName)} Lv.${level} 이(가) 나타났다! [${rarityConfig.label}]`
  ));

  // 포획 시도
  const streak = getCommitStreak();
  const streakBonus = getStreakBonus();
  if (streak > 0) {
    console.log(chalk.green(`  🔥 연속 커밋 ${streak}일! 포획률 +${Math.round(streakBonus * 100)}%`));
  }

  const totalCommits = getTotalCommits();
  const availableBalls = getAvailableBalls(totalCommits);

  let selectedBall = availableBalls[0];
  if (availableBalls.length > 1) {
    const { ball } = await inquirer.prompt([
      {
        type: 'list',
        name: 'ball',
        message: '어떤 볼을 사용할까요?',
        choices: availableBalls.map((b) => {
          const rate = getCatchRate(level, b.bonus, streakBonus);
          return {
            name: `${b.icon} ${b.name}  (포획률: ${Math.min(100, Math.round(rate * 100))}%)`,
            value: b,
          };
        }),
      },
    ]);
    selectedBall = ball;
  } else {
    const rate = getCatchRate(level, selectedBall.bonus, streakBonus);
    console.log(chalk.gray(`  ${selectedBall.icon} ${selectedBall.name} 사용 (포획률: ${Math.round(rate * 100)}%)`));
  }

  console.log();
  process.stdout.write(chalk.white(`  ${selectedBall.icon} ${selectedBall.name}을(를) 던졌다!`));
  await delay(500);
  process.stdout.write(chalk.white(' .'));
  await delay(500);
  process.stdout.write(chalk.white('.'));
  await delay(500);
  process.stdout.write(chalk.white('.'));
  await delay(500);
  console.log();

  const caught = attemptCatch(level, selectedBall.bonus, streakBonus);

  if (caught) {
    console.log(chalk.green.bold(`\n  ✨ 축하합니다! ${info.koreanName}을(를) 잡았다!`));
    addCaughtPokemon(pokemonId, info.koreanName, level, 'hunt', info.rarity);
    const newBadges = checkBadges();
    for (const b of newBadges) {
      console.log(chalk.yellow(`  🎊 업적 달성! ${b}`));
    }
  } else {
    console.log(chalk.red(`\n  💨 앗! ${info.koreanName}이(가) 도망쳤다!`));
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
