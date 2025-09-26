"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type {
  ChatAgentFinding,
  ChatAgentInsight,
} from "@/lib/agents/chat-agent";
import type { AgentExecutedStep } from "@/lib/agents/runtime";
import { cn } from "@/lib/utils/cn";

const MODELS = [
  "gemini-2.5-flash",
  "sonnet-4",
  "grok-3-mini",
  "gpt-4.1",
  "o4-mini",
];

type Message = {
  id: string;
  role: "user" | "agent";
  content: string;
  agent?: string;
  citations?: string[];
};

export function ChatConsole() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [agentSteps, setAgentSteps] = useState<AgentExecutedStep[]>([]);
  const [findings, setFindings] = useState<ChatAgentFinding[]>([]);
  const [insights, setInsights] = useState<ChatAgentInsight[]>([]);
  const [input, setInput] = useState("");
  const [model, setModel] = useState(MODELS[3]);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSend() {
    if (!input.trim() || isSending) return;
    const messageId = crypto.randomUUID();
    const prompt = input.trim();

    setMessages((prev) => [
      ...prev,
      {
        id: messageId,
        role: "user",
        content: prompt,
      },
    ]);
    setInput("");
    setError(null);
    setIsSending(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: prompt, model }),
      });

      const raw = await response.text();
      if (!response.ok) {
        const payload = safeParse(raw);
        throw new Error(payload?.error ?? (raw || "Chat agent failed."));
      }

      const payload = safeParse(raw) as {
        data?: {
          answer: string;
          citations: string[];
          steps: AgentExecutedStep[];
          findings: ChatAgentFinding[];
          insights: ChatAgentInsight[];
        };
      } | null;
      const data = payload?.data;
      if (!data) {
        throw new Error("Chat agent returned no data payload.");
      }

      setAgentSteps(data.steps ?? []);
      setFindings(data.findings ?? []);
      setInsights(data.insights ?? []);
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "agent",
          agent: "Graph Analyst",
          content: data.answer,
          citations: data.citations,
        },
      ]);
    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : "Unable to run chat agent.";
      setError(message);
      setAgentSteps([]);
      setFindings([]);
      setInsights([]);
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "agent",
          agent: "Graph Analyst",
          content: "I ran into an error while reasoning over the graph.",
        },
      ]);
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="flex flex-col gap-3">
        {error && (
          <Card className="border-rose-900/60 bg-rose-900/20">
            <p className="text-sm text-rose-200">{error}</p>
          </Card>
        )}
        <Card
          title="Chat with investigation agents"
          subtitle="Multi-agent reasoning grounded in the vulnerability graph."
        >
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
              <span>Model:</span>
              <div className="flex flex-wrap gap-2">
                {MODELS.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setModel(item)}
                    className={cn(
                      "rounded-full border px-3 py-1",
                      model === item
                        ? "border-blue-400 bg-blue-500/20 text-blue-200"
                        : "border-slate-700 bg-slate-900/60 text-slate-300 hover:border-blue-400/60",
                    )}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3">
              {messages.length === 0 ? (
                <p className="text-sm text-slate-400">
                  Ask a question about the ingest. For example, “Rank the
                  riskiest internet-facing vulnerabilities” or “Explain shared
                  root causes among auth-svc findings.”
                </p>
              ) : (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      "rounded-2xl border border-slate-800/70 bg-slate-950/50 p-4 text-sm text-slate-200 shadow-sm",
                      message.role === "user" &&
                        "border-blue-500/50 bg-blue-500/10",
                    )}
                  >
                    <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wide">
                      {message.role === "user" ? (
                        <span className="font-semibold text-blue-200">You</span>
                      ) : (
                        <>
                          <Badge tone="neutral">{message.agent}</Badge>
                          <span className="text-slate-500">Agent</span>
                        </>
                      )}
                    </div>
                    <p>{message.content}</p>
                    {message.citations && message.citations.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-400">
                        {message.citations.map((citation) => (
                          <Badge key={citation} tone="neutral">
                            {citation}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </Card>
        <div className="sticky bottom-0 flex flex-col gap-2 rounded-xl border border-slate-800/70 bg-slate-950/80 p-4">
          <div className="flex items-center gap-2">
            <Input
              placeholder="Ask anything about the current investigation"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  handleSend();
                }
              }}
              disabled={isSending}
            />
            <Button onClick={handleSend} disabled={isSending}>
              {isSending ? "Thinking…" : "Send"}
            </Button>
          </div>
        </div>
      </section>

      <aside className="flex max-h-[calc(100vh-220px)] flex-col gap-4 overflow-hidden">
        <Card title="Agent execution steps" subtitle="Tool calls & outcomes">
          <div className="flex flex-col gap-3 text-xs text-slate-300">
            {agentSteps.length === 0 ? (
              <p className="text-sm text-slate-500">
                Steps will appear once the agent runs.
              </p>
            ) : (
              agentSteps.map((step) => (
                <div
                  key={step.id}
                  className="rounded-lg border border-slate-800/60 bg-slate-950/40 px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-100">
                        {step.tool}
                      </p>
                      <p className="text-[11px] uppercase tracking-wide text-slate-500">
                        {step.output ?? step.description}
                      </p>
                    </div>
                    <Badge tone={step.error ? "danger" : "neutral"}>
                      {step.error ? "Error" : `${step.durationMs} ms`}
                    </Badge>
                  </div>
                  {step.error && (
                    <p className="mt-2 text-[11px] text-rose-300">
                      {step.error}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </Card>

        <Card title="Generated insights" subtitle="Intermediate agent findings">
          <div className="flex flex-col gap-3 text-xs text-slate-300">
            {insights.length === 0 ? (
              <p className="text-sm text-slate-500">
                Insights will appear as the agent uncovers relationships and
                priorities.
              </p>
            ) : (
              insights.map((insight) => (
                <div
                  key={insight.title}
                  className="rounded-lg border border-slate-800/60 bg-slate-950/40 px-3 py-2"
                >
                  <p className="text-sm font-semibold text-slate-100">
                    {insight.title}
                  </p>
                  <p className="mt-1 text-[13px] text-slate-200">
                    {insight.detail}
                  </p>
                  {insight.citations && insight.citations.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-400">
                      {insight.citations.map((citation) => (
                        <Badge key={citation} tone="neutral">
                          {citation}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </Card>

        <Card
          title="Retrieved findings"
          subtitle="Context supplied to the agent"
        >
          <div className="flex flex-col gap-2 text-xs text-slate-300">
            {findings.length === 0 ? (
              <p className="text-sm text-slate-500">
                Relevant findings from the graph will show up here after each
                question.
              </p>
            ) : (
              findings.map((finding) => (
                <div
                  key={finding.id}
                  className="rounded-lg border border-slate-800/60 bg-slate-950/40 px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-slate-100">
                      {finding.id}
                    </span>
                    <Badge tone="neutral">
                      {finding.severity ?? "UNKNOWN"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-slate-200">
                    {finding.title ?? "No title recorded"}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    {finding.service
                      ? `Service: ${finding.service}`
                      : "Service: —"}
                  </p>
                  {finding.timestamp && (
                    <p className="text-[11px] text-slate-500">
                      Seen: {new Date(finding.timestamp).toLocaleString()}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </Card>
      </aside>
    </div>
  );
}

function safeParse(raw: string): unknown {
  try {
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.warn("Failed to parse chat response JSON", error);
    return null;
  }
}
