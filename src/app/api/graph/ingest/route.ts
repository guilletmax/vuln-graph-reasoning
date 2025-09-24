import { type NextRequest, NextResponse } from "next/server";
import "@/lib/utils/load-env";
import { ingestFindings } from "@/lib/graph/ingest-findings";
import { shutdownNeo4jDriver } from "@/lib/graph/neo4j-client";
import type { FindingRecord } from "@/lib/models/finding";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        {
          error:
            "Missing findings upload. Expecting a file field named 'file'.",
        },
        { status: 400 },
      );
    }

    const raw = await file.text();

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (_error) {
      return NextResponse.json(
        { error: "Uploaded file is not valid JSON." },
        { status: 400 },
      );
    }

    if (!Array.isArray(parsed)) {
      return NextResponse.json(
        { error: "Expected findings JSON array." },
        { status: 400 },
      );
    }

    const result = await ingestFindings(parsed as FindingRecord[]);

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error("Graph ingestion API failed", error);
    await shutdownNeo4jDriver().catch(() => {
      // ensure driver is closed even when ingestion throws
    });
    return NextResponse.json(
      { error: "Graph ingestion failed. Check server logs for details." },
      { status: 500 },
    );
  }
}
