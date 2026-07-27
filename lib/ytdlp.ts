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

export type MediaKind = "video" | "audio";
export type VideoHeight = 1080 | 2160;
export type VideoFps = 30 | 60;

export interface DownloadOptions {
  media: MediaKind;
  height: VideoHeight;
  fps: VideoFps;
  /** Quando a origem e playlist, baixa so estes IDs. Vazio = todos. */
  videoIds?: string[];
}

export interface PlaylistEntry {
  id: string;
  title: string;
  thumbnail: string;
  durationSeconds: number | null;
  url: string;
}

export interface VideoMetadata {
  type: "video";
  id: string;
  title: string;
  thumbnail: string;
  durationSeconds: number | null;
  width: number | null;
  height: number | null;
  /** Se o link trouxe list=, a playlist associada (para o usuario escolher). */
  playlist?: {
    id: string;
    title: string;
    entries: PlaylistEntry[];
  };
}

export interface PlaylistMetadata {
  type: "playlist";
  id: string;
  title: string;
  entries: PlaylistEntry[];
}

export type UrlMetadata = VideoMetadata | PlaylistMetadata;

const VIDEO_URL_RE =
  /^https?:\/\/(www\.|m\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)[\w-]{6,}/i;
const PLAYLIST_URL_RE =
  /^https?:\/\/(www\.|m\.)?youtube\.com\/playlist\?list=[\w-]+/i;

export function isValidYouTubeUrl(url: string): boolean {
  const trimmed = url.trim();
  return VIDEO_URL_RE.test(trimmed) || PLAYLIST_URL_RE.test(trimmed);
}

