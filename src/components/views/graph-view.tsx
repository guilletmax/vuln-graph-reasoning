"use client";

import dynamic from "next/dynamic";
import type { CSSProperties, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ForceGraphMethods } from "react-force-graph-2d";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { GraphNetwork, GraphNetworkEdge } from "@/lib/graph/queries";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
});

const COLOR_PALETTE = [
  "#38bdf8",
  "#f472b6",
  "#facc15",
  "#60a5fa",
  "#34d399",
  "#c084fc",
  "#f97316",
  "#f43f5e",
  "#a3e635",
  "#fbbf24",
];

const VULNERABILITY_COLOR = "#ef4444";
const REPOSITORY_COLOR = "#1d4ed8";
const PACKAGE_COLOR = "#92400e";
const ASSET_COLOR = "#166534";
const BASE_EDGE_COLOR = "rgba(148, 163, 184, 0.45)";
const BASE_EDGE_HOVER_COLOR = "rgba(226, 232, 240, 0.85)";
const AGENT_HEURISTIC_EDGE_COLOR = "rgba(96, 165, 250, 0.7)";
const AGENT_HEURISTIC_EDGE_HOVER_COLOR = "rgba(191, 219, 254, 0.95)";
const AGENT_LLM_EDGE_COLOR = "rgba(249, 168, 212, 0.7)";
const AGENT_LLM_EDGE_HOVER_COLOR = "rgba(255, 228, 236, 0.95)";

const EDGE_PROVENANCE_LEGEND = [
  { key: "base", label: "Modeled relationship", color: BASE_EDGE_COLOR },
  {
    key: "heuristic",
    label: "AI heuristic",
    color: AGENT_HEURISTIC_EDGE_COLOR,
  },
  { key: "llm", label: "AI LLM", color: AGENT_LLM_EDGE_COLOR },
];

type ForceGraphNode = {
  id: string;
  label: string;
  group: string;
  properties: Record<string, unknown>;
};

type ForceGraphLink = {
  source: string;
  target: string;
  type: string;
  properties: Record<string, unknown>;
};

