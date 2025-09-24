"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const MOCK_CARDS = [
  {
    id: "card-1",
    title: "Executive summary",
    content:
      "Critical finding CVE-2024-35689 now impacts 12 production assets. Exploit confirmed in the wild; remediation targeted within 4 days.",
    tags: ["Impact", "Priority"],
  },
  {
    id: "card-2",
    title: "Graph insight",
    content:
      "Exploit path traced: Internet → API Gateway → Checkout Service. Shared misconfiguration identified in ingress manifest commit 7ac9d1.",
    tags: ["Path", "Root cause"],
  },
  {
    id: "card-3",
    title: "Remediation actions",
    content:
      "Payments squad deploying patch PR #4821. Control coverage update scheduled to enforce WAF mitigation and regression test.",
    tags: ["Remediation", "Owner"],
  },
];

export function InvestigationCanvas() {
  const [cards, setCards] = useState(MOCK_CARDS);

  function handleReorder(direction: "up" | "down", index: number) {
    const next = [...cards];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= next.length) return;
    const temp = next[index];
    next[index] = next[targetIndex];
    next[targetIndex] = temp;
    setCards(next);
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <section className="flex flex-col gap-4">
        <Card
          title="Investigation canvas"
          subtitle="Drag to reorder, annotate, and share a permalink with stakeholders."
        >
          <div className="flex flex-col gap-4">
            {cards.map((card, index) => (
              <div
                key={card.id}
                className="rounded-2xl border border-slate-800/70 bg-slate-950/60 p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold text-slate-100">
                    {card.title}
                  </h3>
                  {card.tags.map((tag) => (
                    <Badge key={tag} tone="neutral">
                      {tag}
                    </Badge>
                  ))}
                </div>
                <p className="mt-2 text-sm text-slate-300">{card.content}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-400">
                  <Button
                    variant="secondary"
                    className="px-3 py-1 text-xs"
                    onClick={() => handleReorder("up", index)}
                  >
                    Move up
                  </Button>
                  <Button
                    variant="secondary"
                    className="px-3 py-1 text-xs"
                    onClick={() => handleReorder("down", index)}
                  >
                    Move down
                  </Button>
                  <Button variant="ghost" className="px-3 py-1 text-xs">
                    Annotate
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
        <Card
          title="Generate CISO brief"
          subtitle="Compile summary, risks, trendlines, and mitigation plan in one click."
        >
          <div className="flex flex-col gap-3 text-sm text-slate-300">
            <p>
              Pulls latest metrics from findings, graph, and agent insights.
            </p>
            <p>Outputs download-ready PDF or Google Doc.</p>
            <div className="flex gap-2">
              <Button>Generate</Button>
              <Button variant="secondary">Preview outline</Button>
            </div>
          </div>
        </Card>
      </section>

      <aside className="flex flex-col gap-4">
        <Card
          title="Snapshots"
          subtitle="Bring in charts, tables, or subgraphs"
        >
          <div className="flex flex-col gap-3 text-xs text-slate-300">
            <p>+ Risk sparkline (14 day trend)</p>
            <p>+ Subgraph: Internet → Checkout Service</p>
            <p>+ Findings table slice: Critical, blast radius &gt; 20</p>
            <Button variant="secondary" className="px-3 py-1 text-xs">
              Add from clipboard
            </Button>
          </div>
        </Card>
        <Card title="Sharing" subtitle="Keep leadership aligned">
          <div className="flex flex-col gap-2 text-xs text-slate-300">
            <p>Permalink visibility: Org-wide</p>
            <p>Last updated: 5 minutes ago</p>
            <div className="flex gap-2">
              <Button variant="ghost" className="px-3 py-1 text-xs">
                Copy link
              </Button>
              <Button variant="secondary" className="px-3 py-1 text-xs">
                Export markdown
              </Button>
            </div>
          </div>
        </Card>
      </aside>
    </div>
  );
}
