import { NextRequest } from "next/server";
import { fetchMetadata, isValidYouTubeUrl } from "@/lib/ytdlp";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url")?.trim() ?? "";

  if (!isValidYouTubeUrl(url)) {
    return Response.json({ valid: false });
  }

  try {
    const meta = await fetchMetadata(url);
    return Response.json({ valid: true, ...meta });
  } catch (err) {
    return Response.json({
      valid: false,
      error: err instanceof Error ? err.message : "Falha ao consultar o video.",
    });
  }
}