export function GraphView() {
  const [network, setNetwork] = useState<GraphNetwork | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<ForceGraphNode | null>(null);
  const graphAreaRef = useRef<HTMLDivElement | null>(null);
  const graphRef = useRef<ForceGraphMethods>();
  const hasFitRef = useRef(false);
  const leftColumnRef = useRef<HTMLDivElement | null>(null);
  const [leftColumnHeight, setLeftColumnHeight] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadNetwork() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/graph/network", {
          cache: "no-store",
        });
        if (!response.ok) {
          throw new Error(await response.text());
        }
        const json = (await response.json()) as { data: GraphNetwork };
        if (!cancelled) {
          setNetwork(json.data);
        }
      } catch (err) {
        if (!cancelled) {
          setError("Unable to load knowledge graph");
          console.error(err);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    loadNetwork();
    return () => {
      cancelled = true;
    };
  }, []);

  const colorByLabel = useMemo<Record<string, string>>(() => {
    if (!network) return {};
    const labels = Array.from(new Set(network.nodes.map((node) => node.label)));
    const map: Record<string, string> = {};
    labels.forEach((label, index) => {
      map[label] =
        label === "Vulnerability"
          ? VULNERABILITY_COLOR
          : label === "Repository"
            ? REPOSITORY_COLOR
            : label === "Package"
              ? PACKAGE_COLOR
              : label === "Asset"
                ? ASSET_COLOR
                : COLOR_PALETTE[index % COLOR_PALETTE.length];
    });
    return map;
  }, [network]);

  const graphData = useMemo<{
    nodes: ForceGraphNode[];
    links: ForceGraphLink[];
  }>(() => {
    if (!network) return { nodes: [], links: [] };
    return {
      nodes: network.nodes.map((node) => ({
        id: node.id,
        label: node.label,
        group: node.label,
        properties: node.properties,
      })),
      links: network.edges.map((edge) => ({
        source: edge.from.id,
        target: edge.to.id,
        type: edge.type,
        properties: edge.properties,
      })),
    };
  }, [network]);

  const hoveredEdges: GraphNetworkEdge[] = useMemo(() => {
    if (!network || !hoveredNode) return [];
    return network.edges.filter(
      (edge) =>
        edge.from.id === hoveredNode.id || edge.to.id === hoveredNode.id,
    );
  }, [network, hoveredNode]);

  const hoveredNodeId = hoveredNode?.id ?? null;

  useEffect(() => {
    if (!graphRef.current || !network) return;
    const chargeForce = graphRef.current.d3Force("charge");
    if (chargeForce && typeof chargeForce.strength === "function") {
      chargeForce.strength(-25);
    }
    const linkForce = graphRef.current.d3Force("link") as
      | { distance?: (dist: number) => void }
      | undefined;
    if (linkForce && typeof linkForce.distance === "function") {
      linkForce.distance(40);
    }
    graphRef.current.d3ReheatSimulation();
    hasFitRef.current = false;
  }, [network]);

  useEffect(() => {
    const columnEl = leftColumnRef.current;
    if (!columnEl) {
      setLeftColumnHeight(null);
      return;
    }

    const updateHeight = () => {
      setLeftColumnHeight(columnEl.getBoundingClientRect().height);
    };

    updateHeight();

    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            updateHeight();
          })
        : null;

    if (resizeObserver) {
      resizeObserver.observe(columnEl);
    }

    window.addEventListener("resize", updateHeight);

    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      window.removeEventListener("resize", updateHeight);
    };
  }, []);

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <Card className="border-rose-900/60 bg-rose-900/20">
          <p className="text-sm text-rose-200">{error}</p>
        </Card>
      )}

      <div className="flex w-full flex-col gap-4 lg:flex-row lg:items-start lg:gap-6 xl:mx-auto xl:max-w-7xl">
        <div
          ref={leftColumnRef}
          className="flex min-w-0 flex-1 flex-col gap-4 lg:min-h-0"
        >
          <Card
            title="Graph summary"
            subtitle="Current nodes and relationships in the knowledge graph"
          >
            {loading && !network ? (
              <div className="flex gap-3">
                <Skeleton className="h-16 w-full" />
              </div>
            ) : network ? (
              <div className="flex flex-wrap gap-6 text-sm">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-400">
                    Nodes
                  </p>
                  <p className="text-2xl font-semibold text-slate-100">
                    {network.nodes.length}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-400">
                    Relationships
                  </p>
                  <p className="text-2xl font-semibold text-slate-100">
                    {network.edges.length}
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  <p className="text-xs uppercase tracking-wide text-slate-400">
                    Node labels
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(colorByLabel).map(([label, color]) => (
                      <span
                        key={label}
                        className="flex items-center gap-2 rounded-full border border-slate-800/60 px-3 py-1"
                      >
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: color }}
                          aria-hidden
                        />
                        <span className="text-xs text-slate-200">{label}</span>
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <p className="text-xs uppercase tracking-wide text-slate-400">
                    Edge provenance
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {EDGE_PROVENANCE_LEGEND.map((item) => (
                      <span
                        key={item.key}
                        className="flex items-center gap-2 rounded-full border border-slate-800/60 px-3 py-1"
                      >
                        <span
                          className="h-0.5 w-6 rounded-full"
                          style={{ backgroundColor: item.color }}
                          aria-hidden
                        />
                        <span className="text-xs text-slate-200">
                          {item.label}
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-400">
                Upload findings to populate the graph.
              </p>
            )}
          </Card>

          <GraphCanvas
            loading={loading}
            network={network}
            graphData={graphData}
            colorByLabel={colorByLabel}
            hoveredNodeId={hoveredNodeId}
            setHoveredNode={setHoveredNode}
            graphAreaRef={graphAreaRef}
            graphRef={graphRef}
          />
        </div>

        <div className="lg:w-[22rem] lg:flex-none lg:min-h-0">
          <NodeInspector
            hoveredNode={hoveredNode}
            hoveredEdges={hoveredEdges}
            heightLimit={leftColumnHeight}
          />
        </div>
      </div>
    </div>
  );
}

function renderValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value;
  if (typeof value === "number") return value.toString();
  if (typeof value === "boolean") return value ? "true" : "false";
  try {
    return JSON.stringify(value);
  } catch (_error) {
    return String(value);
  }
}

