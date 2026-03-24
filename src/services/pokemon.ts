import got from 'got';
import { PokemonInfo, BallType, Rarity } from '../types/index.js';

const MAX_POKEMON_ID = 386; // 1~3세대

// --- 희귀도 분류 ---
const LEGENDARY_IDS = [
  144, 145, 146, 150, // 1세대: 프리져, 썬더, 파이어, 뮤츠
  243, 244, 245, 249, 250, // 2세대: 라이코, 앤테이, 스이쿤, 루기아, 호오우
  377, 378, 379, 380, 381, 382, 383, 384, // 3세대: 레지 시리즈, 라티 시리즈, 가이오가, 그란돈, 레쿠쟈
];

const MYTHICAL_IDS = [
  151, // 뮤
  251, // 세레비
  385, 386, // 지라치, 데옥시스
];

const RARE_IDS = [
  // 스타터 최종 진화
  3, 6, 9, 154, 157, 160, 254, 257, 260,
  // 인기 포켓몬
  130, 131, 143, 149, // 갸라도스, 라프라스, 잠만보, 망나뇽
  248, 289, 306, 330, 348, 362, 373, 376, // 2~3세대 후반 진화
  // 이브이 진화군
  134, 135, 136, 196, 197,
];

function getRarity(pokemonId: number): Rarity {
  if (MYTHICAL_IDS.includes(pokemonId)) return 'mythical';
  if (LEGENDARY_IDS.includes(pokemonId)) return 'legendary';
  if (RARE_IDS.includes(pokemonId)) return 'rare';
  // 2단 진화 포켓몬은 uncommon
  if (pokemonId <= 386) {
    const uncommonRanges = [
      // 1세대 2단진화 일부
      2,5,8,15,18,22,25,26,28,31,34,36,38,40,42,45,47,49,51,53,55,57,59,62,65,68,71,73,76,78,80,82,85,87,89,91,94,97,99,101,103,105,107,108,110,112,113,114,115,119,121,122,123,124,125,126,127,128,137,139,141,142,148,
      // 2세대
      153,156,159,164,168,171,178,181,182,184,186,189,195,199,203,205,208,210,211,212,213,214,217,219,221,224,225,226,227,229,230,232,233,234,237,241,242,247,
      // 3세대
      253,256,259,264,267,269,272,275,277,279,282,284,286,288,295,297,301,303,305,308,310,311,312,317,319,321,323,326,327,329,332,334,337,338,340,342,344,346,350,354,356,358,359,365,367,368,370,372,375,
    ];
    if (uncommonRanges.includes(pokemonId)) return 'uncommon';
  }
  return 'common';
}

export const RARITY_CONFIG: Record<Rarity, { weight: number; color: string; label: string; icon: string }> = {
  common:    { weight: 60,   color: '#AAAAAA', label: '일반',   icon: '⚪' },
  uncommon:  { weight: 25,   color: '#4FC3F7', label: '고급',   icon: '🔵' },
  rare:      { weight: 10,   color: '#AB47BC', label: '희귀',   icon: '🟣' },
  legendary: { weight: 4,    color: '#FFD700', label: '전설',   icon: '🌟' },
  mythical:  { weight: 1,    color: '#FF6D00', label: '신화',   icon: '✨' },
};

// 희귀도 기반 가중치로 포켓몬 ID 선택
export function getRandomPokemonId(): number {
  const roll = Math.random() * 100;
  let targetRarity: Rarity;

  if (roll < RARITY_CONFIG.mythical.weight) {
    targetRarity = 'mythical';
  } else if (roll < RARITY_CONFIG.mythical.weight + RARITY_CONFIG.legendary.weight) {
    targetRarity = 'legendary';
  } else if (roll < RARITY_CONFIG.mythical.weight + RARITY_CONFIG.legendary.weight + RARITY_CONFIG.rare.weight) {
    targetRarity = 'rare';
  } else if (roll < RARITY_CONFIG.mythical.weight + RARITY_CONFIG.legendary.weight + RARITY_CONFIG.rare.weight + RARITY_CONFIG.uncommon.weight) {
    targetRarity = 'uncommon';
  } else {
    targetRarity = 'common';
  }

  // 해당 희귀도의 포켓몬 목록에서 랜덤 선택
  const candidates: number[] = [];
  for (let id = 1; id <= MAX_POKEMON_ID; id++) {
    if (getRarity(id) === targetRarity) {
      candidates.push(id);
    }
  }

  if (candidates.length === 0) {
    return Math.floor(Math.random() * MAX_POKEMON_ID) + 1;
  }

  return candidates[Math.floor(Math.random() * candidates.length)];
}

