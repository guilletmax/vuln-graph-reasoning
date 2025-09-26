import neo4j from "neo4j-driver";
import "@/lib/utils/load-env";
import { withNeo4jSession } from "@/lib/graph/neo4j-client";
import type { AppliedAgentRelationship } from "@/lib/models/finding";

export type OverviewMetrics = {
  totals: {
    findings: number;
    assets: number;
    services: number;
  };
  severity: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  topCwes: Array<{ cweId: string; count: number }>;
  topOwasp: Array<{ owaspId: string; count: number }>;
  scanners: Array<{ name: string; findings: number }>;
  blastRadius: {
    max: number;
    vulnerabilityId: string | null;
    vulnerabilityTitle: string | null;
  };
  patchStatus: {
    patchable: number;
    withoutPatch: number;
  };
  timeRange: {
    firstSeen: string | null;
    lastSeen: string | null;
    days: number | null;
  };
};

export type FindingRow = {
  id: string;
  severity: string;
  title: string | null;
  assetId: string | null;
  assetType: string | null;
  assetUrl: string | null;
  service: string | null;
  scanner: string | null;
  cveId: string | null;
  cweId: string | null;
  owaspId: string | null;
  vector: string | null;
  scanId: string | null;
  timestamp: string | null;
  blastRadius: number;
  hasPatch: boolean;
};

export type GraphNetworkNode = {
  id: string;
  label: string;
  properties: Record<string, unknown>;
};

export type GraphNetworkEdge = {
  type: string;
  from: { id: string; label: string };
  to: { id: string; label: string };
  properties: Record<string, unknown>;
};

export type GraphNetwork = {
  nodes: GraphNetworkNode[];
  edges: GraphNetworkEdge[];
};

