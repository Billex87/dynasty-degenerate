import fs from 'node:fs';
import path from 'node:path';

export async function readArchiveHeader(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`Archive not found: ${filePath}`);
  const marker = '"players": [';
  let buffer = '';
  const stream = fs.createReadStream(filePath, { encoding: 'utf8', highWaterMark: 1024 * 256 });

  for await (const chunk of stream) {
    buffer += chunk;
    const markerIndex = buffer.indexOf(marker);
    if (markerIndex === -1) continue;

    stream.destroy();
    let header = buffer.slice(0, markerIndex).trimEnd();
    if (header.endsWith(',')) header = header.slice(0, -1);
    return JSON.parse(`${header}\n}`);
  }

  throw new Error(`Archive is missing players array: ${filePath}`);
}

export async function* streamArchivePlayers(filePath) {
  const marker = '"players": [';
  const stream = fs.createReadStream(filePath, { encoding: 'utf8', highWaterMark: 1024 * 1024 });
  let waitingForPlayers = true;
  let markerBuffer = '';
  let objectBuffer = '';
  let depth = 0;
  let inString = false;
  let escaped = false;
  let collecting = false;

  for await (const chunk of stream) {
    let text = chunk;
    if (waitingForPlayers) {
      markerBuffer += chunk;
      const markerIndex = markerBuffer.indexOf(marker);
      if (markerIndex === -1) {
        markerBuffer = markerBuffer.slice(-Math.max(marker.length, 1024));
        continue;
      }
      text = markerBuffer.slice(markerIndex + marker.length);
      markerBuffer = '';
      waitingForPlayers = false;
    }

    for (const char of text) {
      if (!collecting) {
        if (char === '{') {
          collecting = true;
          depth = 1;
          objectBuffer = char;
          inString = false;
          escaped = false;
        }
        continue;
      }

      objectBuffer += char;

      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === '\\') {
        escaped = true;
        continue;
      }
      if (char === '"') {
        inString = !inString;
        continue;
      }
      if (inString) continue;
      if (char === '{') depth += 1;
      if (char === '}') depth -= 1;

      if (depth === 0) {
        yield JSON.parse(objectBuffer);
        objectBuffer = '';
        collecting = false;
      }
    }
  }
}

export async function writeArchive(outputPath, header, players) {
  await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });
  const stream = fs.createWriteStream(outputPath, { encoding: 'utf8' });
  const write = (chunk) => new Promise((resolve, reject) => {
    stream.write(chunk, (error) => (error ? reject(error) : resolve()));
  });

  const archiveHeader = { ...header };
  delete archiveHeader.players;

  await write('{\n');
  const entries = Object.entries(archiveHeader);
  for (let index = 0; index < entries.length; index += 1) {
    const [key, value] = entries[index];
    await write(`  ${JSON.stringify(key)}: ${JSON.stringify(value, null, 2).replace(/\n/g, '\n  ')},\n`);
  }
  await write('  "players": [\n');
  let index = 0;
  for await (const player of players) {
    await write(`${index ? ',\n' : ''}${JSON.stringify(player, null, 2).split('\n').map((line) => `    ${line}`).join('\n')}`);
    index += 1;
  }
  await write('\n  ]\n}\n');

  await new Promise((resolve, reject) => {
    stream.end((error) => (error ? reject(error) : resolve()));
  });
}
