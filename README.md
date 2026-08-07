# Baixador de videos publicos (1080p 30fps)

Automacao local com yt-dlp + ffmpeg. Link publico -> MP4 1920x1080 @ 30fps.

## Uso

1. Duplo clique em `Abrir.bat`
2. Sobe a API Python + front Vite e abre o Google Chrome em `http://127.0.0.1:5173`
3. Cole URLs publicas e baixe (um por vez; o resto fica na fila)
4. Arquivos em `%USERPROFILE%\Videos\VideoDownloader`

Codigo do front em `front/`.

Se fechar no meio, na proxima abertura a fila de URLs pendentes retoma sozinha.
Item interrompido volta para a frente da fila (recomeca aquele link).

## Anonimato (sem log / sem cache / sem historico)

- Nao grava historico do que ja baixou.
- Nao grava logs em disco.
- Nao guarda cache de metadata.
- Temporarios em `.tmp-downloads` sao limpos.
- Unico arquivo de estado: `.fila_pendente.json` com **somente URLs ainda pendentes**.
  Quando a fila esvazia, esse arquivo e apagado.

## API opcional

```bat
python server.py
```

Rotas principais: `/api/health` `/api/metadata` `/api/queue` `/api/queue/add` `/api/queue/events`

## Fixo

- So video (sem MP3)
- Sempre 1080p @ 30fps
- Sites publicos suportados pelo yt-dlp
