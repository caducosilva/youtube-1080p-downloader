import { NextRequest } from "next/server";
import {
  downloadAndConvert,
  isValidYouTubeUrl,
  parseDownloadOptions,
} from "@/lib/ytdlp";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url")?.trim() ?? "";
  const options = parseDownloadOptions({
    media: request.nextUrl.searchParams.get("media"),
    height: request.nextUrl.searchParams.get("height"),
    fps: request.nextUrl.searchParams.get("fps"),
    ids: request.nextUrl.searchParams.get("ids"),
  });

  if (!isValidYouTubeUrl(url)) {
    return Response.json({ error: "Link do YouTube invalido." }, { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const send = (event: string, data: unknown) => {
        if (closed) return;
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };

      try {
        const result = await downloadAndConvert(url, options, (progress) => {
          send("progress", progress);
        });
        send("done", {
          titles: result.titles,
          paths: result.finalPaths,
          outputFolder: result.outputFolder,
          count: result.titles.length,
        });
      } catch (err) {
        send("error", {
          message: err instanceof Error ? err.message : "Falha no download.",
        });
      } finally {
        closed = true;
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