function renderNodePropertyValue(
  label: string,
  key: string,
  value: unknown,
): ReactNode {
  if (label === "Vulnerability" && key === "cwe_id") {
    const text = renderValue(value);
    const match = text.match(/^CWE-(\d+)$/i);
    if (match) {
      const definitionId = match[1];
      const href = `https://cwe.mitre.org/data/definitions/${definitionId}.html`;
      return (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="text-blue-300 underline underline-offset-2 hover:text-blue-200"
        >
          {text}
        </a>
      );
    }
  }

  return renderValue(value);
}

type GraphCanvasProps = {
  loading: boolean;
  network: GraphNetwork | null;
  graphData: { nodes: ForceGraphNode[]; links: ForceGraphLink[] };
  colorByLabel: Record<string, string>;
  hoveredNodeId: string | null;
  setHoveredNode: React.Dispatch<React.SetStateAction<ForceGraphNode | null>>;
  graphAreaRef: React.RefObject<HTMLDivElement>;
  graphRef: React.RefObject<ForceGraphMethods | undefined>;
};

function GraphCanvas({
  loading,
  network,
  graphData,
  colorByLabel,
  hoveredNodeId,
  setHoveredNode,
  graphAreaRef,
  graphRef,
}: GraphCanvasProps) {
  const [graphSize, setGraphSize] = useState<{
    width: number;
    height: number;
  } | null>(null);

  useEffect(() => {
    const areaEl = graphAreaRef.current;
    if (!areaEl) return;

    const updateSize = () => {
      setGraphSize({ width: areaEl.clientWidth, height: areaEl.clientHeight });
    };

    updateSize();

    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            updateSize();
          })
        : null;

    if (resizeObserver) {
      resizeObserver.observe(areaEl);
    }

    window.addEventListener("resize", updateSize);

    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      window.removeEventListener("resize", updateSize);
    };
  }, [graphAreaRef]);

  return (
    <Card
      className="relative flex h-[520px] flex-col overflow-hidden bg-slate-950/70"
      title="Interactive graph"
      subtitle="Pan, zoom, and hover nodes to inspect their relationships"
      contentClassName="flex flex-1 flex-col gap-4 p-0"
    >
      <div
        ref={graphAreaRef}
        className="relative flex flex-1"
        role="application"
        aria-label="Knowledge graph canvas"
      >
        {loading && !network ? (
          <div className="flex flex-1 items-center justify-center">
            <Skeleton className="h-32 w-32" />
          </div>
        ) : !network || graphData.nodes.length === 0 ? (
          <div className="flex flex-1 items-center justify-center text-sm text-slate-400">
            No nodes available yet.
          </div>
        ) : (
          <ForceGraph2D
            ref={graphRef}
            graphData={graphData}
            width={graphSize?.width ?? undefined}
            height={graphSize?.height ?? undefined}
            nodeAutoColorBy="group"
            backgroundColor="#0f172a"
            nodeRelSize={6}
            linkDistance={40}
            linkColor={(link) =>
              edgeColor(link as ForceGraphLink, hoveredNodeId)
            }
            linkWidth={(link) => (hoverHighlights(link, hoveredNodeId) ? 2 : 1)}
            linkDirectionalParticles={hoveredNodeId ? 2 : 0}
            linkDirectionalParticleColor={(link) =>
              edgeColor(link as ForceGraphLink, hoveredNodeId)
            }
            linkDirectionalParticleWidth={(link) =>
              hoverHighlights(link, hoveredNodeId) ? 2 : 0
            }
            linkDirectionalParticleSpeed={0.004}
            cooldownTime={3000}
            enableNodeDrag
            onNodeHover={(node) => {
              if (!node) {
                return;
              }
              const typed = node as ForceGraphNode;
              setHoveredNode(typed);
            }}
            onEngineStop={() => {
              // placeholder hook for future fit behavior
            }}
            nodeCanvasObjectMode={() => "replace"}
            nodeCanvasObject={(node, ctx, globalScale) => {
              renderNodeCanvasObject(
                node as ForceGraphNode & { x: number; y: number },
                ctx,
                globalScale,
                colorByLabel,
                hoveredNodeId,
              );
            }}
            linkCanvasObjectMode={() => "after"}
            linkCanvasObject={(link, ctx, globalScale) => {
              renderLinkLabel(
                link as ForceGraphLink & {
                  source: ForceGraphNode & { x: number; y: number };
                  target: ForceGraphNode & { x: number; y: number };
                },
                ctx,
                globalScale,
              );
            }}
          />
        )}
      </div>
    </Card>
  );
}

