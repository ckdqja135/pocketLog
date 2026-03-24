import chalk from 'chalk';
import {
  getTotalCommits,
  getTotalEncounters,
  getCaughtCount,
  getEscapedCount,
  getActiveEncounters,
  getCommitStreak,
  getCommitsByDay,
  getCommitsByHour,
  getCommitsByWeekday,
} from '../services/database.js';

const WEEKDAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

export async function statsCommand(): Promise<void> {
  const totalCommits = getTotalCommits();
  const totalEncounters = getTotalEncounters();
  const caughtCount = getCaughtCount();
  const escapedCount = getEscapedCount();
  const activeEncounters = getActiveEncounters().length;
  const streak = getCommitStreak();
  const catchRate = totalEncounters > 0
    ? Math.round((caughtCount / totalEncounters) * 100)
    : 0;

  console.log(chalk.yellow('\n  📊 트레이너 통계\n'));
  console.log(chalk.gray('  ─────────────────────────────────────'));
  console.log(`  ${chalk.white('총 감지된 커밋')}    ${chalk.green.bold(totalCommits.toString())}`);
  console.log(`  ${chalk.white('총 조우 횟수')}      ${chalk.green.bold(totalEncounters.toString())}`);
  console.log(`  ${chalk.white('포획한 포켓몬')}     ${chalk.green.bold(caughtCount.toString())}`);
  console.log(`  ${chalk.white('도망간 포켓몬')}     ${chalk.red.bold(escapedCount.toString())}`);
  console.log(`  ${chalk.white('현재 대기 중')}      ${chalk.yellow.bold(activeEncounters.toString())}`);
  console.log(`  ${chalk.white('포획률')}            ${chalk.cyan.bold(catchRate + '%')}`);
  console.log(`  ${chalk.white('연속 커밋')}         ${chalk.hex('#FF6D00').bold(streak + '일')} 🔥`);
  console.log(chalk.gray('  ─────────────────────────────────────'));

  // 최근 7일 커밋 히트맵
  const byDay = getCommitsByDay();
  if (byDay.length > 0) {
    console.log(chalk.yellow('\n  📅 최근 커밋 (일별)\n'));

    const last7 = byDay.slice(0, 7).reverse();
    const maxCount = Math.max(...last7.map((d) => d.count), 1);

    for (const day of last7) {
      const date = day.day.slice(5); // MM-DD
      const barLen = Math.max(1, Math.round((day.count / maxCount) * 20));
      const intensity = day.count / maxCount;
      const barColor = intensity > 0.7 ? chalk.green : intensity > 0.3 ? chalk.yellow : chalk.gray;
      console.log(
        `  ${chalk.gray(date)}  ${barColor('█'.repeat(barLen))} ${chalk.white(day.count.toString())}`
      );
    }
  }

  // 시간대별 활동
  const byHour = getCommitsByHour();
  if (byHour.length > 0) {
    console.log(chalk.yellow('\n  ⏰ 시간대별 활동\n'));

    const hourMap = new Map(byHour.map((h) => [h.hour, h.count]));
    const maxHourCount = Math.max(...byHour.map((h) => h.count), 1);

    // 6시간 단위로 묶어서 표시
    const blocks = [
      { label: '새벽 (00-05)', hours: [0,1,2,3,4,5] },
      { label: '오전 (06-11)', hours: [6,7,8,9,10,11] },
      { label: '오후 (12-17)', hours: [12,13,14,15,16,17] },
      { label: '저녁 (18-23)', hours: [18,19,20,21,22,23] },
    ];

    for (const block of blocks) {
      const total = block.hours.reduce((sum, h) => sum + (hourMap.get(h) || 0), 0);
      const barLen = Math.max(0, Math.round((total / maxHourCount) * 10));
      const bar = total > 0 ? chalk.cyan('█'.repeat(barLen)) : '';
      console.log(`  ${chalk.gray(block.label.padEnd(14))} ${bar} ${chalk.white(total.toString())}`);
    }
  }

  // 요일별 활동
  const byWeekday = getCommitsByWeekday();
  if (byWeekday.length > 0) {
    console.log(chalk.yellow('\n  📆 요일별 활동\n'));

    const wdMap = new Map(byWeekday.map((w) => [w.weekday, w.count]));
    const maxWd = Math.max(...byWeekday.map((w) => w.count), 1);

    for (let i = 0; i < 7; i++) {
      const count = wdMap.get(i) || 0;
      const barLen = Math.max(0, Math.round((count / maxWd) * 15));
      const bar = count > 0 ? chalk.green('█'.repeat(barLen)) : '';
      console.log(`  ${chalk.gray(WEEKDAY_NAMES[i])}  ${bar} ${chalk.white(count.toString())}`);
    }
  }

  console.log();
}