export async function fetchOverviewMetrics(): Promise<OverviewMetrics> {
  return withNeo4jSession(async (session) => {
    const totalsRecord = await session.run(
      `MATCH (f:Finding)
       OPTIONAL MATCH (f)-[:FOUND_ON]->(a:Asset)
       OPTIONAL MATCH (a)-[:BELONGS_TO_SERVICE]->(svc:Service)
       RETURN count(DISTINCT f) AS findings,
              count(DISTINCT a) AS assets,
              count(DISTINCT svc) AS services`,
    );
    const totalsRow = totalsRecord.records[0];
    const totals = {
      findings: totalsRow?.get("findings") ?? 0,
      assets: totalsRow?.get("assets") ?? 0,
      services: totalsRow?.get("services") ?? 0,
    };

    const severityResult = await session.run(
      `MATCH (f:Finding)
       RETURN coalesce(f.severity, 'UNKNOWN') AS severity, count(*) AS count`,
    );
    const severityCounts = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const record of severityResult.records) {
      const severity = String(record.get("severity")).toUpperCase();
      const count = record.get("count") as number;
      const key = severity.toLowerCase();
      if (Object.hasOwn(severityCounts, key)) {
        severityCounts[key as keyof typeof severityCounts] = count;
      }
    }

    const topCweResult = await session.run(
      `MATCH (v:Vulnerability)
       WHERE v.cwe_id IS NOT NULL AND trim(v.cwe_id) <> ''
       RETURN v.cwe_id AS cweId, count(*) AS count
       ORDER BY count DESC
       LIMIT 3`,
    );
    const topCwes = topCweResult.records.map((record) => ({
      cweId: record.get("cweId") as string,
      count: record.get("count") as number,
    }));

    const topOwaspResult = await session.run(
      `MATCH (v:Vulnerability)
       WHERE v.owasp_id IS NOT NULL AND trim(v.owasp_id) <> ''
       RETURN v.owasp_id AS owaspId, count(*) AS count
       ORDER BY count DESC
       LIMIT 3`,
    );
    const topOwasp = topOwaspResult.records.map((record) => ({
      owaspId: record.get("owaspId") as string,
      count: record.get("count") as number,
    }));

    const scannerResult = await session.run(
      `MATCH (f:Finding)-[:GENERATED_BY]->(s:Scanner)
       RETURN s.name AS name, count(*) AS findings
       ORDER BY findings DESC
       LIMIT 5`,
    );
    const scanners = scannerResult.records.map((record) => ({
      name: record.get("name") as string,
      findings: record.get("findings") as number,
    }));

    const blastResult = await session.run(
      `MATCH (v:Vulnerability)-[:AFFECTS]->(a:Asset)
       WITH v, count(DISTINCT a) AS affected
       ORDER BY affected DESC
       RETURN affected AS max,
              coalesce(v.cve_id, v.cwe_id, v.owasp_id) AS vulnerabilityId,
              v.title AS title
       LIMIT 1`,
    );
    const blastRow = blastResult.records[0];
    const blastRadius = {
      max: blastRow?.get("max") ?? 0,
      vulnerabilityId: (blastRow?.get("vulnerabilityId") as string) ?? null,
      vulnerabilityTitle: (blastRow?.get("title") as string) ?? null,
    };

    const patchResult = await session.run(
      `MATCH (f:Finding)
       OPTIONAL MATCH (f)-[:FOUND_ON]->(:Asset)-[:USES_PACKAGE]->(pkg:Package)
       WITH f, collect(DISTINCT pkg) AS pkgs
       RETURN sum(CASE WHEN size(pkgs) > 0 THEN 1 ELSE 0 END) AS patchable,
              sum(CASE WHEN size(pkgs) = 0 THEN 1 ELSE 0 END) AS withoutPatch`,
    );
    const patchRow = patchResult.records[0];
    const patchStatus = {
      patchable: patchRow?.get("patchable") ?? 0,
      withoutPatch: patchRow?.get("withoutPatch") ?? 0,
    };

    const timeRangeResult = await session.run(
      `MATCH (f:Finding)
       RETURN min(datetime(f.timestamp)) AS firstSeen,
              max(datetime(f.timestamp)) AS lastSeen`,
    );
    const timeRow = timeRangeResult.records[0];
    const firstSeenValue = timeRow?.get("firstSeen");
    const lastSeenValue = timeRow?.get("lastSeen");
    const firstSeen = firstSeenValue ? firstSeenValue.toString() : null;
    const lastSeen = lastSeenValue ? lastSeenValue.toString() : null;
    const days =
      firstSeen && lastSeen
        ? Math.max(
            0,
            Math.round(
              (new Date(lastSeen).getTime() - new Date(firstSeen).getTime()) /
                (1000 * 60 * 60 * 24),
            ),
          )
        : null;

    return {
      totals,
      severity: severityCounts,
      topCwes,
      topOwasp,
      scanners,
      blastRadius,
      patchStatus,
      timeRange: {
        firstSeen,
        lastSeen,
        days,
      },
    };
  });
}

