export type FindingRecord = {
  finding_id: string;
  scanner: string;
  scan_id: string;
  timestamp: string;
  vulnerability: {
    owasp_id: string;
    cwe_id: string;
    cve_id?: string;
    title: string;
    severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | string;
    description: string;
    vector: string;
  };
  asset: {
    type:
      | "api_endpoint"
      | "web_route"
      | "source_file"
      | "container_image"
      | string;
    url?: string;
    path?: string;
    image?: string;
    registry?: string;
    service?: string;
    cluster?: string;
    repo?: string;
  };
  package?: {
    ecosystem: string;
    name: string;
    version: string;
  };
};

export type GraphNode = {
  id: string;
  label: string;
  properties: Record<string, unknown>;
};

export type GraphEdge = {
  type: string;
  from: { label: string; id: string };
  to: { label: string; id: string };
  properties?: Record<string, unknown>;
  rationale?: string;
};
