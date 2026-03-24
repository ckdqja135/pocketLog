import chalk from 'chalk';
import figlet from 'figlet';
import terminalImage from 'terminal-image';
import got from 'got';

const HO_OH_URL = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/250.png';

function centerText(text: string, termWidth: number): string {
  return text
    .split('\n')
    .map((line) => {
      const stripped = line.replace(/\u001b\[[0-9;]*m/g, '');
      const padding = Math.max(0, Math.floor((termWidth - stripped.length) / 2));
      return ' '.repeat(padding) + line;
    })
    .join('\n');
}

export async function showBanner(): Promise<void> {
  const termWidth = process.stdout.columns || 80;

  // 1) Ho-Oh 이미지 출력
  try {
    const response = await got(HO_OH_URL, { responseType: 'buffer' });
    const imageWidth = Math.floor(termWidth * 0.4);
    const rendered = await terminalImage.buffer(response.body, { width: imageWidth });
    console.log(centerText(rendered, termWidth));
  } catch {
    console.log(centerText(chalk.hex('#F5B800')('🔥 Ho-Oh 🔥'), termWidth));
  }

  // 2) figlet POKELOG 텍스트
  try {
    const figletText = figlet.textSync('POKELOG', { font: 'Big' });
    const colored = chalk.hex('#F5B800')(figletText);
    console.log(centerText(colored, termWidth));
  } catch {
    console.log(centerText(chalk.hex('#F5B800').bold('P O K E L O G'), termWidth));
  }

  console.log();

  // 3) 안내 문구
  console.log(centerText(chalk.gray('help를 입력하면 명령어 목록을 볼 수 있습니다.'), termWidth));
  console.log();
}

export function getPrompt(): string {
  return chalk.hex('#4FC3F7')('pokelog> ');
}
