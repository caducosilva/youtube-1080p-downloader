import { NextRequest } from "next/server";
import { downloadAndConvert, isValidYouTubeUrl } from "@/lib/ytdlp";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url")?.trim() ?? "";

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
        const result = await downloadAndConvert(url, (progress) => {
          send("progress", progress);
        });
        send("done", { title: result.title, path: result.finalPath });
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
