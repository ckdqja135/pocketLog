import chalk from 'chalk';
import inquirer from 'inquirer';
import { BattlePokemonState } from '../types/index.js';
import {
  getAllCaughtPokemon,
  getLastBattleTime,
  getBattleStats,
  addBattleLog,
  addExperience,
  addStamina,
  isPokemonOnAdventure,
  setConfig,
  getConfig,
} from '../services/database.js';
import {
  createBattlePokemon,
  calculateSkillDamage,
  calculateHeal,
  chooseAIAction,
  applyStatusEffects,
  publishTeamToGist,
  fetchOpponentTeam,
  teamDataToBattlePokemon,
  GistTeamData,
} from '../services/battle.js';
import {
  isSupabaseConfigured,
  publishBattleTeam,
  fetchBattleTeam,
  getAllBattleTeams,
  recordBattleResult,
  getPvpRecordOnline,
  syncLeaderboard,
} from '../services/supabase.js';
import { pokemonTypeColor } from '../ui/display.js';

const BATTLE_COOLDOWN_MS = 5 * 60 * 1000;

export async function battleCommand(): Promise<void> {
  console.log(chalk.yellow(`\n  ⚔️ PVP 포켓몬 배틀\n`));

  const token = getConfig('github_token');
  if (!token) {
    console.log(chalk.red('  GitHub 토큰이 필요합니다. config 명령어로 설정해주세요.'));
    return;
  }

  // 전적 표시
  const stats = getBattleStats();
  console.log(chalk.gray(`  📊 전적: ${chalk.green(`${stats.wins}승`)} ${chalk.red(`${stats.losses}패`)} ${chalk.gray(`${stats.flees}도망`)}\n`));

  // 메뉴 선택
  const { mode } = await inquirer.prompt([{
    type: 'list',
    name: 'mode',
    message: '무엇을 할까요?',
    choices: [
      { name: '⚔️  대전하기 (상대 GitHub 유저에게 도전)', value: 'challenge' },
      { name: '📋 배틀 팀 설정 (내 팀을 Gist에 게시)', value: 'setup' },
    ],
  }]);

  if (mode === 'setup') {
    await setupTeam();
  } else {
    await challengeUser();
  }
}

