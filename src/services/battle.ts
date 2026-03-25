import got from 'got';
import { Skill, PokemonType, BattlePokemonState } from '../types/index.js';
import { getRandomPokemonId, getPokemonInfo } from './pokemon.js';
import { getConfig } from './database.js';

// --- PokeAPI에서 실제 기술 가져오기 ---
interface PokeApiMove {
  name: string;
  power: number | null;
  pp: number;
  type: { name: string };
  damage_class: { name: string }; // physical, special, status
  names: { name: string; language: { name: string } }[];
  meta?: {
    ailment?: { name: string };
    drain?: number;
    healing?: number;
  };
}

const moveCache = new Map<string, Skill>();

async function fetchMoveData(moveName: string): Promise<Skill | null> {
  if (moveCache.has(moveName)) return moveCache.get(moveName)!;

  try {
    const res = await got(`https://pokeapi.co/api/v2/move/${moveName}`, {
      responseType: 'json',
      timeout: { request: 5000 },
    });
    const data = res.body as PokeApiMove;

    const koreanEntry = data.names?.find((n) => n.language.name === 'ko');
    const koreanName = koreanEntry?.name || moveName;

    // 효과 결정
    let effect: Skill['effect'] = 'damage';
    const healing = data.meta?.healing || 0;
    const drain = data.meta?.drain || 0;
    const ailment = data.meta?.ailment?.name || 'none';

    if (healing > 0 || data.damage_class.name === 'status' && drain === 0 && ailment === 'none') {
      effect = 'heal';
    } else if (drain > 0) {
      effect = 'drain';
    } else if (ailment === 'burn' || ailment === 'poison') {
      effect = 'burn';
    } else if (ailment === 'paralysis' || ailment === 'freeze' || ailment === 'sleep') {
      effect = 'paralyze';
    }

    // power → 우리 시스템의 power 스케일로 변환 (원작 power 0~250 → 0.5~4.0)
    const rawPower = data.power || 0;
    const scaledPower = rawPower > 0 ? Math.max(0.5, rawPower / 40) : (effect === 'heal' ? 2.0 : 0);

    // pp → mpCost 변환 (pp가 적을수록 강한 기술 = mp 많이 소모)
    const mpCost = rawPower > 0
      ? Math.max(0, Math.floor((150 - rawPower) / 10))
      : (data.pp <= 10 ? 12 : 6);
    // 기본기(pp 35+)는 mpCost 0
    const finalMpCost = data.pp >= 30 && rawPower <= 50 ? 0 : Math.min(20, mpCost);

    // 타입별 아이콘
    const typeIcons: Record<string, string> = {
      normal: '💥', fire: '🔥', water: '💧', grass: '🌿', electric: '⚡',
      ice: '❄️', fighting: '🥊', poison: '☠️', ground: '🌍', flying: '🕊️',
      psychic: '🔮', bug: '🐛', rock: '🪨', ghost: '👻', dragon: '🐉',
      dark: '🌑', steel: '⚙️', fairy: '✨',
    };

    const skill: Skill = {
      name: koreanName,
      icon: typeIcons[data.type.name] || '⭐',
      type: data.type.name as PokemonType,
      power: scaledPower,
      mpCost: finalMpCost,
      effect,
      description: moveName,
    };

    moveCache.set(moveName, skill);
    return skill;
  } catch {
    return null;
  }
}

