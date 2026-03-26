import chalk from 'chalk';
import got from 'got';
import sharp from 'sharp';

const PIXEL = '\u2584';

async function renderImage(buffer: Buffer, targetWidth: number): Promise<string> {
  // sharp Lanczos3로 고품질 리사이즈
  const meta = await sharp(buffer).metadata();
  const origW = meta.width || 475;
  const origH = meta.height || 475;
  const ratio = origW / origH;
  const width = targetWidth;
  const height = Math.round(width / ratio);
  // 짝수로 맞춤 (반블록 렌더링)
  const finalHeight = height % 2 === 0 ? height : height + 1;

  const { data, info } = await sharp(buffer)
    .resize(width, finalHeight, { kernel: sharp.kernel.lanczos3 })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const channels = info.channels; // 4 (RGBA)

  let result = '';
  for (let y = 0; y < finalHeight - 1; y += 2) {
    for (let x = 0; x < width; x++) {
      const topIdx = (y * width + x) * channels;
      const bottomIdx = ((y + 1) * width + x) * channels;

      const tr = data[topIdx], tg = data[topIdx + 1], tb = data[topIdx + 2], ta = data[topIdx + 3];
      const br = data[bottomIdx], bg = data[bottomIdx + 1], bb = data[bottomIdx + 2], ba = data[bottomIdx + 3];

      const topVisible = ta > 180;
      const bottomVisible = ba > 180;

      if (!topVisible && !bottomVisible) {
        result += ' ';
      } else if (!topVisible) {
        result += chalk.rgb(br, bg, bb)(PIXEL);
      } else if (!bottomVisible) {
        result += chalk.bgRgb(tr, tg, tb)(' ');
      } else {
        result += chalk.bgRgb(tr, tg, tb).rgb(br, bg, bb)(PIXEL);
      }
    }
    result += '\n';
  }
  return result;
}

export async function showPokemonImage(spriteUrl: string): Promise<void> {
  try {
    const response = await got(spriteUrl, { responseType: 'buffer' });
    const termWidth = process.stdout.columns || 80;
    const imageWidth = Math.floor(termWidth * 0.45);
    const rendered = await renderImage(response.body, imageWidth);
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