export function parseDownloadOptions(params: {
  media?: string | null;
  height?: string | null;
  fps?: string | null;
  ids?: string | null;
}): DownloadOptions {
  const media: MediaKind = params.media === "audio" ? "audio" : "video";
  const height: VideoHeight = params.height === "2160" ? 2160 : 1080;
  const fps: VideoFps = params.fps === "30" ? 30 : 60;
  const videoIds = (params.ids ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter((id) => id.length > 0);
  return { media, height, fps, videoIds };
}

function targetSize(height: VideoHeight): { width: number; height: number } {
  if (height === 2160) return { width: 3840, height: 2160 };
  return { width: 1920, height: 1080 };
}

/**
 * Filtros scale+pad em string unica: o bundler do Next ja removeu a virgula
 * quando o filtro era montado por concatenacao de template strings.
 */
function scalePadFilter(width: number, height: number): string {
  if (width === 3840 && height === 2160) {
    return "scale=3840:2160:force_original_aspect_ratio=decrease,pad=3840:2160:(ow-iw)/2:(oh-ih)/2:color=black";
  }
  return "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black";
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

function entryFromInfo(info: Record<string, unknown>): PlaylistEntry | null {
  const id = typeof info.id === "string" ? info.id : null;
  if (!id) return null;
  const title =
    typeof info.title === "string" && info.title.trim().length > 0
      ? info.title
      : id;
  const thumbnail =
    typeof info.thumbnail === "string"
      ? info.thumbnail
      : typeof info.thumbnails === "object" &&
          Array.isArray(info.thumbnails) &&
          info.thumbnails.length > 0
        ? String(
            (info.thumbnails[info.thumbnails.length - 1] as { url?: string })
              .url ?? "",
          )
        : "";
  return {
    id,
    title,
    thumbnail,
    durationSeconds: typeof info.duration === "number" ? info.duration : null,
    url: `https://www.youtube.com/watch?v=${id}`,
  };
}

function hasListParam(url: string): boolean {
  try {
    const parsed = new URL(url);
    return Boolean(parsed.searchParams.get("list"));
  } catch {
    return /[?&]list=/.test(url);
  }
}

async function fetchPlaylistEntries(url: string): Promise<{
  id: string;
  title: string;
  entries: PlaylistEntry[];
}> {
  const stdout = await runProcess(YTDLP_BIN, [
    "-J",
    "--flat-playlist",
    "--skip-download",
    ...authArgs(),
    url,
  ]);
  const info = JSON.parse(stdout);
  const rawEntries: unknown[] = Array.isArray(info.entries) ? info.entries : [];
  const entries: PlaylistEntry[] = [];
  for (const raw of rawEntries) {
    if (!raw || typeof raw !== "object") continue;
    const entry = entryFromInfo(raw as Record<string, unknown>);
    if (entry) entries.push(entry);
  }
  return {
    id: typeof info.id === "string" ? info.id : "playlist",
    title:
      typeof info.title === "string" && info.title.trim().length > 0
        ? info.title
        : "playlist",
    entries,
  };
}

export async function fetchMetadata(url: string): Promise<UrlMetadata> {
  const trimmed = url.trim();
  if (!isValidYouTubeUrl(trimmed)) {
    throw new Error("Link do YouTube invalido.");
  }

  if (PLAYLIST_URL_RE.test(trimmed)) {
    const playlist = await fetchPlaylistEntries(trimmed);
    return {
      type: "playlist",
      id: playlist.id,
      title: playlist.title,
      entries: playlist.entries,
    };
  }

  // Video (pode vir com list=). Sempre consulta o video sozinho primeiro.
  const stdout = await runProcess(YTDLP_BIN, [
    "-J",
    "--no-playlist",
    "--skip-download",
    ...authArgs(),
    trimmed,
  ]);
  const info = JSON.parse(stdout);
  const video: VideoMetadata = {
    type: "video",
    id: info.id,
    title: info.title,
    thumbnail: info.thumbnail,
    durationSeconds: typeof info.duration === "number" ? info.duration : null,
    width: typeof info.width === "number" ? info.width : null,
    height: typeof info.height === "number" ? info.height : null,
  };

  if (hasListParam(trimmed)) {
    try {
      const playlist = await fetchPlaylistEntries(trimmed);
      if (playlist.entries.length > 0) {
        video.playlist = playlist;
      }
    } catch {
      // Playlist inacessivel: segue como video unico.
    }
  }

  return video;
}

export type ProgressEvent =
  | {
      stage: "item";
      index: number;
      total: number;
      title: string;
    }
  | { stage: "baixando"; percent: number; index?: number; total?: number }
  | {
      stage: "convertendo";
      percent: number | null;
      index?: number;
      total?: number;
    }
  | { stage: "finalizando"; index?: number; total?: number };

async function probeVideo(
  filePath: string,
): Promise<{ width: number; height: number; fps: number | null }> {
  const stdout = await runProcess(FFPROBE_BIN, [
    "-v",
    "error",
    "-select_streams",
    "v:0",
    "-show_entries",
    "stream=width,height,r_frame_rate",
    "-of",
    "json",
    filePath,
  ]);
  const data = JSON.parse(stdout);
  const stream = data.streams?.[0] ?? {};
  let fps: number | null = null;
  if (typeof stream.r_frame_rate === "string" && stream.r_frame_rate.includes("/")) {
    const [num, den] = stream.r_frame_rate.split("/").map(Number);
    if (den) fps = num / den;
  }
  return {
    width: stream.width ?? 0,
    height: stream.height ?? 0,
    fps,
  };
}

const DOWNLOAD_PROGRESS_RE = /\[download\]\s+(\d{1,3}(?:\.\d+)?)%/;

function videoWatchUrl(id: string): string {
  return `https://www.youtube.com/watch?v=${id}`;
}

async function resolveJobs(
  url: string,
  options: DownloadOptions,
): Promise<{
  jobs: Array<{ id: string; title: string; url: string }>;
  playlistTitle: string | null;
}> {
  const meta = await fetchMetadata(url);

  if (meta.type === "playlist") {
    const selected =
      options.videoIds && options.videoIds.length > 0
        ? meta.entries.filter((e) => options.videoIds!.includes(e.id))
        : meta.entries;
    if (selected.length === 0) {
      throw new Error("Nenhum video selecionado na playlist.");
    }
    return {
      playlistTitle: meta.title,
      jobs: selected.map((e) => ({
        id: e.id,
        title: e.title,
        url: e.url,
      })),
    };
  }

  // Video com playlist associada e ids selecionados: baixa a selecao.
  if (
    meta.playlist &&
    options.videoIds &&
    options.videoIds.length > 0
  ) {
    const selected = meta.playlist.entries.filter((e) =>
      options.videoIds!.includes(e.id),
    );
    if (selected.length === 0) {
      throw new Error("Nenhum video selecionado na playlist.");
    }
    return {
      playlistTitle: meta.playlist.title,
      jobs: selected.map((e) => ({
        id: e.id,
        title: e.title,
        url: e.url,
      })),
    };
  }

  return {
    playlistTitle: null,
    jobs: [
      {
        id: meta.id,
        title: meta.title,
        url: videoWatchUrl(meta.id),
      },
    ],
  };
}

async function downloadAudioMp3(
  url: string,
  finalPath: string,
  onProgress: (event: ProgressEvent) => void,
  index: number,
  total: number,
): Promise<void> {
  const workDir = tempDir();
  const jobId = randomUUID();
  const rawTemplate = path.join(workDir, `${jobId}.%(ext)s`);

  onProgress({ stage: "baixando", percent: 0, index, total });

  await runProcess(
    YTDLP_BIN,
    [
      "-x",
      "--audio-format",
      "mp3",
      "--audio-quality",
      "192K",
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
        onProgress({
          stage: "baixando",
          percent: Number(match[1]),
          index,
          total,
        });
      }
    },
  );

  const downloadedPath = path.join(workDir, `${jobId}.mp3`);
  onProgress({ stage: "finalizando", index, total });
  await fs.rm(finalPath, { force: true });
  await fs.rename(downloadedPath, finalPath).catch(async () => {
    await fs.copyFile(downloadedPath, finalPath);
    await fs.rm(downloadedPath, { force: true });
  });
}

async function downloadVideoMp4(
  url: string,
  finalPath: string,
  options: DownloadOptions,
  onProgress: (event: ProgressEvent) => void,
  index: number,
  total: number,
): Promise<void> {
  const workDir = tempDir();
  const jobId = randomUUID();
  const rawTemplate = path.join(workDir, `${jobId}.%(ext)s`);
  const { width, height } = targetSize(options.height);

  onProgress({ stage: "baixando", percent: 0, index, total });

  // Prefere fps ate o escolhido; se nao houver, cai na melhor altura disponivel.
  const format = [
    `bv*[height<=${options.height}][fps<=${options.fps}]+ba`,
    `bv*[height<=${options.height}]+ba`,
    `b[height<=${options.height}]`,
    "b",
  ].join("/");

  await runProcess(
    YTDLP_BIN,
    [
      "-f",
      format,
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
        onProgress({
          stage: "baixando",
          percent: Number(match[1]),
          index,
          total,
        });
      }
    },
  );

  const downloadedPath = path.join(workDir, `${jobId}.mp4`);
  const probe = await probeVideo(downloadedPath);
  const fpsClose =
    probe.fps != null && Math.abs(probe.fps - options.fps) < 0.5;
  const alreadyExact =
    probe.width === width && probe.height === height && fpsClose;

  onProgress({
    stage: "convertendo",
    percent: alreadyExact ? 100 : null,
    index,
    total,
  });

  await fs.rm(finalPath, { force: true });

  if (alreadyExact) {
    await runProcess(FFMPEG_BIN, [
      "-y",
      "-i",
      downloadedPath,
      "-c",
      "copy",
      finalPath,
    ]);
  } else {
    await runProcess(FFMPEG_BIN, [
      "-y",
      "-i",
      downloadedPath,
      "-vf",
      scalePadFilter(width, height),
      "-r",
      String(options.fps),
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

  onProgress({ stage: "finalizando", index, total });
  await fs.rm(downloadedPath, { force: true });
}

/**
 * Baixa um ou varios videos (playlist) em MP4 (resolucao e fps forçados)
 * ou MP3, salvando em "videos baixados" (subpasta se for playlist).
 */
export async function downloadAndConvert(
  url: string,
  options: DownloadOptions,
  onProgress: (event: ProgressEvent) => void,
): Promise<{ finalPaths: string[]; titles: string[]; outputFolder: string }> {
  if (!isValidYouTubeUrl(url)) {
    throw new Error("Link do YouTube invalido.");
  }

  await ensureDir(tempDir());
  await ensureDir(outputDir());

  const { jobs, playlistTitle } = await resolveJobs(url, options);
  const folder = playlistTitle
    ? path.join(outputDir(), sanitizeFileName(playlistTitle))
    : outputDir();
  await ensureDir(folder);

  const finalPaths: string[] = [];
  const titles: string[] = [];
  const total = jobs.length;
  const ext = options.media === "audio" ? "mp3" : "mp4";

  for (let i = 0; i < jobs.length; i++) {
    const job = jobs[i];
    const title = sanitizeFileName(job.title || job.id);
    const finalPath = path.join(folder, `${title}.${ext}`);

    onProgress({
      stage: "item",
      index: i + 1,
      total,
      title,
    });

    if (options.media === "audio") {
      await downloadAudioMp3(job.url, finalPath, onProgress, i + 1, total);
    } else {
      await downloadVideoMp4(
        job.url,
        finalPath,
        options,
        onProgress,
        i + 1,
        total,
      );
    }

    finalPaths.push(finalPath);
    titles.push(title);
  }

  return { finalPaths, titles, outputFolder: folder };
}