function hoverHighlights(
  link: { source: unknown; target: unknown },
  hoveredNodeId: string | null,
): boolean {
  if (!hoveredNodeId) return false;
  const sourceId =
    typeof link.source === "object" && link.source
      ? (link.source as ForceGraphNode).id
      : String(link.source ?? "");
  const targetId =
    typeof link.target === "object" && link.target
      ? (link.target as ForceGraphNode).id
      : String(link.target ?? "");
  return sourceId === hoveredNodeId || targetId === hoveredNodeId;
}

function edgeColor(
  link:
    | ForceGraphLink
    | {
        properties?: Record<string, unknown>;
        source?: unknown;
        target?: unknown;
      },
  hoveredNodeId: string | null,
): string {
  const properties = ((link as ForceGraphLink).properties ?? {}) as {
    provenance?: unknown;
    enriched?: unknown;
    agent_source?: unknown;
  };
  const provenance =
    typeof properties.provenance === "string"
      ? (properties.provenance as string)
      : null;
  const agentSource =
    typeof properties.agent_source === "string"
      ? (properties.agent_source as string).toLowerCase()
      : null;

  let defaultColor = BASE_EDGE_COLOR;
  let highlightedColor = BASE_EDGE_HOVER_COLOR;

  if (provenance === "agent_llm" || agentSource === "llm") {
    defaultColor = AGENT_LLM_EDGE_COLOR;
    highlightedColor = AGENT_LLM_EDGE_HOVER_COLOR;
  } else if (provenance === "agent_heuristic" || agentSource === "heuristic") {
    defaultColor = AGENT_HEURISTIC_EDGE_COLOR;
    highlightedColor = AGENT_HEURISTIC_EDGE_HOVER_COLOR;
  } else if (provenance === "agent" || properties.enriched === true) {
    defaultColor = AGENT_LLM_EDGE_COLOR;
    highlightedColor = AGENT_LLM_EDGE_HOVER_COLOR;
  }

  return hoverHighlights(
    link as { source: unknown; target: unknown },
    hoveredNodeId,
  )
    ? highlightedColor
    : defaultColor;
}

function renderNodeCanvasObject(
  node: ForceGraphNode & { x: number; y: number },
  ctx: CanvasRenderingContext2D,
  globalScale: number,
  colorByLabel: Record<string, string>,
  hoveredNodeId: string | null,
) {
  const color = colorByLabel[node.group] ?? "#94a3b8";
  const isHovered = hoveredNodeId === node.id;
  const radius = isHovered ? 8 : 5;

  ctx.beginPath();
  ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false);
  ctx.fillStyle = color;
  ctx.fill();

  if (globalScale < 2) {
    return;
  }

  const fontSize = 12 / globalScale;
  ctx.font = `${fontSize}px sans-serif`;
  ctx.fillStyle = isHovered ? "#e2e8f0" : "#cbd5f5";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(node.id, node.x + radius + 4, node.y);
}

