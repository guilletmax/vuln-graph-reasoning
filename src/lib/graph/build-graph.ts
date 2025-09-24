import type { FindingRecord, GraphEdge, GraphNode } from "@/lib/models/finding";

export type GraphPayload = {
  nodes: GraphNode[];
  edges: GraphEdge[];
};

export function buildGraphPayload(findings: FindingRecord[]): GraphPayload {
  const nodeMap = new Map<string, GraphNode>();
  const edges: GraphEdge[] = [];

  for (const finding of findings) {
    const findingNode = ensureNode(nodeMap, {
      label: "Finding",
      id: finding.finding_id,
      properties: {
        scanner: finding.scanner,
        scan_id: finding.scan_id,
        timestamp: finding.timestamp,
        severity: finding.vulnerability.severity,
        title: finding.vulnerability.title,
        vector: finding.vulnerability.vector,
      },
    });

    const scanNode = ensureNode(nodeMap, {
      label: "Scan",
      id: finding.scan_id,
      properties: {
        scanner: finding.scanner,
        occurred_at: finding.timestamp,
      },
    });

    const scannerNode = ensureNode(nodeMap, {
      label: "Scanner",
      id: finding.scanner,
      properties: {
        name: finding.scanner,
      },
    });

    const vulnerabilityId =
      finding.vulnerability.cve_id ??
      finding.vulnerability.cwe_id ??
      finding.vulnerability.owasp_id;

    const vulnerabilityNode = ensureNode(nodeMap, {
      label: "Vulnerability",
      id: vulnerabilityId,
      properties: {
        cve_id: finding.vulnerability.cve_id,
        cwe_id: finding.vulnerability.cwe_id,
        owasp_id: finding.vulnerability.owasp_id,
        severity: finding.vulnerability.severity,
        title: finding.vulnerability.title,
        description: finding.vulnerability.description,
        vector: finding.vulnerability.vector,
      },
    });

    const assetId = deriveAssetId(finding);
    const assetNode = ensureNode(nodeMap, {
      label: "Asset",
      id: assetId,
      properties: {
        type: finding.asset.type,
        url: finding.asset.url,
        path: finding.asset.path,
        image: finding.asset.image,
        registry: finding.asset.registry,
        service: finding.asset.service,
        cluster: finding.asset.cluster,
      },
    });

    edges.push(
      createEdge("REPORTS", findingNode, vulnerabilityNode),
      createEdge("FOUND_ON", findingNode, assetNode),
      createEdge("GENERATED_BY", findingNode, scannerNode),
      createEdge("PART_OF_SCAN", findingNode, scanNode),
      createEdge("SCANNED_BY", scanNode, scannerNode),
      createEdge("AFFECTS", vulnerabilityNode, assetNode),
    );

    if (finding.asset.service) {
      const serviceNode = ensureNode(nodeMap, {
        label: "Service",
        id: finding.asset.service,
        properties: { name: finding.asset.service },
      });
      edges.push(
        createEdge("BELONGS_TO_SERVICE", assetNode, serviceNode),
        createEdge("IMPACTS_SERVICE", vulnerabilityNode, serviceNode),
      );
    }

    if (finding.asset.cluster) {
      const clusterNode = ensureNode(nodeMap, {
        label: "Cluster",
        id: finding.asset.cluster,
        properties: { name: finding.asset.cluster },
      });
      edges.push(createEdge("DEPLOYED_ON", assetNode, clusterNode));
    }

    if (finding.asset.registry) {
      const registryNode = ensureNode(nodeMap, {
        label: "Registry",
        id: finding.asset.registry,
        properties: { name: finding.asset.registry },
      });
      edges.push(createEdge("PUBLISHED_TO", assetNode, registryNode));
    }

    if (finding.asset.repo) {
      const repoNode = ensureNode(nodeMap, {
        label: "Repository",
        id: finding.asset.repo,
        properties: { url: finding.asset.repo },
      });
      edges.push(createEdge("TRACKED_IN", assetNode, repoNode));
    }

    if (finding.asset.type === "source_file" && finding.asset.path) {
      const fileNode = ensureNode(nodeMap, {
        label: "SourceFile",
        id: finding.asset.path,
        properties: {
          path: finding.asset.path,
        },
      });
      edges.push(createEdge("CONTAINS_FILE", assetNode, fileNode));
    }

    if (finding.package) {
      const packageNode = ensureNode(nodeMap, {
        label: "Package",
        id: `${finding.package.ecosystem}:${finding.package.name}@${finding.package.version}`,
        properties: {
          ecosystem: finding.package.ecosystem,
          name: finding.package.name,
          version: finding.package.version,
        },
      });
      edges.push(
        createEdge("USES_PACKAGE", assetNode, packageNode),
        createEdge("ASSOCIATED_WITH", packageNode, vulnerabilityNode),
      );
    }
  }

  return {
    nodes: [...nodeMap.values()],
    edges,
  };
}

function ensureNode(map: Map<string, GraphNode>, node: GraphNode): GraphNode {
  const compositeId = `${node.label}:${node.id}`;
  const existing = map.get(compositeId);
  if (!existing) {
    map.set(compositeId, node);
    return node;
  }

  existing.properties = { ...existing.properties, ...node.properties };
  return existing;
}

function createEdge(
  type: string,
  from: GraphNode,
  to: GraphNode,
  properties?: Record<string, unknown>,
): GraphEdge {
  return {
    type,
    from: { label: from.label, id: from.id },
    to: { label: to.label, id: to.id },
    properties,
  };
}

function deriveAssetId(finding: FindingRecord): string {
  if (finding.asset.image) return `image:${finding.asset.image}`;
  if (finding.asset.url) return finding.asset.url;
  if (finding.asset.path) return `file:${finding.asset.path}`;
  return `${finding.asset.type}:${finding.asset.service ?? "unknown"}`;
}
