"use client";

import { useId, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils/cn";

const NODE_TYPES = [
  "Asset",
  "Service",
  "Package",
  "Vulnerability",
  "ATT&CK",
  "Evidence",
  "Control",
  "Patch",
  "Owner",
  "Repo",
  "Cloud Resource",
];

const EDGE_TYPES = [
  "Dependency lineage",
  "Exploit chain",
  "Shared root cause",
  "Co-occurrence",
  "Asset ↔ Service",
  "Package ↔ CVE",
  "Control coverage",
  "Ownership",
  "PR ↔ Fix",
];

const MOCK_NODES = [
  { id: "asset:checkout", label: "Checkout Service", type: "Asset" },
  { id: "cve:2024-35689", label: "CVE-2024-35689", type: "Vulnerability" },
  { id: "pkg:libpq@16.3", label: "libpq 16.3", type: "Package" },
  {
    id: "tech:T1190",
    label: "T1190 Exploit Public-Facing App",
    type: "ATT&CK",
  },
];

const MOCK_POSITIONS = [
  { col: 2, row: 2 },
  { col: 4, row: 1 },
  { col: 5, row: 3 },
  { col: 3, row: 4 },
];

export function GraphView() {
  const [selectedNode, setSelectedNode] = useState(MOCK_NODES[0]);
  const [activeEdgeTypes, setActiveEdgeTypes] = useState<string[]>([
    "Dependency lineage",
    "Exploit chain",
  ]);
  const searchInputId = useId();

  const summary = useMemo(
    () => ({
      nodes: 534,
      edges: 1_482,
      selected: selectedNode?.label,
    }),
    [selectedNode],
  );

  return (
    <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)_320px]">
      <aside className="flex flex-col gap-4">
        <Card title="Graph controls" subtitle="Tune the canvas">
          <div className="flex flex-col gap-3 text-sm text-slate-200">
            <div className="flex flex-col gap-2">
              <label
                className="text-xs font-semibold uppercase tracking-wide text-slate-400"
                htmlFor={searchInputId}
              >
                Search nodes
              </label>
              <Input id={searchInputId} placeholder="asset:production-api" />
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Layout
              </p>
              <div className="grid grid-cols-2 gap-2">
                {["Force-directed", "Concentric", "Hierarchy", "Radial"].map(
                  (layout) => (
                    <Button
                      key={layout}
                      variant="secondary"
                      className="px-2 py-1 text-xs"
                    >
                      {layout}
                    </Button>
                  ),
                )}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Edge types
              </p>
              <div className="flex flex-wrap gap-2">
                {EDGE_TYPES.map((edge) => {
                  const active = activeEdgeTypes.includes(edge);
                  return (
                    <button
                      key={edge}
                      type="button"
                      onClick={() =>
                        setActiveEdgeTypes((prev) =>
                          prev.includes(edge)
                            ? prev.filter((item) => item !== edge)
                            : [...prev, edge],
                        )
                      }
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs",
                        active
                          ? "border-blue-400 bg-blue-500/20 text-blue-200"
                          : "border-slate-700 bg-slate-900/60 text-slate-300 hover:border-blue-400/60",
                      )}
                    >
                      {edge}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Run saved query
              </p>
              <div className="flex flex-col gap-2">
                <Button variant="ghost" className="justify-between">
                  Shortest path internet → crown jewel
                  <span aria-hidden>→</span>
                </Button>
                <Button variant="ghost" className="justify-between">
                  Community clusters by owner
                  <span aria-hidden>→</span>
                </Button>
              </div>
            </div>
          </div>
        </Card>
        <Card title="Legend" subtitle="Node categories">
          <div className="grid grid-cols-2 gap-2 text-xs text-slate-300">
            {NODE_TYPES.map((node) => (
              <div key={node} className="flex items-center gap-2">
                <span
                  className="h-2 w-2 rounded-full bg-blue-400/80"
                  aria-hidden
                />
                {node}
              </div>
            ))}
          </div>
        </Card>
      </aside>

      <section className="relative flex min-h-[520px] flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-100">
              Knowledge graph
            </h2>
            <p className="text-xs text-slate-400">
              Pan, zoom, lasso select, and expand neighborhoods to continue the
              investigation.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost">Pin selection</Button>
            <Button variant="secondary">Snapshot subgraph</Button>
            <Button>Export JSON</Button>
          </div>
        </div>
        <div className="relative flex flex-1 items-center justify-center overflow-hidden rounded-3xl border border-slate-800/70 bg-slate-950/40">
          <div
            className="absolute inset-0 bg-[radial-gradient(circle_at_top,var(--surface),transparent)] opacity-50"
            aria-hidden
          />
          <MockGraphCanvas
            onSelectNode={setSelectedNode}
            selectedNode={selectedNode}
          />
          <div className="absolute bottom-4 left-4 flex gap-4 rounded-lg border border-slate-800/60 bg-slate-950/80 px-4 py-2 text-xs text-slate-300">
            <span>{summary.nodes} nodes</span>
            <span>{summary.edges} edges</span>
            {summary.selected && <span>Focused: {summary.selected}</span>}
          </div>
          <MiniMap />
          <TimeSlider />
        </div>
      </section>

      <aside className="flex max-h-[calc(100vh-220px)] flex-col gap-3 overflow-hidden">
        <Card title="Node details" subtitle="Metadata and remediation">
          {selectedNode ? (
            <div className="flex flex-col gap-3 text-xs text-slate-300">
              <div>
                <h3 className="text-sm font-semibold text-slate-100">
                  {selectedNode.label}
                </h3>
                <Badge tone="neutral">{selectedNode.type}</Badge>
              </div>
              <div className="rounded-lg border border-slate-800/60 bg-slate-950/50 p-3">
                <p>Evidence attaches 4 log excerpts and 2 agent summaries.</p>
                <p className="mt-2">
                  Remediation in progress → owner{" "}
                  <strong>Payments Squad</strong>, ETA 4 days.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" className="px-3 py-1 text-xs">
                  Show similar nodes
                </Button>
                <Button variant="ghost" className="px-3 py-1 text-xs">
                  Explain root cause
                </Button>
                <Button variant="primary" className="px-3 py-1 text-xs">
                  Propose fix
                </Button>
              </div>
              <div className="rounded-lg border border-slate-800/60 bg-slate-950/40 p-3">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Connected edges
                </h4>
                <ul className="mt-2 flex flex-col gap-1 text-xs">
                  <li>
                    Linked to CVE-2024-35689 via package dependency depth 3
                  </li>
                  <li>
                    Shared misconfig root cause with Cloudfront Distribution
                  </li>
                  <li>Exploit chain: Internet → Edge → Checkout Service</li>
                </ul>
              </div>
            </div>
          ) : (
            <p>
              Select a node to inspect metadata, evidence, and remediation
              guidance.
            </p>
          )}
        </Card>
      </aside>
    </div>
  );
}

type MockGraphCanvasProps = {
  selectedNode: (typeof MOCK_NODES)[number];
  onSelectNode: (node: (typeof MOCK_NODES)[number]) => void;
};

function MockGraphCanvas({ selectedNode, onSelectNode }: MockGraphCanvasProps) {
  return (
    <div className="relative h-full w-full">
      <div className="absolute inset-0 grid grid-cols-6 grid-rows-4 gap-8 p-12">
        {MOCK_NODES.map((node, index) => (
          <button
            key={node.id}
            type="button"
            className={cn(
              "flex items-center justify-center rounded-full border-2 border-slate-800/60 bg-slate-900/80 text-xs text-slate-200 shadow-lg shadow-blue-900/30 transition",
              selectedNode.id === node.id &&
                "border-blue-400 bg-blue-500/20 shadow-blue-500/40",
            )}
            style={{
              gridColumn: MOCK_POSITIONS[index]?.col ?? 1,
              gridRow: MOCK_POSITIONS[index]?.row ?? 1,
            }}
            onClick={() => onSelectNode(node)}
          >
            {node.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function MiniMap() {
  return (
    <div className="pointer-events-none absolute right-4 top-4 flex h-24 w-36 items-center justify-center rounded-lg border border-slate-800/60 bg-slate-950/80 text-[10px] text-slate-400">
      Mini-map
    </div>
  );
}

function TimeSlider() {
  return (
    <div className="absolute bottom-4 right-4 flex w-72 flex-col gap-1 rounded-lg border border-slate-800/60 bg-slate-950/80 px-4 py-3 text-xs text-slate-300">
      <div className="flex items-center justify-between">
        <span>Timeline</span>
        <span>Last 90 days</span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-800">
        <div className="h-full w-1/2 rounded-full bg-blue-500" aria-hidden />
      </div>
      <div className="flex items-center justify-between text-[10px] uppercase tracking-wide text-slate-500">
        <span>Jan</span>
        <span>Feb</span>
        <span>Mar</span>
        <span>Apr</span>
      </div>
    </div>
  );
}
