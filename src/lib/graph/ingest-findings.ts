import fs from "node:fs/promises";
import path from "node:path";
import type { AgentEdgeSuggestion } from "@/lib/agents/graph-agent";
import { inferAgentRelationships } from "@/lib/agents/graph-agent";
import { buildGraphPayload } from "@/lib/graph/build-graph";
import {
  shutdownNeo4jDriver,
  withNeo4jSession,
} from "@/lib/graph/neo4j-client";
import type { FindingRecord, GraphEdge } from "@/lib/models/finding";

export type IngestionResult = {
  findings: number;
  nodesCreated: number;
  relationshipsCreated: number;
  agentSuggestionsApplied: number;
  provenance: {
    base: { nodes: number; relationships: number };
    agent: { nodes: number; relationships: number };
  };
  skipped: boolean;
};

export async function ingestFindingsFromFile(
  filePath: string,
): Promise<IngestionResult> {
  const absolute = path.isAbsolute(filePath)
    ? filePath
    : path.join(process.cwd(), filePath);
  const raw = await fs.readFile(absolute, "utf-8");
  const parsed = JSON.parse(raw) as FindingRecord[];

  return ingestFindings(parsed);
}

export async function ingestFindings(
  findings: FindingRecord[],
): Promise<IngestionResult> {
  if (findings.length === 0) {
    throw new Error("No findings provided for ingestion");
  }

  const basePayload = buildGraphPayload(findings);
  const agentEdges = await inferAgentRelationships(findings);

  await resetGraphSnapshot();

  const { edges: enrichedEdges, counts: relationshipCounts } = mergeEdges(
    basePayload.edges,
    agentEdges,
  );
  const groupedNodes = groupByLabel(basePayload.nodes);
  const groupedEdges = groupEdgesByLabel(enrichedEdges);

  await withNeo4jSession(async (session) => {
    for (const [label, nodes] of groupedNodes.entries()) {
      await session.run(
        `UNWIND $nodes AS node
         MERGE (n:${label} {id: node.id})
         SET n += node.props`,
        {
          nodes: nodes.map((node) => ({
            id: node.id,
            props: withoutUndefined(node.properties),
          })),
        },
      );
    }

    for (const [edgeKey, edges] of groupedEdges.entries()) {
      const [type, fromLabel, toLabel] = edgeKey.split("|");
      await session.run(
        `UNWIND $edges AS edge
         MATCH (from:${fromLabel} {id: edge.fromId})
         MATCH (to:${toLabel} {id: edge.toId})
         MERGE (from)-[r:${type}]->(to)
         SET r += edge.props`,
        {
          edges: edges.map((edge) => ({
            fromId: edge.fromId,
            toId: edge.toId,
            props: withoutUndefined(edge.properties ?? {}),
          })),
        },
      );
    }
  });

  await shutdownNeo4jDriver();

  return {
    findings: findings.length,
    nodesCreated: basePayload.nodes.length,
    relationshipsCreated: enrichedEdges.length,
    agentSuggestionsApplied: relationshipCounts.agent,
    provenance: {
      base: {
        nodes: basePayload.nodes.length,
        relationships: relationshipCounts.base,
      },
      agent: {
        nodes: 0,
        relationships: relationshipCounts.agent,
      },
    },
    skipped: false,
  };
}

function groupByLabel(
  nodes: ReturnType<typeof buildGraphPayload>["nodes"],
): Map<string, typeof nodes> {
  const grouped = new Map<string, typeof nodes>();
  for (const node of nodes) {
    const list = grouped.get(node.label) ?? [];
    list.push(node);
    grouped.set(node.label, list);
  }
  return grouped;
}

function groupEdgesByLabel(
  edges: Array<GraphEdge & { fromId: string; toId: string }>,
): Map<
  string,
  Array<{ fromId: string; toId: string; properties?: Record<string, unknown> }>
> {
  const grouped = new Map<
    string,
    Array<{
      fromId: string;
      toId: string;
      properties?: Record<string, unknown>;
    }>
  >();
  for (const edge of edges) {
    const key = `${edge.type}|${edge.from.label}|${edge.to.label}`;
    const list = grouped.get(key) ?? [];
    list.push({
      fromId: edge.fromId,
      toId: edge.toId,
      properties: edge.properties,
    });
    grouped.set(key, list);
  }
  return grouped;
}

function mergeEdges(
  baseEdges: GraphEdge[],
  agentEdges: AgentEdgeSuggestion[],
): {
  edges: Array<GraphEdge & { fromId: string; toId: string }>;
  counts: { base: number; agent: number };
} {
  const seen = new Set<string>();
  const merged: Array<GraphEdge & { fromId: string; toId: string }> = [];
  let baseCount = 0;
  let agentCount = 0;

  const addEdge = (edge: GraphEdge, source: "base" | "agent") => {
    const key = `${edge.type}|${edge.from.label}|${edge.from.id}|${edge.to.label}|${edge.to.id}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    const props = { ...(edge.properties ?? {}) };
    if (source === "agent") {
      if (edge.rationale) {
        props.rationale = edge.rationale;
      }
      props.provenance = "agent";
      props.enriched = true;
    }
    props.provenance = props.provenance ?? "base";
    props.enriched = props.enriched ?? false;
    merged.push({
      ...edge,
      fromId: edge.from.id,
      toId: edge.to.id,
      properties: props,
    });
    if (source === "agent") {
      agentCount += 1;
    } else {
      baseCount += 1;
    }
  };

  for (const edge of baseEdges) {
    addEdge(edge, "base");
  }

  for (const edge of agentEdges) {
    addEdge(edge, "agent");
  }

  return {
    edges: merged,
    counts: {
      base: baseCount,
      agent: agentCount,
    },
  };
}

function withoutUndefined<T extends Record<string, unknown>>(input: T): T {
  return Object.fromEntries(
    Object.entries(input).filter(
      ([, value]) => value !== undefined && value !== null,
    ),
  ) as T;
}

async function resetGraphSnapshot(): Promise<void> {
  await withNeo4jSession(async (session) => {
    await session.run(`MATCH (n) DETACH DELETE n`);
  });
}
