import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { ensureDir, outputDir, sanitizeFileName, tempDir } from "./paths";

const YTDLP_BIN = process.env.YTDLP_PATH || "yt-dlp";
const FFMPEG_BIN = process.env.FFMPEG_PATH || "ffmpeg";
const FFPROBE_BIN = process.env.FFPROBE_PATH || "ffprobe";
const FIREFOX_PROFILE = process.env.FIREFOX_PROFILE_PATH;
const POT_SERVER_URL = process.env.POT_SERVER_URL || "http://127.0.0.1:4416";

const TARGET_WIDTH = 1920;
const TARGET_HEIGHT = 1080;

const YOUTUBE_URL_RE =
  /^https?:\/\/(www\.|m\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)[\w-]{6,}/i;

export function isValidYouTubeUrl(url: string): boolean {
  return YOUTUBE_URL_RE.test(url.trim());
}

/**
 * Flags de autenticacao/anti-bloqueio compartilhadas entre a checagem de
 * metadados e o download. Sem elas o YouTube costuma devolver "Sign in to
 * confirm you're not a bot" em vez do video.
 */
function authArgs(): string[] {
  const args = [
    "--remote-components",
    "ejs:github",
    "--extractor-args",
    `youtubepot-bgutilhttp:base_url=${POT_SERVER_URL}`,
  ];
  if (FIREFOX_PROFILE) {
    args.push("--cookies-from-browser", `firefox:${FIREFOX_PROFILE}`);
  }
  return args;
}

function runProcess(
  bin: string,
  args: string[],
  onStdoutLine?: (line: string) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { windowsHide: true });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk: Buffer) => {
      const text = chunk.toString("utf8");
      stdout += text;
      if (onStdoutLine) {
        for (const line of text.split(/\r?\n/)) {
          if (line.trim().length > 0) onStdoutLine(line);
        }
      }
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", (err) => reject(err));
    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(
          new Error(
            `${bin} terminou com codigo ${code}: ${stderr.slice(-800) || stdout.slice(-800)}`,
          ),
        );
      }
    });
  });
}

export interface VideoMetadata {
  id: string;
  title: string;
  thumbnail: string;
  durationSeconds: number | null;
  width: number | null;
  height: number | null;
}

export async function fetchMetadata(url: string): Promise<VideoMetadata> {
  const stdout = await runProcess(YTDLP_BIN, [
    "-J",
    "--no-playlist",
    "--skip-download",
    ...authArgs(),
    url,
  ]);
  const info = JSON.parse(stdout);
  return {
    id: info.id,
    title: info.title,
    thumbnail: info.thumbnail,
    durationSeconds:
      typeof info.duration === "number" ? info.duration : null,
    width: typeof info.width === "number" ? info.width : null,
    height: typeof info.height === "number" ? info.height : null,
  };
}

export type ProgressEvent =
  | { stage: "baixando"; percent: number }
  | { stage: "convertendo"; percent: number | null }
  | { stage: "finalizando" };

async function probeResolution(
  filePath: string,
): Promise<{ width: number; height: number }> {
  const stdout = await runProcess(FFPROBE_BIN, [
    "-v",
    "error",
    "-select_streams",
    "v:0",
    "-show_entries",
    "stream=width,height",
    "-of",
    "json",
    filePath,
  ]);
  const data = JSON.parse(stdout);
  const stream = data.streams?.[0] ?? {};
  return { width: stream.width ?? 0, height: stream.height ?? 0 };
}

const DOWNLOAD_PROGRESS_RE = /\[download\]\s+(\d{1,3}(?:\.\d+)?)%/;

/**
 * Baixa o video (no maximo 1080p; se a fonte for menor, pega a melhor
 * disponivel), garante que o resultado final fica com exatamente
 * 1920x1080 (escala + faixas pretas se a proporcao nao bater) e salva em
 * "videos baixados/<titulo>.mp4", sobrescrevendo se ja existir um arquivo
 * com o mesmo titulo.
 */
export async function downloadAndConvert(
  url: string,
  onProgress: (event: ProgressEvent) => void,
): Promise<{ finalPath: string; title: string }> {
  if (!isValidYouTubeUrl(url)) {
    throw new Error("Link do YouTube invalido.");
  }

  const workDir = tempDir();
  await ensureDir(workDir);
  await ensureDir(outputDir());

  const jobId = randomUUID();
  const rawTemplate = path.join(workDir, `${jobId}.%(ext)s`);

  const meta = await fetchMetadata(url);
  const title = sanitizeFileName(meta.title || meta.id);

  onProgress({ stage: "baixando", percent: 0 });

  await runProcess(
    YTDLP_BIN,
    [
      "-f",
      `bv*[height<=${TARGET_HEIGHT}]+ba/b[height<=${TARGET_HEIGHT}]/b`,
      "--merge-output-format",
      "mp4",
      "--no-playlist",
      "--newline",
      "-o",
      rawTemplate,
      ...authArgs(),
      url,
    ],
    (line) => {
      const match = DOWNLOAD_PROGRESS_RE.exec(line);
      if (match) {
        onProgress({ stage: "baixando", percent: Number(match[1]) });
      }
    },
  );

  const downloadedPath = path.join(workDir, `${jobId}.mp4`);
  const finalPath = path.join(outputDir(), `${title}.mp4`);

  const resolution = await probeResolution(downloadedPath);
  const alreadyExact =
    resolution.width === TARGET_WIDTH && resolution.height === TARGET_HEIGHT;

  onProgress({ stage: "convertendo", percent: alreadyExact ? 100 : null });

  // Sobrescreve o que ja existir com o mesmo titulo.
  await fs.rm(finalPath, { force: true });

  if (alreadyExact) {
    // Ja esta em 1920x1080: so remuxa (sem reprocessar video/audio).
    await runProcess(FFMPEG_BIN, [
      "-y",
      "-i",
      downloadedPath,
      "-c",
      "copy",
      finalPath,
    ]);
  } else {
    // Fora de 1920x1080 (maior ou menor): reescala mantendo a proporcao
    // original e completa com faixas pretas ate fechar exatamente
    // 1920x1080, sem distorcer a imagem.
    const scaleFilter =
      `scale=${TARGET_WIDTH}:${TARGET_HEIGHT}:force_original_aspect_ratio=decrease,` +
      `pad=${TARGET_WIDTH}:${TARGET_HEIGHT}:(ow-iw)/2:(oh-ih)/2:color=black`;
    await runProcess(FFMPEG_BIN, [
      "-y",
      "-i",
      downloadedPath,
      "-vf",
      scaleFilter,
      "-c:v",
      "libx264",
      "-preset",
      "medium",
      "-crf",
      "18",
      "-c:a",
      "aac",
      "-b:a",
      "192k",
      finalPath,
    ]);
  }

  onProgress({ stage: "finalizando" });

  await fs.rm(downloadedPath, { force: true });

  return { finalPath, title };
}
