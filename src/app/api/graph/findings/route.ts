import { NextResponse } from "next/server";
import "@/lib/utils/load-env";
import { fetchFindings } from "@/lib/graph/queries";

export const revalidate = 0;

export async function GET() {
  try {
    const data = await fetchFindings();
    return NextResponse.json({ data });
  } catch (error) {
    console.error("Failed to load findings", error);
    return NextResponse.json(
      { error: "Unable to load findings" },
      { status: 500 },
    );
  }
}