// --- 배틀 팀 설정 & Gist 게시 ---
async function setupTeam(): Promise<void> {
  const pokemon = getAllCaughtPokemon();
  if (pokemon.length === 0) {
    console.log(chalk.gray('  포켓몬이 없습니다. 먼저 포켓몬을 잡아주세요!'));
    return;
  }

  const available = pokemon.filter((p) => !isPokemonOnAdventure(p.id));
  if (available.length === 0) {
    console.log(chalk.gray('  모든 포켓몬이 모험 중입니다!'));
    return;
  }

  const maxSelect = Math.min(3, available.length);
  console.log(chalk.cyan(`  배틀 팀에 넣을 포켓몬을 ${maxSelect}마리까지 선택하세요.\n`));

  const selected: typeof available = [];
  for (let i = 0; i < maxSelect; i++) {
    const remaining = available.filter((p) => !selected.find((s) => s.id === p.id));
    if (remaining.length === 0) break;

    const choices = remaining.slice(0, 20).map((p) => ({
      name: `${chalk.hex(pokemonTypeColor(p.pokemon_id))(p.pokemon_name.padEnd(12))} Lv.${p.level.toString().padStart(2)}`,
      value: p,
    }));

    if (i > 0) {
      choices.push({ name: chalk.gray('선택 완료'), value: null as any });
    }

    const { pick } = await inquirer.prompt([{
      type: 'list',
      name: 'pick',
      message: `${i + 1}번째 포켓몬:`,
      choices,
    }]);

    if (!pick) break;
    selected.push(pick);
  }

  if (selected.length === 0) {
    console.log(chalk.gray('  팀 설정이 취소되었습니다.'));
    return;
  }

  // 트레이너 이름
  let trainerName = getConfig('my_username') || '';
  if (!trainerName) {
    const { name } = await inquirer.prompt([{
      type: 'input',
      name: 'name',
      message: '트레이너 이름:',
      validate: (v: string) => v.trim().length > 0 || '이름을 입력해주세요',
    }]);
    trainerName = name.trim();
    setConfig('my_username', trainerName);
  }

  const team = selected.map((p) => ({
    pokemonId: p.pokemon_id,
    pokemonName: p.pokemon_name,
    level: p.level,
  }));

  const githubUsername = getConfig('github_username') || '';

  // Supabase 우선, 실패 시 Gist 폴백
  if (isSupabaseConfigured() && githubUsername) {
    console.log(chalk.cyan('\n  📡 서버에 팀 게시 중...\n'));
    const ok = await publishBattleTeam(githubUsername, team);
    if (ok) {
      console.log(chalk.green('  ✅ 배틀 팀이 서버에 게시되었습니다!'));
      console.log(chalk.yellow(`\n  내 팀:`));
      for (const p of selected) {
        console.log(chalk.white(`    ${chalk.hex(pokemonTypeColor(p.pokemon_id))(p.pokemon_name)} Lv.${p.level}`));
      }
      console.log(chalk.gray('\n  다른 유저가 내 GitHub 유저네임으로 도전할 수 있습니다!'));
      return;
    }
    console.log(chalk.yellow('  ⚠️  서버 게시 실패. Gist로 폴백합니다.'));
  }

  // Gist 폴백
  const teamData: GistTeamData = {
    trainer: trainerName,
    team,
    updatedAt: new Date().toISOString(),
  };

  console.log(chalk.cyan('\n  📡 Gist에 팀 게시 중...\n'));

  try {
    const gistId = await publishTeamToGist(teamData);
    setConfig('battle_gist_id', gistId);
    console.log(chalk.green('  ✅ 배틀 팀이 Gist에 게시되었습니다!'));
    console.log(chalk.yellow(`\n  내 팀:`));
    for (const p of selected) {
      console.log(chalk.white(`    ${chalk.hex(pokemonTypeColor(p.pokemon_id))(p.pokemon_name)} Lv.${p.level}`));
    }
  } catch (err: any) {
    console.log(chalk.red(`  게시 실패: ${err.message}`));
  }
}

