# Front React (Vite) - Baixador 1080p

UI local que consome a API Python (`server.py`) com fila.

## Rodar

1. Na raiz do projeto: duplo clique em `Abrir.bat` (API + front + Chrome)
2. Ou manual: `python server.py` na raiz e `npm run dev` em `front/`
3. Abra `http://127.0.0.1:5173`
4. Se a API nao estiver em `8765`, ajuste a Base URL no modal de configuracoes (so nesta sessao, sem localStorage).

## Integracao

- `GET /api/health`
- `GET /api/metadata?url=`
- `GET /api/queue` / `add` / `skip` / `clear` / `continue`
- `GET /api/queue/events` (SSE)

Sem historico no navegador. Fila pendente vive no backend.
