import chalk from 'chalk';
import terminalImage from 'terminal-image';
import got from 'got';

export async function showPokemonImage(spriteUrl: string): Promise<void> {
  try {
    const response = await got(spriteUrl, { responseType: 'buffer' });
    const termWidth = process.stdout.columns || 80;
    const imageWidth = Math.floor(termWidth * 0.3);
    const rendered = await terminalImage.buffer(response.body, { width: imageWidth });
    console.log(rendered);
  } catch {
    // 이미지 출력 실패 시 무시
  }
}

export function formatTimeRemaining(expiresAt: string): string {
  // SQLite 형식 (2026-03-25 15:00:00)을 UTC로 파싱
  const utcStr = expiresAt.includes('T') ? expiresAt : expiresAt + 'Z';
  const remaining = new Date(utcStr).getTime() - Date.now();
  if (remaining <= 0) return chalk.red('만료됨');

  const minutes = Math.floor(remaining / 60000);
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours > 0) {
    return chalk.green(`${hours}시간 ${mins}분`);
  }
  if (mins > 10) {
    return chalk.yellow(`${mins}분`);
  }
  return chalk.red(`${mins}분`);
}

export function pokemonTypeColor(pokemonId: number): string {
  const colors = ['#78C850', '#F08030', '#6890F0', '#A8B820', '#A040A0',
                  '#E0C068', '#C03028', '#A890F0', '#B8A038', '#F85888',
                  '#98D8D8', '#7038F8', '#F8D030', '#705898', '#F0B0B0'];
  return colors[pokemonId % colors.length];
}