// --- 상대에게 도전 ---
async function challengeUser(): Promise<void> {
  // 쿨다운 확인
  const lastBattle = getLastBattleTime();
  if (lastBattle) {
    const lastTime = new Date(lastBattle.includes('T') ? lastBattle : lastBattle + 'Z').getTime();
    const elapsed = Date.now() - lastTime;
    if (elapsed < BATTLE_COOLDOWN_MS) {
      const remaining = Math.ceil((BATTLE_COOLDOWN_MS - elapsed) / 60000);
      console.log(chalk.gray(`  배틀 쿨다운 중... ${remaining}분 후에 다시 도전할 수 있습니다.`));
      return;
    }
  }

  const pokemon = getAllCaughtPokemon();
  if (pokemon.length === 0) {
    console.log(chalk.gray('  배틀할 포켓몬이 없습니다!'));
    return;
  }

  // Supabase: 등록된 상대 목록에서 선택 or 직접 입력
  let opponentUsername = '';
  let opponentTeamRaw: { pokemonId: number; pokemonName: string; level: number }[] = [];
  let opponentDisplayName = '';

  if (isSupabaseConfigured()) {
    const teams = await getAllBattleTeams();
    const myUsername = getConfig('github_username') || '';
    const others = teams.filter((t) => t.github_username !== myUsername);

    if (others.length > 0) {
      const { choice } = await inquirer.prompt([{
        type: 'list',
        name: 'choice',
        message: '상대를 선택하세요:',
        choices: [
          ...others.map((t) => ({
            name: `👤 ${t.github_username}  (포켓몬 ${t.team_data.length}마리)`,
            value: t.github_username,
          })),
          { name: chalk.gray('직접 입력...'), value: '__manual__' },
        ],
      }]);

      if (choice !== '__manual__') {
        opponentUsername = choice;
        const team = others.find((t) => t.github_username === choice);
        if (team) {
          opponentTeamRaw = team.team_data;
          opponentDisplayName = team.github_username;
        }
      }
    }
  }

  // Supabase에서 못 찾았으면 직접 입력 (Gist 폴백)
  if (!opponentUsername) {
    const { username } = await inquirer.prompt([{
      type: 'input',
      name: 'username',
      message: '상대 GitHub 유저네임:',
      validate: (v: string) => v.trim().length > 0 || '유저네임을 입력해주세요',
    }]);
    opponentUsername = username.trim();

    console.log(chalk.cyan(`\n  📡 ${opponentUsername}의 배틀 팀을 불러오는 중...\n`));

    // Supabase 시도
    if (isSupabaseConfigured()) {
      const sbTeam = await fetchBattleTeam(opponentUsername);
      if (sbTeam) {
        opponentTeamRaw = sbTeam.team_data;
        opponentDisplayName = sbTeam.github_username;
      }
    }

    // Supabase 실패 → Gist 폴백
    if (opponentTeamRaw.length === 0) {
      const gistData = await fetchOpponentTeam(opponentUsername);
      if (gistData) {
        opponentTeamRaw = gistData.team;
        opponentDisplayName = gistData.trainer;
      }
    }
  }

  if (opponentTeamRaw.length === 0) {
    console.log(chalk.red(`  ${opponentUsername}의 배틀 팀을 찾을 수 없습니다.`));
    console.log(chalk.gray('  상대가 battle → "배틀 팀 설정"으로 팀을 등록해야 합니다.'));
    return;
  }

  console.log(chalk.red(`  👤 ${opponentDisplayName}의 팀:`));
  for (const p of opponentTeamRaw) {
    console.log(chalk.red(`    ${p.pokemonName} Lv.${p.level}`));
  }
  console.log();

  // 내 포켓몬 선택
  const available = pokemon.filter((p) => !isPokemonOnAdventure(p.id));
  if (available.length === 0) {
    console.log(chalk.gray('  모든 포켓몬이 모험 중입니다!'));
    return;
  }

  const { myPokemonData } = await inquirer.prompt([{
    type: 'list',
    name: 'myPokemonData',
    message: '배틀에 내보낼 포켓몬:',
    choices: available.slice(0, 20).map((p) => {
      const hp = p.level * 5 + 20;
      const mp = p.level * 3 + 10;
      return {
        name: `${chalk.hex(pokemonTypeColor(p.pokemon_id))(p.pokemon_name.padEnd(12))} Lv.${p.level.toString().padStart(2)}  HP:${hp}  MP:${mp}`,
        value: p,
      };
    }),
  }]);

  // 기술 로딩
  console.log(chalk.cyan('  기술 데이터 로딩 중...\n'));
  const myFighter = await createBattlePokemon(
    myPokemonData.pokemon_id,
    myPokemonData.pokemon_name,
    myPokemonData.pokemon_name,
    myPokemonData.level
  );

  const opponentTeamGist: GistTeamData = {
    trainer: opponentDisplayName,
    team: opponentTeamRaw,
    updatedAt: '',
  };
  const opponentTeam = await teamDataToBattlePokemon(opponentTeamGist);

  const myName = getConfig('my_username') || '나';

  console.log(chalk.yellow(`  ═══ ⚔️ ${myName} VS ${opponentDisplayName} ═══\n`));
  console.log(chalk.blue(`  [나] ${myFighter.koreanName} Lv.${myFighter.level}`));
  console.log(chalk.gray(`  기술: ${myFighter.skills.map(s => s.name).join(', ')}`));
  console.log();

  let totalExpGained = 0;
  let finalResult: 'win' | 'lose' | 'flee' = 'win';

  for (let i = 0; i < opponentTeam.length; i++) {
    const enemy = opponentTeam[i];
    console.log(chalk.red(`  👤 ${opponentDisplayName}: "${enemy.koreanName}, 가랏!"`));
    console.log(chalk.gray(`  상대 기술: ${enemy.skills.map(s => s.name).join(', ')}\n`));

    const result = await runBattle(myFighter, enemy, myName, opponentDisplayName);

    if (result === 'flee') {
      finalResult = 'flee';
      console.log(chalk.gray('\n  배틀에서 도망쳤다...'));
      break;
    }
    if (result === 'lose') {
      finalResult = 'lose';
      break;
    }

    const expGain = enemy.level * 5;
    totalExpGained += expGain;
    console.log(chalk.green(`\n  ✅ ${enemy.koreanName}을(를) 쓰러뜨렸다! (EXP +${expGain})`));

    myFighter.mp = Math.min(myFighter.maxMp, myFighter.mp + Math.floor(myFighter.maxMp * 0.2));

    if (i < opponentTeam.length - 1) {
      console.log(chalk.yellow(`\n  다음 상대가 나온다...\n`));
      await delay(1000);
    }
  }

  console.log(chalk.gray('\n  ═══════════════════════════════════'));

  if (finalResult === 'win') {
    console.log(chalk.green.bold(`\n  🏆 ${opponentDisplayName}에게 승리!`));
    console.log(chalk.green(`  경험치 +${totalExpGained}, 스태미나 +2`));
    addExperience(myPokemonData.id, totalExpGained);
    addStamina(2);
  } else if (finalResult === 'lose') {
    console.log(chalk.red(`\n  💀 ${myFighter.koreanName}이(가) 쓰러졌다...`));
    console.log(chalk.gray('  다음에 다시 도전하세요!'));
  }

  const lastEnemy = opponentTeam[opponentTeam.length - 1];
  addBattleLog(
    opponentDisplayName,
    myPokemonData.pokemon_id,
    myPokemonData.pokemon_name,
    lastEnemy.pokemonId,
    lastEnemy.koreanName,
    finalResult,
    finalResult === 'win' ? totalExpGained : 0
  );

  // Supabase에 전적 기록 + 리더보드 동기화
  if (isSupabaseConfigured()) {
    const myUsername = getConfig('github_username') || '';
    await recordBattleResult({
      challenger: myUsername,
      opponent: opponentUsername,
      challenger_pokemon: myPokemonData.pokemon_name,
      opponent_pokemon: lastEnemy.koreanName,
      result: finalResult,
      exp_gained: finalResult === 'win' ? totalExpGained : 0,
    });

    const stats = getBattleStats();
    await syncLeaderboard(myUsername, {
      battleWins: stats.wins,
      battleLosses: stats.losses,
    });
  }
}

