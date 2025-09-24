"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils/cn";

type Message = {
  id: string;
  role: "user" | "agent";
  content: string;
  agent?: string;
  citations?: string[];
};

const MOCK_MESSAGES: Message[] = [
  {
    id: "1",
    role: "user",
    content:
      "Rank the riskiest findings impacting internet-exposed assets this week.",
  },
  {
    id: "2",
    role: "agent",
    agent: "Prioritizer",
    content:
      "Impact ranking prepared. Three findings exceed blast radius threshold (>20 assets). Included evidence references and trend deltas.",
    citations: ["FG-001", "FG-002"],
  },
  {
    id: "3",
    role: "agent",
    agent: "Explainer",
    content:
      "Root cause traces back to shared Kubernetes ingress misconfiguration deployed 9 days ago.",
    citations: ["Graph path: ingress-nginx → checkout-service"],
  },
];

const AGENT_ROLES = [
  { name: "Retriever", status: "Idle" },
  { name: "Graph-Reasoner", status: "Querying graph" },
  { name: "Prioritizer", status: "Responded" },
  { name: "Remediator", status: "Ready" },
  { name: "Explainer", status: "Responded" },
];

const MODELS = [
  "gemini-2.5-flash",
  "sonnet-4",
  "grok-3-mini",
  "gpt-4.1",
  "o4-mini",
];

export function ChatConsole() {
  const [messages, setMessages] = useState(MOCK_MESSAGES);
  const [input, setInput] = useState("");
  const [model, setModel] = useState(MODELS[3]);

  function handleSend() {
    if (!input.trim()) return;
    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role: "user",
        content: input,
      },
    ]);
    setInput("");
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="flex flex-col gap-3">
        <Card
          title="Chat with investigation agents"
          subtitle="@mention agents, run slash commands, and push answers to other views."
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
              {messages.map((message) => (
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
                  {message.role === "agent" && (
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-400">
                      <Button variant="secondary" className="px-2 py-1 text-xs">
                        Show on graph
                      </Button>
                      <Button variant="ghost" className="px-2 py-1 text-xs">
                        Save as playbook step
                      </Button>
                      <Button variant="ghost" className="px-2 py-1 text-xs">
                        Export to PDF
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </Card>
        <div className="sticky bottom-0 flex flex-col gap-2 rounded-xl border border-slate-800/70 bg-slate-950/80 p-4">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>Slash commands:</span>
            <Badge tone="neutral">/rank-risk</Badge>
            <Badge tone="neutral">/why</Badge>
            <Badge tone="neutral">/path internet-&gt;db</Badge>
            <Badge tone="neutral">/fix-plan</Badge>
          </div>
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
            />
            <Button onClick={handleSend}>Send</Button>
          </div>
        </div>
      </section>

      <aside className="flex max-h-[calc(100vh-220px)] flex-col gap-4 overflow-hidden">
        <Card title="Agent timeline" subtitle="Track multi-agent collaboration">
          <div className="flex flex-col gap-3 text-xs text-slate-300">
            {AGENT_ROLES.map((agent) => (
              <div
                key={agent.name}
                className="flex items-center justify-between rounded-lg border border-slate-800/60 bg-slate-950/40 px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <span aria-hidden>🤖</span>
                  <div>
                    <p className="text-sm font-semibold text-slate-100">
                      {agent.name}
                    </p>
                    <p className="text-[11px] uppercase tracking-wide text-slate-500">
                      {agent.status}
                    </p>
                  </div>
                </div>
                <Button variant="ghost" className="px-2 py-1 text-[11px]">
                  Trace
                </Button>
              </div>
            ))}
          </div>
        </Card>
        <Card
          title="Context attachments"
          subtitle="Selection shared with agents"
        >
          <div className="flex flex-col gap-2 text-xs text-slate-300">
            <p>Findings: FG-001, FG-002</p>
            <p>Subgraph: internet → checkout service (4 nodes)</p>
            <Button variant="secondary" className="mt-2 px-3 py-1 text-xs">
              Clear selection
            </Button>
          </div>
        </Card>
      </aside>
    </div>
  );
}
