import fs from "node:fs/promises";
import path from "node:path";

const OUTPUT_DIR_NAME = "videos baixados";
const TEMP_DIR_NAME = ".tmp-downloads";

export function outputDir(): string {
  return path.join(process.cwd(), OUTPUT_DIR_NAME);
}

export function tempDir(): string {
  return path.join(process.cwd(), TEMP_DIR_NAME);
}

export async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

/**
 * Remove caracteres invalidos em nomes de arquivo no Windows e aparara
 * espacos nas pontas, pra usar o titulo do video como nome do arquivo.
 */
export function sanitizeFileName(name: string): string {
  const cleaned = name
    .replace(/[\\/:*?"<>|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.length > 0 ? cleaned.slice(0, 150) : "video";
}
