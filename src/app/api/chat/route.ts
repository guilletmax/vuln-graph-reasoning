import { NextResponse } from "next/server";
import "@/lib/utils/load-env";
import { runChatAgent } from "@/lib/agents/chat-agent";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      message?: string;
      model?: string;
    };
    const question = body.message?.trim();

    if (!question) {
      return NextResponse.json(
        { error: "Message body missing. Provide a 'message' string." },
        { status: 400 },
      );
    }

    const result = await runChatAgent({
      question,
      model: body.model,
    });

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error("Chat agent execution failed", error);
    return NextResponse.json(
      { error: "Chat agent failed. Check server logs." },
      { status: 500 },
    );
  }
}