// 포켓몬의 실제 기술 4개를 PokeAPI에서 가져옴
export async function fetchPokemonSkills(pokemonId: number): Promise<Skill[]> {
  try {
    const res = await got(`https://pokeapi.co/api/v2/pokemon/${pokemonId}`, {
      responseType: 'json',
      timeout: { request: 5000 },
    });
    const data = res.body as any;
    const allMoves: string[] = data.moves.map((m: any) => m.move.name);

    // 기술 후보를 섞어서 최대 12개 시도, 4개 확보
    const shuffled = allMoves.sort(() => Math.random() - 0.5).slice(0, 12);
    const skills: Skill[] = [];

    for (const moveName of shuffled) {
      if (skills.length >= 4) break;
      const skill = await fetchMoveData(moveName);
      if (skill && skill.power > 0) {
        skills.push(skill);
      } else if (skill && skill.effect !== 'damage' && skills.filter(s => s.effect !== 'damage').length < 1) {
        // 상태기/회복기는 최대 1개
        skills.push(skill);
      }
    }

    // 4개 미달이면 기본기로 보충
    while (skills.length < 4) {
      skills.push({
        name: '몸통박치기',
        icon: '💥',
        type: 'normal',
        power: 1.0,
        mpCost: 0,
        effect: 'damage',
        description: 'tackle',
      });
    }

    // power 오름차순 정렬 (약한 기술 → 강한 기술)
    skills.sort((a, b) => a.power - b.power);

    return skills;
  } catch {
    // API 실패 시 기본 스킬셋
    return getDefaultSkills();
  }
}

function getDefaultSkills(): Skill[] {
  return [
    { name: '몸통박치기', icon: '💥', type: 'normal', power: 1.0, mpCost: 0, effect: 'damage', description: 'tackle' },
    { name: '전광석화', icon: '⚡', type: 'normal', power: 1.5, mpCost: 5, effect: 'damage', description: 'quick-attack' },
    { name: '잡아당기기', icon: '💪', type: 'normal', power: 2.0, mpCost: 8, effect: 'damage', description: 'take-down' },
    { name: '파괴광선', icon: '💫', type: 'normal', power: 3.0, mpCost: 15, effect: 'damage', description: 'hyper-beam' },
  ];
}

// --- 배틀 포켓몬 생성 (실제 기술 포함) ---
export async function createBattlePokemon(
  pokemonId: number, name: string, koreanName: string, level: number
): Promise<BattlePokemonState> {
  const maxHp = level * 5 + 20;
  const maxMp = level * 3 + 10;
  const skills = await fetchPokemonSkills(pokemonId);
  return {
    pokemonId, name, koreanName, level,
    maxHp, hp: maxHp,
    maxMp, mp: maxMp,
    skills,
    isDefending: false,
    isBurned: false,
    isParalyzed: false,
  };
}

// --- GitHub Gist 기반 PVP ---
export interface GistTeamData {
  trainer: string;
  team: {
    pokemonId: number;
    pokemonName: string;
    level: number;
  }[];
  updatedAt: string;
}

const GIST_FILENAME = 'pokelog-battle-team.json';

// 내 배틀 팀을 Gist에 게시
export async function publishTeamToGist(teamData: GistTeamData): Promise<string> {
  const token = getConfig('github_token');
  if (!token) throw new Error('GitHub 토큰이 설정되지 않았습니다.');

  const existingGistId = getConfig('battle_gist_id');
  const content = JSON.stringify(teamData, null, 2);

  if (existingGistId) {
    // 기존 Gist 업데이트
    try {
      await got.patch(`https://api.github.com/gists/${existingGistId}`, {
        headers: {
          Authorization: `token ${token}`,
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'pokelog-cli',
        },
        json: {
          files: { [GIST_FILENAME]: { content } },
        },
        responseType: 'json',
      });
      return existingGistId;
    } catch {
      // 실패하면 새로 생성
    }
  }

  // 새 Gist 생성
  const res = await got.post('https://api.github.com/gists', {
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'pokelog-cli',
    },
    json: {
      description: 'Pokelog Battle Team',
      public: true,
      files: { [GIST_FILENAME]: { content } },
    },
    responseType: 'json',
  });

  const gist = res.body as any;
  return gist.id;
}

