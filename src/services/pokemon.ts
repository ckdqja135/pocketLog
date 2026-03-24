import got from 'got';
import { PokemonInfo } from '../types/index.js';

const MAX_POKEMON_ID = 386; // 1~3세대

export function getRandomPokemonId(): number {
  return Math.floor(Math.random() * MAX_POKEMON_ID) + 1;
}

export function calculateLevel(diffLines: number): number {
  if (diffLines < 10) return Math.floor(Math.random() * 3) + 1;
  if (diffLines < 50) return Math.floor(Math.random() * 5) + 3;
  if (diffLines < 100) return Math.floor(Math.random() * 5) + 8;
  if (diffLines < 300) return Math.floor(Math.random() * 5) + 13;
  return Math.floor(Math.random() * 10) + 18;
}

export async function getPokemonInfo(pokemonId: number): Promise<PokemonInfo> {
  try {
    const speciesRes = await got(`https://pokeapi.co/api/v2/pokemon-species/${pokemonId}`, {
      responseType: 'json',
    });
    const speciesData = speciesRes.body as any;

    const koreanEntry = speciesData.names?.find(
      (n: any) => n.language.name === 'ko'
    );
    const koreanName = koreanEntry?.name || speciesData.name;

    const spriteUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${pokemonId}.png`;

    return {
      id: pokemonId,
      name: speciesData.name,
      koreanName,
      spriteUrl,
    };
  } catch {
    return {
      id: pokemonId,
      name: `pokemon-${pokemonId}`,
      koreanName: `포켓몬 #${pokemonId}`,
      spriteUrl: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokemonId}.png`,
    };
  }
}

export function getCatchRate(level: number): number {
  const rate = Math.max(0.2, 0.7 - (level - 1) * 0.02);
  return rate;
}

export function attemptCatch(level: number): boolean {
  const rate = getCatchRate(level);
  return Math.random() < rate;
}