function renderLinkLabel(
  link: ForceGraphLink & {
    source: ForceGraphNode & { x: number; y: number };
    target: ForceGraphNode & { x: number; y: number };
  },
  ctx: CanvasRenderingContext2D,
  globalScale: number,
) {
  const label = link.type;
  if (!label) return;

  const { source, target } = link;
  if (!source || !target) return;

  if (globalScale < 2) {
    return;
  }

  const midX = (source.x + target.x) / 2;
  const midY = (source.y + target.y) / 2;
  const angle = Math.atan2(target.y - source.y, target.x - source.x);
  let rotation = angle;
  if (rotation > Math.PI / 2 || rotation < -Math.PI / 2) {
    rotation += Math.PI;
  }
  if (rotation > Math.PI) {
    rotation -= 2 * Math.PI;
  }
  if (rotation < -Math.PI) {
    rotation += 2 * Math.PI;
  }

  ctx.save();
  ctx.translate(midX, midY);
  ctx.rotate(rotation);

  const fontSize = 12 / globalScale;
  ctx.font = `${fontSize}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.fillStyle = "rgba(15, 23, 42, 0.65)";
  const textWidth = ctx.measureText(label).width;
  const paddingX = textWidth / 2 + 4;
  const paddingY = fontSize + 4;
  ctx.fillRect(-paddingX, -paddingY, paddingX * 2, paddingY);

  ctx.fillStyle = "#e2e8f0";
  ctx.fillText(label, 0, -4);

  ctx.restore();
}

function NodeInspector({
  hoveredNode,
  hoveredEdges,
  heightLimit,
}: {
  hoveredNode: ForceGraphNode | null;
  hoveredEdges: GraphNetworkEdge[];
  heightLimit: number | null;
}) {
  const heightStyle: CSSProperties | undefined = heightLimit
    ? { maxHeight: heightLimit, height: heightLimit }
    : undefined;

  return (
    <Card
      className="flex min-h-[360px] flex-col overflow-hidden bg-slate-950/70 lg:min-h-0"
      contentClassName="flex flex-1 flex-col overflow-hidden p-0"
      style={heightStyle}
    >
      {hoveredNode ? (
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Badge tone="neutral">{hoveredNode.label}</Badge>
              <span className="text-xs text-slate-400">{hoveredNode.id}</span>
            </div>
            <span className="text-xs text-slate-500">
              Properties {Object.keys(hoveredNode.properties).length}
            </span>
          </div>

          <div className="flex flex-col gap-2">
            {Object.entries(hoveredNode.properties).length === 0 ? (
              <p className="text-sm text-slate-400">No properties stored.</p>
            ) : (
              Object.entries(hoveredNode.properties).map(([key, value]) => (
                <div
                  key={key}
                  className="flex flex-col rounded border border-slate-800/60 bg-slate-900/60 px-3 py-2"
                >
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    {key}
                  </span>
                  <span className="text-sm text-slate-100">
                    {renderNodePropertyValue(hoveredNode.label, key, value)}
                  </span>
                </div>
              ))
            )}
          </div>

          <div className="mb-2 flex flex-col gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Connected edges ({hoveredEdges.length})
            </p>
            {hoveredEdges.length === 0 ? (
              <p className="text-sm text-slate-400">No linked relationships.</p>
            ) : (
              hoveredEdges.map((edge) => (
                <div
                  key={`${edge.type}-${edge.from.id}-${edge.to.id}`}
                  className="rounded border border-slate-800/60 bg-slate-900/60 p-3"
                >
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="text-sm font-semibold text-slate-100">
                      {edge.type}
                    </span>
                    <span className="text-xs text-slate-400">
                      {edge.from.id} → {edge.to.id}
                    </span>
                  </div>
                  {Object.keys(edge.properties).length > 0 && (
                    <div className="mt-2 flex flex-col gap-1">
                      {Object.entries(edge.properties).map(([key, value]) => (
                        <div
                          key={key}
                          className="flex flex-col rounded border border-slate-800/60 bg-slate-950/60 px-2 py-1"
                        >
                          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                            {key}
                          </span>
                          <span className="text-xs text-slate-200">
                            {renderValue(value)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        <div className="px-4 pb-4 pt-4 text-sm text-slate-400">
          Hover a node in the graph to inspect its details.
        </div>
      )}
    </Card>
  );
}
