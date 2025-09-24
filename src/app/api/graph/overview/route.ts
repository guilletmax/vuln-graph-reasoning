import { NextResponse } from "next/server";
import "@/lib/utils/load-env";
import { fetchOverviewMetrics } from "@/lib/graph/queries";

export const revalidate = 0;

export async function GET() {
  try {
    const data = await fetchOverviewMetrics();
    return NextResponse.json({ data });
  } catch (error) {
    console.error("Failed to fetch overview metrics", error);
    return NextResponse.json(
      { error: "Unable to load overview metrics" },
      { status: 500 },
    );
  }
}