export async function fetchFindings(): Promise<FindingRow[]> {
  return withNeo4jSession(async (session) => {
    const result = await session.run(
      `MATCH (f:Finding)-[:FOUND_ON]->(asset:Asset)
       OPTIONAL MATCH (f)-[:REPORTS]->(v:Vulnerability)
       OPTIONAL MATCH (f)-[:GENERATED_BY]->(scanner:Scanner)
       OPTIONAL MATCH (asset)-[:BELONGS_TO_SERVICE]->(service:Service)
       OPTIONAL MATCH (v)-[:AFFECTS]->(affected:Asset)
       OPTIONAL MATCH (asset)-[:USES_PACKAGE]->(pkg:Package)
       WITH f, asset, v, scanner, service,
            count(DISTINCT affected) AS blastRadius,
            size(collect(DISTINCT pkg)) AS packageCount
       RETURN f.finding_id AS id,
              f.severity AS severity,
              v.title AS title,
              asset.id AS assetId,
              asset.type AS assetType,
              asset.url AS assetUrl,
              service.name AS service,
              scanner.name AS scanner,
              v.cve_id AS cveId,
              v.cwe_id AS cweId,
              v.owasp_id AS owaspId,
              v.vector AS vector,
              f.scan_id AS scanId,
              f.timestamp AS timestamp,
              blastRadius AS blastRadius,
              packageCount > 0 AS hasPatch
       ORDER BY
         CASE f.severity
           WHEN 'CRITICAL' THEN 0
           WHEN 'HIGH' THEN 1
           WHEN 'MEDIUM' THEN 2
           WHEN 'LOW' THEN 3
           ELSE 4
         END,
         datetime(f.timestamp) DESC`,
    );

    return result.records.map((record) => ({
      id: record.get("id") as string,
      severity: (record.get("severity") as string) ?? "UNKNOWN",
      title: (record.get("title") as string) ?? null,
      assetId: (record.get("assetId") as string) ?? null,
      assetType: (record.get("assetType") as string) ?? null,
      assetUrl: (record.get("assetUrl") as string) ?? null,
      service: (record.get("service") as string) ?? null,
      scanner: (record.get("scanner") as string) ?? null,
      cveId: (record.get("cveId") as string) ?? null,
      cweId: (record.get("cweId") as string) ?? null,
      owaspId: (record.get("owaspId") as string) ?? null,
      vector: (record.get("vector") as string) ?? null,
      scanId: (record.get("scanId") as string) ?? null,
      timestamp: (record.get("timestamp") as string) ?? null,
      blastRadius: record.get("blastRadius") ?? 0,
      hasPatch: record.get("hasPatch") ?? false,
    }));
  });
}

type FetchGraphNetworkOptions = {
  nodeLimit?: number;
  edgeLimit?: number;
};

export async function fetchGraphNetwork(
  options: FetchGraphNetworkOptions = {},
): Promise<GraphNetwork> {
  const hasNodeLimit = options.nodeLimit !== undefined;
  const hasEdgeLimit = options.edgeLimit !== undefined;
  const nodeLimitParam = hasNodeLimit
    ? neo4j.int(Math.max(0, Math.floor(options.nodeLimit ?? 0)))
    : undefined;
  const edgeLimitParam = hasEdgeLimit
    ? neo4j.int(Math.max(0, Math.floor(options.edgeLimit ?? 0)))
    : undefined;

  return withNeo4jSession(async (session) => {
    const nodeCypher = hasNodeLimit
      ? `MATCH (n)
         RETURN labels(n) AS labels,
                coalesce(n.id, id(n)) AS id,
                properties(n) AS props
         LIMIT $nodeLimit`
      : `MATCH (n)
         RETURN labels(n) AS labels,
                coalesce(n.id, id(n)) AS id,
                properties(n) AS props`;

    const nodeResult = await session.run(nodeCypher, {
      ...(hasNodeLimit ? { nodeLimit: nodeLimitParam } : {}),
    });

    const edgeCypher = hasEdgeLimit
      ? `MATCH (from)-[r]->(to)
         RETURN type(r) AS type,
                labels(from) AS fromLabels,
                coalesce(from.id, id(from)) AS fromId,
                labels(to) AS toLabels,
                coalesce(to.id, id(to)) AS toId,
                properties(r) AS props
         LIMIT $edgeLimit`
      : `MATCH (from)-[r]->(to)
         RETURN type(r) AS type,
                labels(from) AS fromLabels,
                coalesce(from.id, id(from)) AS fromId,
                labels(to) AS toLabels,
                coalesce(to.id, id(to)) AS toId,
                properties(r) AS props`;

    const edgeResult = await session.run(edgeCypher, {
      ...(hasEdgeLimit ? { edgeLimit: edgeLimitParam } : {}),
    });

    const nodes: GraphNetworkNode[] = nodeResult.records.map((record) => {
      const labels = (record.get("labels") as string[]) ?? [];
      const label = labels[0] ?? "Node";
      const id = String(record.get("id"));
      const props = record.get("props") as Record<string, unknown>;
      return {
        id,
        label,
        properties: normalizeProperties(props ?? {}),
      };
    });

    const edges: GraphNetworkEdge[] = edgeResult.records.map((record) => {
      const fromLabels = (record.get("fromLabels") as string[]) ?? [];
      const toLabels = (record.get("toLabels") as string[]) ?? [];
      const props = record.get("props") as Record<string, unknown>;
      return {
        type: String(record.get("type")),
        from: {
          id: String(record.get("fromId")),
          label: fromLabels[0] ?? "Node",
        },
        to: {
          id: String(record.get("toId")),
          label: toLabels[0] ?? "Node",
        },
        properties: normalizeProperties(props ?? {}),
      };
    });

    return { nodes, edges };
  });
}