// GitHub 유저네임으로 상대 배틀 팀 조회
export async function fetchOpponentTeam(githubUsername: string): Promise<GistTeamData | null> {
  const token = getConfig('github_token');
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'pokelog-cli',
  };
  if (token) headers.Authorization = `token ${token}`;

  try {
    // 상대의 public gists 조회
    const res = await got(`https://api.github.com/users/${githubUsername}/gists`, {
      headers,
      searchParams: { per_page: 30 },
      responseType: 'json',
      timeout: { request: 8000 },
    });

    const gists = res.body as any[];
    const battleGist = gists.find((g) =>
      g.files && g.files[GIST_FILENAME]
    );

    if (!battleGist) return null;

    // Gist 내용 가져오기
    const fileUrl = battleGist.files[GIST_FILENAME].raw_url;
    const fileRes = await got(fileUrl, { responseType: 'json', timeout: { request: 5000 } });
    return fileRes.body as GistTeamData;
  } catch {
    return null;
  }
}

// GistTeamData → BattlePokemonState[] 변환
export async function teamDataToBattlePokemon(teamData: GistTeamData): Promise<BattlePokemonState[]> {
  const team: BattlePokemonState[] = [];
  for (const p of teamData.team) {
    const pokemon = await createBattlePokemon(p.pokemonId, p.pokemonName, p.pokemonName, p.level);
    team.push(pokemon);
  }
  return team;
}

// --- 데미지 계산 ---
export function calculateSkillDamage(attacker: BattlePokemonState, skill: Skill, defender: BattlePokemonState): number {
  const baseDamage = (attacker.level * 2 + 5) * skill.power;
  const defense = defender.level * 0.5;
  const defenseMultiplier = defender.isDefending ? 0.5 : 1.0;
  const variance = 0.85 + Math.random() * 0.3;
  const damage = Math.max(1, Math.floor((baseDamage - defense) * defenseMultiplier * variance));
  return damage;
}

export function calculateHeal(user: BattlePokemonState, skill: Skill): number {
  const healAmount = Math.floor((user.level * 2 + 10) * skill.power * 0.5);
  return Math.min(healAmount, user.maxHp - user.hp);
}

// --- AI 행동 선택 (상대 유저 시뮬레이션) ---
export function chooseAIAction(pokemon: BattlePokemonState, opponent: BattlePokemonState): { action: 'skill'; skillIndex: number } | { action: 'defend' } {
  if (pokemon.hp < pokemon.maxHp * 0.3) {
    const healIdx = pokemon.skills.findIndex((s) => (s.effect === 'heal' || s.effect === 'drain') && s.mpCost <= pokemon.mp);
    if (healIdx >= 0 && Math.random() < 0.6) {
      return { action: 'skill', skillIndex: healIdx };
    }
  }

  const usableSkills = pokemon.skills
    .map((s, i) => ({ skill: s, index: i }))
    .filter((s) => s.skill.mpCost <= pokemon.mp);

  if (usableSkills.length === 0) {
    return { action: 'defend' };
  }

  if (opponent.hp < opponent.maxHp * 0.3) {
    const strongest = usableSkills.reduce((a, b) => a.skill.power > b.skill.power ? a : b);
    return { action: 'skill', skillIndex: strongest.index };
  }

  if (Math.random() < 0.15) {
    return { action: 'defend' };
  }

  const weighted = usableSkills.map((s) => ({ ...s, weight: s.skill.power + 0.5 }));
  const totalWeight = weighted.reduce((sum, s) => sum + s.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const s of weighted) {
    roll -= s.weight;
    if (roll <= 0) return { action: 'skill', skillIndex: s.index };
  }

  return { action: 'skill', skillIndex: 0 };
}

// --- 상태이상 처리 ---
export function applyStatusEffects(pokemon: BattlePokemonState): string[] {
  const messages: string[] = [];
  if (pokemon.isBurned) {
    const burnDmg = Math.max(1, Math.floor(pokemon.maxHp * 0.06));
    pokemon.hp = Math.max(0, pokemon.hp - burnDmg);
    messages.push(`🔥 ${pokemon.koreanName}이(가) 화상으로 ${burnDmg} 데미지!`);
  }
  pokemon.mp = Math.min(pokemon.maxMp, pokemon.mp + 1);
  return messages;
}
