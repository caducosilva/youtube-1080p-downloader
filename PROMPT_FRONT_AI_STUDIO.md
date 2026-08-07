# Prompt para Google AI Studio - Frontend do baixador

Copie o bloco abaixo e cole no Google AI Studio.
No final do prompt, diga qual stack quer (ex.: `React + Vite + TypeScript`, `Flutter`, `Angular`, `Vue`, etc.).

---

## PROMPT (copiar a partir daqui)

```
Voce e um engenheiro frontend senior. Gere um frontend completo, limpo e pronto para rodar, que consome uma API local Python ja existente. NAO reimplemente o download no front. O backend faz tudo.

# Produto

App local para baixar VIDEOS PUBLICOS da internet.
Nome sugerido: "Video 1080p Downloader" ou "Baixador 1080p".

Regras de negocio FIXAS (nao criar UI para mudar isso):
- So video. Sem MP3, sem audio.
- Sempre MP4 1920x1080 @ 30fps (o backend reencode).
- Sem escolha de qualidade, fps, formato ou codec.
- Filename no disco: UUID aleatorio + .mp4
- Metadados originais removidos; backend grava metadados aleatorios.
- Pasta de saida no PC do usuario (Windows):
  Path.home() / Desktop / youtube-1080p-downloader / videos baixados
- Aceita links publicos de qualquer site suportado pelo yt-dlp.
- Albuns/playlists: backend baixa videos distintos da mesma URL.
- FILA: usuario pode adicionar varios links. So 1 download por vez.
  Os demais esperam e entram automaticamente quando o atual termina.
- Se o app/backend fechar no meio, ao reabrir a fila de URLs pendentes retoma.
  O item interrompido recomeça (nao ha resume byte-a-byte).
- ANONIMO: sem historico do que ja baixou, sem logs em disco, sem cache.
  O front NAO deve usar localStorage/sessionStorage/IndexedDB para guardar
  URLs, historico, titulos ou progresso. Estado da fila vive no backend.
  Nao gravar analytics. Cache-Control no cliente: nao persistir respostas.

# Backend (ja existe)

API HTTP local em Python (`server.py`), CORS liberado.
Base URL configuravel (padrao: http://127.0.0.1:8765).
Campo pequeno para editar a Base URL.

## Endpoints

### GET /
JSON com service, profile, queue:true, anonymous:true, endpoints.

### GET /api/health
{
  "ok": true,
  "service": "yt-dlp-video-1080p30",
  "profile": "video MP4 1920x1080 @ 30fps",
  "binaries": { "ytdlp": true, "ffmpeg": true, "ffprobe": true },
  "queue": { "busy": false, "current": null, "pausedError": false, "pending": [], "pendingCount": 0 }
}

### GET /api/metadata?url=<URL_ENCODED>
Preview opcional antes de enfileirar.
{ "valid": true, "type": "video"|"playlist", "title": "...", "thumbnail": "...", "durationSeconds": 123, "entries": [...] }
ou { "valid": false, "error": "..." }

### GET /api/queue
Estado atual da fila (fonte da verdade):
{
  "busy": true,
  "current": "https://...",
  "pausedError": false,
  "pending": ["https://a", "https://b"],
  "pendingCount": 2
}

### GET|POST /api/queue/add?url=<URL>
Enfileira. Resposta inclui added/position/pending + status da fila.
Duplicata na fila: added=false.

### GET|POST /api/queue/skip
Remove a URL da frente (pular falha / item atual).

### GET|POST /api/queue/clear
Limpa toda a fila pendente.

### GET|POST /api/queue/continue
Retoma apos pausedError.

### GET /api/queue/events
Server-Sent Events (text/event-stream). Sem persistir no cliente.

Eventos:
- event: queue   -> mesmo JSON de /api/queue
- event: progress -> { stage, percent?, index?, total?, title? }
  stages: item | baixando | convertendo | finalizando
- event: done -> { titles: [uuid...], paths: [...], outputFolder, count }
  (efemero na UI; NAO salvar historico local)
- event: error -> { message }  (fila pausa; URL continua pendente)

Keepalive: comentarios SSE ":" periodicos.

### GET /api/download?url=
Compat: enfileira a URL e abre o mesmo stream de /api/queue/events.

# UX / UI

Uma tela principal:

1. Marca / titulo do app.
2. Campo para colar URL + botao "Adicionar a fila" (e opcional "Analisar").
3. Texto fixo: "Saida: MP4 1920x1080 @ 30fps | 1 download por vez".
4. Lista da fila (pending), destacando o item atual.
5. Progresso do download atual (barra + estagio).
6. Ao concluir um item, toast/aviso efemero com UUID.mp4 (some; nao vira historico).
7. Botoes: Pular | Continuar | Limpar fila.
8. Health dos binarios + Base URL.
9. Aviso: "Fila pendente sobrevive ao fechar. Sem historico/log/cache."

Estados: idle, queued, downloading, pausedError, error de API offline.
Se API offline: "Suba o backend com python server.py".

Design:
- Coerente; evite tema roxo generico de IA.
- Tipografia com personalidade (nao Inter/Roboto/Arial default).
- Poucos elementos; mobile-friendly.
- Sem emoji.
- Textos em portugues (Brasil).

# Entregaveis

Projeto completo da stack pedida:
- Cliente API + parser SSE em modulo isolado
- Tela com fila e progresso
- README: instalar, apontar API, rodar
- Tipos para health, metadata, queue status, progress, done, error
- Sem localStorage de fila/historico
- Sem backend fake

# Stack desejada

[SUBSTITUA AQUI]
Se eu nao especificar, use React + Vite + TypeScript.

Comece pelo README e estrutura, depois o cliente de API, depois a tela com fila.
```

## Fim do prompt

---

## Como usar

1. Abra o Google AI Studio.
2. Cole o prompt.
3. Troque `[SUBSTITUA AQUI]` pela stack.
4. Backend: `python server.py` e use a porta do log no Base URL do front.
