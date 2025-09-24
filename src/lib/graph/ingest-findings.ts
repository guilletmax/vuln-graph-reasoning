import { createHash } from "node:crypto";
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
  skipped: boolean;
  fingerprint: string;
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

  const fingerprint = hashFindings(findings);
  if (await ingestionAlreadyProcessed(fingerprint)) {
    await shutdownNeo4jDriver();
    return {
      findings: findings.length,
      nodesCreated: 0,
      relationshipsCreated: 0,
      agentSuggestionsApplied: 0,
      skipped: true,
      fingerprint,
    };
  }

  const basePayload = buildGraphPayload(findings);
  const agentEdges = await inferAgentRelationships(findings);

  const enrichedEdges = mergeEdges(basePayload.edges, agentEdges);
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

  await withNeo4jSession(async (session) => {
    await session.run(
      `MERGE (run:IngestionRun {fingerprint: $fingerprint})
       ON CREATE SET run.created_at = datetime(), run.findings = $count
       SET run.last_ingested_at = datetime()`,
      {
        fingerprint,
        count: findings.length,
      },
    );
  });

  await shutdownNeo4jDriver();

  return {
    findings: findings.length,
    nodesCreated: basePayload.nodes.length,
    relationshipsCreated: enrichedEdges.length,
    agentSuggestionsApplied: agentEdges.length,
    skipped: false,
    fingerprint,
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
): Array<GraphEdge & { fromId: string; toId: string }> {
  const seen = new Set<string>();
  const merged: Array<GraphEdge & { fromId: string; toId: string }> = [];

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
    }
    merged.push({
      ...edge,
      fromId: edge.from.id,
      toId: edge.to.id,
      properties: props,
    });
  };

  for (const edge of baseEdges) {
    addEdge(edge, "base");
  }

  for (const edge of agentEdges) {
    addEdge(edge, "agent");
  }

  return merged;
}

function withoutUndefined<T extends Record<string, unknown>>(input: T): T {
  return Object.fromEntries(
    Object.entries(input).filter(
      ([, value]) => value !== undefined && value !== null,
    ),
  ) as T;
}

function hashFindings(findings: FindingRecord[]): string {
  const hasher = createHash("sha256");
  hasher.update(JSON.stringify(findings));
  return hasher.digest("hex");
}

async function ingestionAlreadyProcessed(
  fingerprint: string,
): Promise<boolean> {
  return withNeo4jSession(async (session) => {
    const result = await session.run(
      `MATCH (run:IngestionRun {fingerprint: $fingerprint}) RETURN run LIMIT 1`,
      { fingerprint },
    );
    return result.records.length > 0;
  });
}
