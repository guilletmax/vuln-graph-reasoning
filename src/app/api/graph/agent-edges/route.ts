import { NextResponse } from "next/server";
import "@/lib/utils/load-env";
import { fetchAgentEdges } from "@/lib/graph/queries";

export const revalidate = 0;

export async function GET() {
  try {
    const data = await fetchAgentEdges();
    return NextResponse.json({ data });
  } catch (error) {
    console.error("Failed to load agent edges", error);
    return NextResponse.json(
      { error: "Unable to load agent relationships" },
      { status: 500 },
    );
  }
}
