import {
  DoneEventData,
  ErrorEventData,
  HealthResponse,
  MetadataResponse,
  ProgressEventData,
  QueueAddResponse,
  QueueStatus,
} from '../types';

export const DEFAULT_BASE_URL =
  (typeof import.meta !== 'undefined' &&
    (import.meta as { env?: { VITE_DEFAULT_API_URL?: string } }).env
      ?.VITE_DEFAULT_API_URL) ||
  'http://127.0.0.1:8765';

export function sanitizeBaseUrl(url: string): string {
  let cleaned = url.trim();
  if (cleaned.endsWith('/')) {
    cleaned = cleaned.slice(0, -1);
  }
  return cleaned || DEFAULT_BASE_URL;
}

export async function checkHealth(baseUrl: string): Promise<HealthResponse> {
  const cleanUrl = sanitizeBaseUrl(baseUrl);
  const response = await fetch(`${cleanUrl}/api/health`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error(`Servidor respondeu com status ${response.status}`);
  }
  return response.json();
}

export async function fetchMetadata(
  baseUrl: string,
  targetUrl: string
): Promise<MetadataResponse> {
  const cleanUrl = sanitizeBaseUrl(baseUrl);
  const encoded = encodeURIComponent(targetUrl.trim());
  const response = await fetch(`${cleanUrl}/api/metadata?url=${encoded}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error(`Erro ao obter metadados (status HTTP ${response.status})`);
  }
  return response.json();
}

export async function fetchQueue(baseUrl: string): Promise<QueueStatus> {
  const cleanUrl = sanitizeBaseUrl(baseUrl);
  const response = await fetch(`${cleanUrl}/api/queue`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error(`Erro ao ler fila (status ${response.status})`);
  }
  return response.json();
}

export async function addToQueue(
  baseUrl: string,
  targetUrl: string,
  ids?: string[]
): Promise<QueueAddResponse> {
  const cleanUrl = sanitizeBaseUrl(baseUrl);
  const encoded = encodeURIComponent(targetUrl.trim());
  const idsParam = ids && ids.length ? `&ids=${encodeURIComponent(ids.join(','))}` : '';
  const response = await fetch(`${cleanUrl}/api/queue/add?url=${encoded}${idsParam}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(
      (body as { error?: string }).error ||
        `Erro ao enfileirar (status ${response.status})`
    );
  }
  return response.json();
}

export async function skipQueueItem(baseUrl: string): Promise<QueueStatus> {
  const cleanUrl = sanitizeBaseUrl(baseUrl);
  const response = await fetch(`${cleanUrl}/api/queue/skip`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error(`Erro ao pular item (status ${response.status})`);
  }
  return response.json();
}

export async function clearQueue(baseUrl: string): Promise<QueueStatus> {
  const cleanUrl = sanitizeBaseUrl(baseUrl);
  const response = await fetch(`${cleanUrl}/api/queue/clear`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error(`Erro ao limpar fila (status ${response.status})`);
  }
  return response.json();
}

export async function continueQueue(baseUrl: string): Promise<QueueStatus> {
  const cleanUrl = sanitizeBaseUrl(baseUrl);
  const response = await fetch(`${cleanUrl}/api/queue/continue`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error(`Erro ao continuar fila (status ${response.status})`);
  }
  return response.json();
}

export interface StreamController {
  abort: () => void;
}

export interface QueueStreamOptions {
  baseUrl: string;
  onQueue: (data: QueueStatus) => void;
  onProgress: (data: ProgressEventData) => void;
  onDone: (data: DoneEventData) => void;
  onError: (data: ErrorEventData) => void;
}

/**
 * SSE da fila. Mantem conexao aberta. Estado vive no backend (sem cache no front).
 */
export function subscribeQueueEvents(options: QueueStreamOptions): StreamController {
  const { baseUrl, onQueue, onProgress, onDone, onError } = options;
  const cleanUrl = sanitizeBaseUrl(baseUrl);
  const eventSource = new EventSource(`${cleanUrl}/api/queue/events`);

  eventSource.addEventListener('queue', (event: MessageEvent) => {
    try {
      onQueue(JSON.parse(event.data) as QueueStatus);
    } catch {
      /* ignore parse */
    }
  });

  eventSource.addEventListener('progress', (event: MessageEvent) => {
    try {
      onProgress(JSON.parse(event.data) as ProgressEventData);
    } catch {
      /* ignore */
    }
  });

  eventSource.addEventListener('done', (event: MessageEvent) => {
    try {
      onDone(JSON.parse(event.data) as DoneEventData);
    } catch {
      /* ignore */
    }
  });

  eventSource.addEventListener('error', (event: Event) => {
    // Evento SSE nomeado "error" (com data) vs falha de conexao do EventSource.
    const msgEvent = event as MessageEvent;
    if (typeof msgEvent.data === 'string' && msgEvent.data.length > 0) {
      try {
        onError(JSON.parse(msgEvent.data) as ErrorEventData);
      } catch {
        onError({ message: 'Erro na fila.' });
      }
      return;
    }
    // Reconexao automatica do EventSource: nao tratar como falha de download.
    if (eventSource.readyState === EventSource.CLOSED) {
      onError({ message: 'Conexao com a fila encerrada. Verifique o server.py.' });
    }
  });

  return {
    abort: () => eventSource.close(),
  };
}