// --- 턴제 배틀 ---
async function runBattle(
  my: BattlePokemonState,
  enemy: BattlePokemonState,
  myName: string,
  enemyName: string
): Promise<'win' | 'lose' | 'flee'> {
  let turn = 1;

  while (my.hp > 0 && enemy.hp > 0) {
    console.log(chalk.gray(`  ─── 턴 ${turn} ───`));
    console.log(
      chalk.blue(`  [나] ${my.koreanName}  `) +
      `HP ${createBar(my.hp, my.maxHp, 'hp')} ${my.hp}/${my.maxHp}  ` +
      `MP ${createBar(my.mp, my.maxMp, 'mp')} ${my.mp}/${my.maxMp}`
    );
    console.log(
      chalk.red(`  [적] ${enemy.koreanName}  `) +
      `HP ${createBar(enemy.hp, enemy.maxHp, 'hp')} ${enemy.hp}/${enemy.maxHp}  ` +
      `MP ${createBar(enemy.mp, enemy.maxMp, 'mp')} ${enemy.mp}/${enemy.maxMp}`
    );

    const myStatus = [];
    if (my.isBurned) myStatus.push('🔥화상');
    if (my.isParalyzed) myStatus.push('⚡마비');
    const enemyStatus = [];
    if (enemy.isBurned) enemyStatus.push('🔥화상');
    if (enemy.isParalyzed) enemyStatus.push('⚡마비');
    if (myStatus.length > 0) console.log(chalk.yellow(`  [나] 상태: ${myStatus.join(' ')}`));
    if (enemyStatus.length > 0) console.log(chalk.yellow(`  [적] 상태: ${enemyStatus.join(' ')}`));
    console.log();

    // 마비 체크
    if (my.isParalyzed && Math.random() < 0.25) {
      console.log(chalk.yellow(`  ⚡ ${my.koreanName}은(는) 마비되어 움직일 수 없다!`));
    } else {
      // 스킬 선택
      const skillChoices = my.skills.map((s, i) => {
        const canUse = s.mpCost <= my.mp;
        const mpTag = s.mpCost > 0 ? ` (MP ${s.mpCost})` : ' (무료)';
        const effectTag = s.effect === 'heal' ? ' [회복]' :
                          s.effect === 'drain' ? ' [흡수]' :
                          s.effect === 'burn' ? ' [화상]' :
                          s.effect === 'paralyze' ? ' [마비]' : '';
        return {
          name: `${s.icon} ${s.name}${mpTag} 위력${s.power > 0 ? '★'.repeat(Math.min(5, Math.ceil(s.power))) : '-'}${effectTag}${canUse ? '' : chalk.red(' (MP 부족)')}`,
          value: canUse ? i : -1,
          disabled: !canUse ? 'MP 부족' : false,
        };
      });

      skillChoices.push({ name: '🛡️ 방어 (데미지 50% 감소 + MP 회복)', value: -2, disabled: false });
      skillChoices.push({ name: '💨 도망', value: -3, disabled: false });

      const { action } = await inquirer.prompt([{
        type: 'list',
        name: 'action',
        message: `${my.koreanName}의 행동:`,
        choices: skillChoices,
      }]);

      if (action === -3) return 'flee';

      my.isDefending = false;
      if (action === -2) {
        my.isDefending = true;
        my.mp = Math.min(my.maxMp, my.mp + 3);
        console.log(chalk.cyan(`  🛡️ ${my.koreanName}이(가) 방어 태세! (MP +3)`));
      } else {
        executeSkill(my, enemy, action);
      }
    }

    if (enemy.hp <= 0) break;

    // 상대 턴
    await delay(600);

    if (enemy.isParalyzed && Math.random() < 0.25) {
      console.log(chalk.yellow(`  ⚡ ${enemy.koreanName}은(는) 마비되어 움직일 수 없다!`));
    } else {
      const aiAction = chooseAIAction(enemy, my);
      enemy.isDefending = false;

      if (aiAction.action === 'defend') {
        enemy.isDefending = true;
        enemy.mp = Math.min(enemy.maxMp, enemy.mp + 3);
        console.log(chalk.yellow(`  🛡️ ${enemy.koreanName}이(가) 방어 태세! (MP +3)`));
      } else {
        executeSkillEnemy(enemy, my, aiAction.skillIndex);
      }
    }

    // 상태이상
    const myMsgs = applyStatusEffects(my);
    const enemyMsgs = applyStatusEffects(enemy);
    for (const msg of myMsgs) console.log(chalk.yellow(`  ${msg}`));
    for (const msg of enemyMsgs) console.log(chalk.yellow(`  ${msg}`));

    my.isDefending = false;
    enemy.isDefending = false;
    turn++;
    console.log();
  }

  return my.hp > 0 ? 'win' : 'lose';
}

