# Baixador de videos do YouTube

Aplicativo local com interface web para baixar videos e audios do YouTube.
Feito com Next.js, React e TypeScript.

## O que ele faz

1. Voce roda o app na sua maquina e ele abre sozinho no Google Chrome.
2. Cola o link de um video ou de uma playlist publica.
3. O app confere o link e mostra o titulo (e a lista, se for playlist).
4. Voce escolhe:
   - Video (MP4) ou so o audio (MP3)
   - Qualidade: 1080p ou 2160p (4K), so no modo video
   - Frames: 30 fps ou 60 fps, so no modo video
5. Se for playlist (ou um video dentro de uma playlist), marca todos ou so alguns.
6. Clica em Baixar.
7. Os arquivos ficam na pasta `videos baixados`, dentro da pasta do programa.
   Playlists criam uma subpasta com o nome da playlist.

Padrao: MP4 em 1080p e 60 fps.

No modo video, o resultado final e forçado para a resolucao escolhida
(1920x1080 ou 3840x2160), mantendo a proporcao e completando com faixas
pretas se precisar, sem distorcer a imagem. O FPS tambem e ajustado para
30 ou 60.

## Pre requisitos

- [Node.js](https://nodejs.org/) 20 ou mais recente.
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) instalado e disponivel no PATH.
- [FFmpeg](https://ffmpeg.org/) instalado e disponivel no PATH (inclui o
  `ffprobe`).
- [Deno](https://deno.com/) instalado e disponivel no PATH, usado pelo
  yt-dlp para resolver desafios do YouTube.
- Google Chrome instalado (a interface abre nele automaticamente).
- Git, usado apenas na primeira execucao para preparar o servidor de PO
  token descrito abaixo.

## Sobre bloqueios do YouTube

O YouTube as vezes pede para confirmar que quem esta baixando nao e um
robo. Para reduzir isso, o app sobe sozinho, na primeira execucao, uma
copia local do projeto
[bgutil-ytdlp-pot-provider](https://github.com/Brainicism/bgutil-ytdlp-pot-provider),
que gera o token usado pelo yt-dlp. Isso e feito pelo script de
inicializacao, sem precisar de conta do YouTube.

Se mesmo assim o download continuar bloqueado, copie `.env.example` para
`.env.local` e preencha `FIREFOX_PROFILE_PATH` com o caminho de um perfil
do Firefox que ja visitou o youtube.com.

## Instalacao

```bash
npm install
```

## Como rodar

```bash
npm run app
```

Esse comando prepara o servidor de PO token na primeira vez, builda a
interface se necessario, sobe tudo localmente e abre o Chrome. No Windows
tambem da para clicar duas vezes em `start.bat`.

Para desenvolvimento com recarregamento automatico:

```bash
npm run dev
```

## Estrutura do projeto

```
app/
  page.tsx                interface principal
  api/metadata/route.ts   confere o link (video ou playlist)
  api/download/route.ts   inicia o download e transmite o progresso
lib/
  ytdlp.ts                chamadas ao yt-dlp, ffmpeg e ffprobe
  paths.ts                pastas de saida e sanitizacao de nomes
scripts/
  setup-pot-server.mjs    prepara o servidor de PO token
  launch.mjs              sobe tudo e abre o Chrome
```

## Uso responsavel

Baixe apenas videos que voce tem direito de baixar, como conteudo proprio,
material com licenca aberta ou uso permitido pelos termos do video.
Respeite os direitos autorais de terceiros.

## Licenca

Distribuido sob a licenca MIT. Veja o arquivo [LICENSE](LICENSE).

## Autor

**CADUCOSILVA** - Carlos Eduardo ([@caducosilva](https://github.com/caducosilva))
Contato: abobicarlo@gmail.com

Doacoes via PIX (chave aleatoria): `f74458dc-2a36-49bd-9250-1cef4365ebb8`
