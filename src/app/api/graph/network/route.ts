import { NextResponse } from "next/server";
import "@/lib/utils/load-env";
import { fetchGraphNetwork } from "@/lib/graph/queries";

export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const nodeLimitParam = url.searchParams.get("nodes");
    const edgeLimitParam = url.searchParams.get("edges");

    const nodeLimit = nodeLimitParam ? Number(nodeLimitParam) : undefined;
    const edgeLimit = edgeLimitParam ? Number(edgeLimitParam) : undefined;

    const data = await fetchGraphNetwork({ nodeLimit, edgeLimit });
    return NextResponse.json({ data });
  } catch (error) {
    console.error("Failed to load graph network", error);
    return NextResponse.json(
      { error: "Unable to load graph network" },
      { status: 500 },
    );
  }
}