function executeSkill(attacker: BattlePokemonState, defender: BattlePokemonState, skillIndex: number): void {
  const skill = attacker.skills[skillIndex];
  attacker.mp -= skill.mpCost;

  if (skill.effect === 'damage') {
    const dmg = calculateSkillDamage(attacker, skill, defender);
    defender.hp = Math.max(0, defender.hp - dmg);
    console.log(chalk.green(`  ${skill.icon} ${attacker.koreanName}의 ${chalk.bold(skill.name)}! → ${defender.koreanName}에게 ${chalk.bold(String(dmg))} 데미지!`));
  } else if (skill.effect === 'heal') {
    const heal = calculateHeal(attacker, skill);
    attacker.hp = Math.min(attacker.maxHp, attacker.hp + heal);
    console.log(chalk.green(`  ${skill.icon} ${attacker.koreanName}의 ${chalk.bold(skill.name)}! HP +${heal} 회복!`));
  } else if (skill.effect === 'drain') {
    const dmg = calculateSkillDamage(attacker, skill, defender);
    const heal = Math.floor(dmg * 0.5);
    defender.hp = Math.max(0, defender.hp - dmg);
    attacker.hp = Math.min(attacker.maxHp, attacker.hp + heal);
    console.log(chalk.green(`  ${skill.icon} ${attacker.koreanName}의 ${chalk.bold(skill.name)}! ${dmg} 데미지 + HP ${heal} 흡수!`));
  } else if (skill.effect === 'burn') {
    const dmg = calculateSkillDamage(attacker, skill, defender);
    defender.hp = Math.max(0, defender.hp - dmg);
    if (!defender.isBurned && Math.random() < 0.4) {
      defender.isBurned = true;
      console.log(chalk.green(`  ${skill.icon} ${attacker.koreanName}의 ${chalk.bold(skill.name)}! ${dmg} 데미지! ${chalk.red('🔥 화상!')}`));
    } else {
      console.log(chalk.green(`  ${skill.icon} ${attacker.koreanName}의 ${chalk.bold(skill.name)}! ${dmg} 데미지!`));
    }
  } else if (skill.effect === 'paralyze') {
    if (!defender.isParalyzed && Math.random() < 0.5) {
      defender.isParalyzed = true;
      console.log(chalk.green(`  ${skill.icon} ${attacker.koreanName}의 ${chalk.bold(skill.name)}! ${chalk.yellow('⚡ 마비!')}`));
    } else {
      console.log(chalk.yellow(`  ${skill.icon} ${attacker.koreanName}의 ${skill.name}... 효과가 없었다!`));
    }
  }
}

