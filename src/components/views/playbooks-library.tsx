"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const MOCK_PLAYBOOKS = [
  {
    id: "pb-1",
    name: "Correlate Log4j descendants",
    description:
      "Cross reference CVE-2021-44228 descendants with internet exposure",
    category: "Automation",
  },
  {
    id: "pb-2",
    name: "Detect shared misconfig root cause",
    description:
      "Cluster findings by policy failure and highlight shared manifests",
    category: "Root Cause",
  },
  {
    id: "pb-3",
    name: "Rank open findings by blast radius",
    description: "Large blast radius + high exploit maturity",
    category: "Prioritization",
  },
];

const MOCK_QUERIES = [
  {
    id: "cypher-1",
    name: "Shortest path internet → crown jewel",
    query:
      "MATCH path = shortestPath((internet)-[*]->(asset)) WHERE asset.tier = 'crown' RETURN path",
  },
  {
    id: "cypher-2",
    name: "Find controls without coverage",
    query:
      "MATCH (c:Control) WHERE NOT (c)-[:COVERS]->(:Vulnerability) RETURN c",
  },
];

export function PlaybooksLibrary() {
  const [selectedPlaybook, setSelectedPlaybook] = useState(MOCK_PLAYBOOKS[0]);

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="flex flex-col gap-4">
        <Card
          title="Playbooks"
          subtitle="Reusable automations you can run across ingest snapshots."
        >
          <div className="flex flex-col gap-3">
            {MOCK_PLAYBOOKS.map((playbook) => (
              <div
                key={playbook.id}
                className="flex flex-col gap-2 rounded-xl border border-slate-800/60 bg-slate-950/40 p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-slate-100">
                      {playbook.name}
                    </span>
                    <span className="text-xs text-slate-400">
                      {playbook.description}
                    </span>
                  </div>
                  <Badge tone="neutral">{playbook.category}</Badge>
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-slate-300">
                  <Button variant="primary" className="px-3 py-1 text-xs">
                    Run • Graph view
                  </Button>
                  <Button
                    variant="secondary"
                    className="px-3 py-1 text-xs"
                    onClick={() => setSelectedPlaybook(playbook)}
                  >
                    Preview steps
                  </Button>
                  <Button variant="ghost" className="px-3 py-1 text-xs">
                    Save copy
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card
          title="Saved Cypher queries"
          subtitle="Curated graph snippets for quick retrieval."
        >
          <div className="flex flex-col gap-3 text-xs text-slate-300">
            {MOCK_QUERIES.map((query) => (
              <div
                key={query.id}
                className="rounded-xl border border-slate-800/70 bg-slate-950/50 p-3"
              >
                <p className="text-sm font-semibold text-slate-100">
                  {query.name}
                </p>
                <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-lg bg-slate-950/80 p-3 text-[11px] text-slate-300">
                  {query.query}
                </pre>
                <div className="mt-2 flex gap-2">
                  <Button variant="secondary" className="px-3 py-1 text-xs">
                    Run in graph
                  </Button>
                  <Button variant="ghost" className="px-3 py-1 text-xs">
                    Copy
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <aside className="flex flex-col gap-4">
        <Card title="Playbook steps" subtitle="Detailed automation flow">
          <div className="flex flex-col gap-3 text-xs text-slate-300">
            <p className="text-sm font-semibold text-slate-100">
              {selectedPlaybook.name}
            </p>
            <ol className="list-decimal space-y-2 pl-5">
              <li>Ingest latest findings snapshot and normalize IDs.</li>
              <li>
                Query graph for vulnerable assets reachable from the internet.
              </li>
              <li>Rank by blast radius & exploit maturity; tag owners.</li>
              <li>Export prioritized list to Findings Explorer saved view.</li>
            </ol>
            <Button variant="secondary" className="px-3 py-1 text-xs">
              Convert to playbook step
            </Button>
          </div>
        </Card>
        <Card title="Automations" subtitle="Schedule or trigger on ingest">
          <div className="flex flex-col gap-2 text-xs text-slate-300">
            <p>Trigger: After ingest completion</p>
            <p>Notify: #security-ops, email CISO</p>
            <Button variant="secondary" className="px-3 py-1 text-xs">
              Configure triggers
            </Button>
          </div>
        </Card>
      </aside>
    </div>
  );
}
