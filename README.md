# Baixador de videos do YouTube em 1920x1080

Aplicativo local com interface web para baixar videos do YouTube sempre em
MP4 e exatamente na resolucao 1920x1080. Feito com Next.js, React e
TypeScript.

## Como funciona

1. Voce roda o app na sua maquina e ele abre sozinho no Google Chrome.
2. Cola o link do video.
3. O app confere se o link e valido e mostra a miniatura e o titulo.
4. Voce clica em Baixar.
5. O download comeca em segundo plano, com uma barra de progresso, e voce
   continua podendo usar a interface normalmente.
6. O video final fica salvo na pasta `videos baixados`, dentro da pasta do
   projeto.

Nao existe opcao de escolher qualidade ou resolucao. O comportamento e
sempre o mesmo, de proposito:

- Se o video original tiver resolucao acima de 1920x1080, o app baixa no
  maximo ate 1080p e ajusta para exatamente 1920x1080.
- Se o video original tiver resolucao abaixo de 1920x1080, o app baixa na
  melhor qualidade disponivel e depois converte para exatamente 1920x1080,
  mantendo a proporcao original e completando com faixas pretas quando
  necessario, sem distorcer a imagem.
- Se voce baixar de novo um video com o mesmo titulo, o arquivo novo
  substitui o antigo na pasta `videos baixados`.

## Pre requisitos

- [Node.js](https://nodejs.org/) 20 ou mais recente.
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) instalado e disponivel no PATH.
- [FFmpeg](https://ffmpeg.org/) instalado e disponivel no PATH (inclui o
  `ffprobe`, usado para checar a resolucao do video baixado).
- [Deno](https://deno.com/) instalado e disponivel no PATH, usado pelo
  yt-dlp para resolver desafios do YouTube.
- Google Chrome instalado (a interface abre nele automaticamente).
- Git, usado apenas na primeira execucao para preparar o servidor de PO
  token descrito abaixo.

## Sobre bloqueios do YouTube

O YouTube as vezes responde com uma mensagem pedindo para confirmar que
quem esta baixando nao e um robo. Para reduzir isso, o app sobe sozinho,
na primeira execucao, uma copia local do projeto
[bgutil-ytdlp-pot-provider](https://github.com/Brainicism/bgutil-ytdlp-pot-provider),
que gera o token de origem que o yt-dlp usa para se autenticar. Isso e
feito automaticamente pelo script de inicializacao, sem precisar de conta
do YouTube.

Se mesmo assim o download continuar sendo bloqueado, uma opcao extra e
apontar o app para um perfil do Firefox que ja visitou o youtube.com uma
vez. Copie o arquivo `.env.example` para `.env.local` e preencha a
variavel `FIREFOX_PROFILE_PATH` com o caminho desse perfil.

## Instalacao

```bash
npm install
```

## Como rodar

```bash
npm run app
```

Esse comando prepara o servidor de PO token na primeira vez, builda a
interface se necessario, sobe tudo localmente e abre o Chrome sozinho. No
Windows tambem da para clicar duas vezes em `start.bat`.

Para desenvolvimento com recarregamento automatico:

```bash
npm run dev
```

## Estrutura do projeto

```
app/
  page.tsx                interface principal
  api/metadata/route.ts   checa o link e devolve titulo e miniatura
  api/download/route.ts   inicia o download e transmite o progresso
lib/
  ytdlp.ts                chamadas ao yt-dlp, ffmpeg e ffprobe
  paths.ts                pastas de saida e sanitizacao de nomes de arquivo
scripts/
  setup-pot-server.mjs    prepara o servidor de PO token
  launch.mjs              sobe tudo e abre o Chrome
```

## Uso responsavel

Baixe apenas videos que voce tem direito de baixar, como conteudo proprio,
material com licenca aberta ou uso permitido pelos termos do video. Respeite
os direitos autorais de terceiros.

## Licenca

Distribuido sob a licenca MIT. Veja o arquivo [LICENSE](LICENSE).

## Autor

**CADUCOSILVA** - Carlos Eduardo ([@caducosilva](https://github.com/caducosilva))
Contato: abobicarlo@gmail.com

Doacoes via PIX (chave aleatoria): `f74458dc-2a36-49bd-9250-1cef4365ebb8`