export async function fetchAgentEdges(): Promise<AppliedAgentRelationship[]> {
  return withNeo4jSession(async (session) => {
    const result = await session.run(
      `MATCH (from)-[r]->(to)
       WHERE coalesce(r.provenance, 'base') = 'agent' OR r.enriched = true
       RETURN type(r) AS type,
              labels(from) AS fromLabels,
              coalesce(from.id, id(from)) AS fromId,
              labels(to) AS toLabels,
              coalesce(to.id, id(to)) AS toId,
              properties(r) AS props
       ORDER BY type(r), fromId, toId`,
    );

    return result.records.map((record) => {
      const fromLabels = (record.get("fromLabels") as string[]) ?? [];
      const toLabels = (record.get("toLabels") as string[]) ?? [];
      const rawProps =
        (record.get("props") as Record<string, unknown> | null) ?? {};
      const normalizedProps = normalizeProperties(rawProps);
      const properties: Record<string, unknown> = {
        ...normalizedProps,
      };

      if (
        typeof properties.provenance !== "string" ||
        properties.provenance.length === 0
      ) {
        properties.provenance = "agent";
      }
      if (
        typeof properties.agent_source !== "string" ||
        properties.agent_source.length === 0
      ) {
        properties.agent_source =
          properties.provenance === "agent_heuristic"
            ? "heuristic"
            : properties.provenance === "agent_llm"
              ? "llm"
              : "agent";
      }
      if (properties.enriched !== true) {
        properties.enriched = true;
      }

      let rationale: string | undefined;
      if (typeof properties.rationale === "string") {
        rationale = properties.rationale as string;
      }

      return {
        type: String(record.get("type")),
        from: {
          id: String(record.get("fromId")),
          label: fromLabels[0] ?? "Node",
        },
        to: {
          id: String(record.get("toId")),
          label: toLabels[0] ?? "Node",
        },
        properties,
        rationale,
      } satisfies AppliedAgentRelationship;
    });
  });
}

function normalizeProperties(
  input: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(input).map(([key, value]) => [key, normalizeValue(value)]),
  );
}

function normalizeValue(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof value === "string" || typeof value === "number") {
    return value;
  }
  if (typeof value === "boolean") {
    return value;
  }
  if (neo4j.isInt(value as neo4j.Integer)) {
    return (value as neo4j.Integer).toNumber();
  }
  if (Array.isArray(value)) {
    return value.map((item) => normalizeValue(item));
  }
  if (
    value instanceof neo4j.types.DateTime ||
    value instanceof neo4j.types.LocalDateTime ||
    value instanceof neo4j.types.Date
  ) {
    return value.toString();
  }
  if (
    value instanceof neo4j.types.Time ||
    value instanceof neo4j.types.LocalTime ||
    value instanceof neo4j.types.Duration
  ) {
    return value.toString();
  }
  if (typeof value === "object") {
    return normalizeProperties(value as Record<string, unknown>);
  }
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (_error) {
    return String(value);
  }
}
