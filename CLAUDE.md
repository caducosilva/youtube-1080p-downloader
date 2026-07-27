# CLAUDE.md — youtube-1080p-downloader

Regras do projeto. Leia antes de alterar codigo ou fazer commits.

## Identidade

- Dono: Carlos Eduardo Costa Lima da Silva (Caduco, GitHub `@caducosilva`)
- E-mail git: `carlosfrenesi01@gmail.com`
- E-mail publico da marca: `abobicarlo@gmail.com`
- Repo: https://github.com/caducosilva/youtube-1080p-downloader

## Marca caducosilva

- Selo no canto inferior direito e marca d'agua CADUCOSILVA na interface.
- Contato publico e PIX de doacoes no README e no rodape da UI.
- Nao remover a marca das telas publicas deste app.

## Codigo

- Comentarios em PT-BR, so onde a logica nao e obvia.
- Identificadores (vars, funcoes, tipos) em ingles.
- Texto da interface em portugues, sem travessoes e sem emojis.
- Manter a UI simples para leigos: onde colar o link, o que escolher,
  botao Baixar e onde os arquivos ficam (`videos baixados`).
- Filtros do FFmpeg em string unica (sem concatenar pedacos). O bundler
  do Next ja removeu virgulas entre scale e pad no passado.
- Excluir `vendor/` do TypeScript (`tsconfig.json`).

## Commits e GitHub

- Autor dos commits: Carlos Eduardo Costa Lima da Silva
  `<carlosfrenesi01@gmail.com>`
- Conventional Commits com prefixo em ingles e mensagem em PT-BR
  (`feat:`, `fix:`, `docs:`, `refactor:`, `chore:`)
- Commits pequenos e focados
- NUNCA adicionar `Co-authored-by: Cursor`, `Co-authored-by: Claude`
  nem rodapes do tipo "Generated with ..."
- NUNCA commitar `.env.local`, segredos, `vendor/`, `videos baixados/`
  ou `.tmp-downloads/`

## Stack

- Next.js (App Router) + React + TypeScript + Tailwind
- yt-dlp + FFmpeg + ffprobe + Deno + servidor local de PO token

## Antes de commitar

- Conferir se o build (`npm run build`) passa
- Nao deixar segredos no diff
- Atualizar o README quando o comportamento mudar para o usuario