function executeSkillEnemy(attacker: BattlePokemonState, defender: BattlePokemonState, skillIndex: number): void {
  const skill = attacker.skills[skillIndex];
  attacker.mp -= skill.mpCost;

  if (skill.effect === 'damage') {
    const dmg = calculateSkillDamage(attacker, skill, defender);
    defender.hp = Math.max(0, defender.hp - dmg);
    console.log(chalk.red(`  ${skill.icon} ${attacker.koreanName}의 ${chalk.bold(skill.name)}! → ${defender.koreanName}에게 ${chalk.bold(String(dmg))} 데미지!`));
  } else if (skill.effect === 'heal') {
    const heal = calculateHeal(attacker, skill);
    attacker.hp = Math.min(attacker.maxHp, attacker.hp + heal);
    console.log(chalk.red(`  ${skill.icon} ${attacker.koreanName}의 ${chalk.bold(skill.name)}! HP +${heal} 회복!`));
  } else if (skill.effect === 'drain') {
    const dmg = calculateSkillDamage(attacker, skill, defender);
    const heal = Math.floor(dmg * 0.5);
    defender.hp = Math.max(0, defender.hp - dmg);
    attacker.hp = Math.min(attacker.maxHp, attacker.hp + heal);
    console.log(chalk.red(`  ${skill.icon} ${attacker.koreanName}의 ${chalk.bold(skill.name)}! ${dmg} 데미지 + HP ${heal} 흡수!`));
  } else if (skill.effect === 'burn') {
    const dmg = calculateSkillDamage(attacker, skill, defender);
    defender.hp = Math.max(0, defender.hp - dmg);
    if (!defender.isBurned && Math.random() < 0.4) {
      defender.isBurned = true;
      console.log(chalk.red(`  ${skill.icon} ${attacker.koreanName}의 ${chalk.bold(skill.name)}! ${dmg} 데미지! 🔥 화상!`));
    } else {
      console.log(chalk.red(`  ${skill.icon} ${attacker.koreanName}의 ${chalk.bold(skill.name)}! ${dmg} 데미지!`));
    }
  } else if (skill.effect === 'paralyze') {
    if (!defender.isParalyzed && Math.random() < 0.5) {
      defender.isParalyzed = true;
      console.log(chalk.red(`  ${skill.icon} ${attacker.koreanName}의 ${chalk.bold(skill.name)}! ⚡ 마비!`));
    } else {
      console.log(chalk.yellow(`  ${skill.icon} ${attacker.koreanName}의 ${skill.name}... 효과가 없었다!`));
    }
  }
}

function createBar(current: number, max: number, type: 'hp' | 'mp'): string {
  const barLength = 10;
  const ratio = current / max;
  const filled = Math.ceil(ratio * barLength);
  const empty = barLength - filled;
  let color;
  if (type === 'hp') {
    color = ratio > 0.5 ? chalk.green : ratio > 0.2 ? chalk.yellow : chalk.red;
  } else {
    color = ratio > 0.3 ? chalk.blue : chalk.gray;
  }
  return color('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