export function calculateLevel(diffLines: number): number {
  if (diffLines < 10) return Math.floor(Math.random() * 3) + 1;
  if (diffLines < 50) return Math.floor(Math.random() * 5) + 3;
  if (diffLines < 100) return Math.floor(Math.random() * 5) + 8;
  if (diffLines < 300) return Math.floor(Math.random() * 5) + 13;
  return Math.floor(Math.random() * 10) + 18;
}

export async function getPokemonInfo(pokemonId: number): Promise<PokemonInfo> {
  const rarity = getRarity(pokemonId);
  try {
    const speciesRes = await got(`https://pokeapi.co/api/v2/pokemon-species/${pokemonId}`, {
      responseType: 'json',
    });
    const speciesData = speciesRes.body as any;

    const koreanEntry = speciesData.names?.find(
      (n: any) => n.language.name === 'ko'
    );
    const koreanName = koreanEntry?.name || speciesData.name;

    // 진화 체인 ID 추출
    const evoChainUrl: string = speciesData.evolution_chain?.url || '';
    const evoChainId = evoChainUrl ? parseInt(evoChainUrl.split('/').filter(Boolean).pop() || '0') : undefined;

    const spriteUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${pokemonId}.png`;

    return {
      id: pokemonId,
      name: speciesData.name,
      koreanName,
      spriteUrl,
      rarity,
      evolutionChainId: evoChainId,
    };
  } catch {
    return {
      id: pokemonId,
      name: `pokemon-${pokemonId}`,
      koreanName: `포켓몬 #${pokemonId}`,
      spriteUrl: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokemonId}.png`,
      rarity,
    };
  }
}

// 진화 가능 대상 조회 (PokeAPI 진화 체인)
export async function getEvolution(pokemonId: number): Promise<{ evolvesToId: number; evolvesToName: string } | null> {
  try {
    const speciesRes = await got(`https://pokeapi.co/api/v2/pokemon-species/${pokemonId}`, {
      responseType: 'json',
    });
    const speciesData = speciesRes.body as any;
    const evoChainUrl: string = speciesData.evolution_chain?.url;
    if (!evoChainUrl) return null;

    const evoRes = await got(evoChainUrl, { responseType: 'json' });
    const evoData = evoRes.body as any;

    // 체인에서 현재 포켓몬의 다음 진화 찾기
    function findNext(chain: any): any {
      const speciesName = chain.species.name;
      const speciesUrl: string = chain.species.url;
      const chainSpeciesId = parseInt(speciesUrl.split('/').filter(Boolean).pop() || '0');

      if (chainSpeciesId === pokemonId) {
        if (chain.evolves_to && chain.evolves_to.length > 0) {
          const next = chain.evolves_to[0];
          const nextUrl: string = next.species.url;
          const nextId = parseInt(nextUrl.split('/').filter(Boolean).pop() || '0');
          if (nextId > 0 && nextId <= MAX_POKEMON_ID) {
            return { evolvesToId: nextId, evolvesToName: next.species.name };
          }
        }
        return null;
      }

      for (const evo of chain.evolves_to || []) {
        const result = findNext(evo);
        if (result) return result;
      }
      return null;
    }

    return findNext(evoData.chain);
  } catch {
    return null;
  }
}

// --- 몬스터볼 종류 ---
export const BALL_TYPES: BallType[] = [
  { name: '몬스터볼',   icon: '⚪', bonus: 1.0,  requiredCommits: 0 },
  { name: '슈퍼볼',     icon: '🔵', bonus: 1.3,  requiredCommits: 30 },
  { name: '하이퍼볼',   icon: '🟡', bonus: 1.7,  requiredCommits: 100 },
  { name: '마스터볼',   icon: '🟣', bonus: 999,  requiredCommits: 300 },
];

export function getAvailableBalls(totalCommits: number): BallType[] {
  return BALL_TYPES.filter((b) => totalCommits >= b.requiredCommits);
}

export function getCatchRate(level: number, ballBonus: number = 1.0, streakBonus: number = 0): number {
  const base = Math.max(0.2, 0.7 - (level - 1) * 0.02);
  const rate = Math.min(1.0, base * ballBonus + streakBonus);
  return rate;
}

export function attemptCatch(level: number, ballBonus: number = 1.0, streakBonus: number = 0): boolean {
  const rate = getCatchRate(level, ballBonus, streakBonus);
  return Math.random() < rate;
}
