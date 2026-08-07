export interface BinariesStatus {
  ytdlp: boolean;
  ffmpeg: boolean;
  ffprobe: boolean;
}

export interface QueueStatus {
  busy: boolean;
  current: string | null;
  pausedError: boolean;
  pending: string[];
  pendingCount: number;
}

export interface HealthResponse {
  ok: boolean;
  service: string;
  frontend?: boolean;
  profile: string;
  binaries: BinariesStatus;
  queue?: QueueStatus;
}

export interface SingleVideoMetadata {
  valid: true;
  type: 'video';
  id: string;
  title: string;
  thumbnail: string | null;
  durationSeconds: number | null;
  width: number | null;
  height: number | null;
}

export interface PlaylistEntry {
  id: string;
  title: string;
  thumbnail: string | null;
  durationSeconds: number | null;
  url: string;
  referer?: string | null;
}

export interface PlaylistMetadata {
  valid: true;
  type: 'playlist';
  id: string;
  title: string;
  entries: PlaylistEntry[];
}

export interface InvalidMetadata {
  valid: false;
  error: string;
}

export type MetadataResponse =
  | SingleVideoMetadata
  | PlaylistMetadata
  | InvalidMetadata;

export type DownloadStage = 'item' | 'baixando' | 'convertendo' | 'finalizando';

export interface ProgressEventData {
  stage: DownloadStage;
  percent?: number | null;
  index?: number | null;
  total?: number | null;
  title?: string;
}

export interface DoneEventData {
  titles: string[];
  paths: string[];
  outputFolder: string;
  count: number;
}

export interface ErrorEventData {
  message: string;
  stack?: string;
}

export type QueueAddResponse = QueueStatus & {
  added: boolean;
  position?: number;
};

export type AppState =
  | 'idle'
  | 'loading_metadata'
  | 'ready'
  | 'queued'
  | 'downloading'
  | 'paused_error'
  | 'done'
  | 'error';
