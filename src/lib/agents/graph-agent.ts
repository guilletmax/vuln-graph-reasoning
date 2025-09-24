import type { FindingRecord, GraphEdge } from "@/lib/models/finding";

const DEFAULT_AGENT_MODEL = process.env.GRAPH_AGENT_MODEL ?? "gpt-4o-mini";

export type AgentEdgeSuggestion = GraphEdge;

export async function inferAgentRelationships(
  findings: FindingRecord[],
): Promise<AgentEdgeSuggestion[]> {
  if (process.env.LITELLM_BASE_URL && process.env.LITELLM_API_KEY) {
    try {
      return await callLiteLLMAgent(findings);
    } catch (error) {
      console.warn(
        "Graph agent call failed, falling back to heuristics",
        error,
      );
    }
  }

  return heuristicSuggestions(findings);
}

async function callLiteLLMAgent(
  findings: FindingRecord[],
): Promise<AgentEdgeSuggestion[]> {
  const baseUrl = process.env.LITELLM_BASE_URL as string;
  const apiKey = process.env.LITELLM_API_KEY as string;
  const model = DEFAULT_AGENT_MODEL;

  const prompt = buildPrompt(findings);
  const response = await fetch(
    `${baseUrl.replace(/\/$/, "")}/chat/completions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              'You are a security graph analyst. Given vulnerability findings, infer additional graph relationships. Reply as JSON with {"edges": AgentEdgeSuggestion[]}',
          },
          { role: "user", content: prompt },
        ],
      }),
    },
  );

  if (!response.ok) {
    throw new Error(
      `LiteLLM request failed: ${response.status} ${response.statusText}`,
    );
  }

  const json = (await response.json()) as {
    choices: Array<{ message: { content: string } }>;
  };

  const content = json.choices?.[0]?.message?.content;
  if (!content) {
    return [];
  }

  try {
    const parsed = JSON.parse(content) as { edges?: AgentEdgeSuggestion[] };
    return parsed.edges ?? [];
  } catch (error) {
    console.warn("Failed to parse agent JSON", error);
    return [];
  }
}

function buildPrompt(findings: FindingRecord[]): string {
  const compact = findings.map((finding) => ({
    id: finding.finding_id,
    vulnerability: finding.vulnerability,
    asset: finding.asset,
    package: finding.package,
    service: finding.asset.service,
    timestamp: finding.timestamp,
  }));

  return JSON.stringify({
    instructions:
      "Propose novel relationships such as shared root causes, co-occurrence windows, dependency propagation, or ownership overlaps. Each edge should include type, from {label,id}, to {label,id}, optional properties (like confidence, rationale), and rationale string.",
    findings: compact,
  });
}

function heuristicSuggestions(
  findings: FindingRecord[],
): AgentEdgeSuggestion[] {
  const suggestions: AgentEdgeSuggestion[] = [];

  const findingsByService = new Map<string, FindingRecord[]>();
  const findingsByCve = new Map<string, FindingRecord[]>();
  const findingsByScan = new Map<string, FindingRecord[]>();

  for (const finding of findings) {
    if (finding.asset.service) {
      const list = findingsByService.get(finding.asset.service) ?? [];
      list.push(finding);
      findingsByService.set(finding.asset.service, list);
    }
    if (finding.vulnerability.cve_id) {
      const list = findingsByCve.get(finding.vulnerability.cve_id) ?? [];
      list.push(finding);
      findingsByCve.set(finding.vulnerability.cve_id, list);
    }
    const scanList = findingsByScan.get(finding.scan_id) ?? [];
    scanList.push(finding);
    findingsByScan.set(finding.scan_id, scanList);
  }

  for (const [service, list] of findingsByService) {
    if (list.length < 2) continue;
    for (let i = 0; i < list.length; i += 1) {
      for (let j = i + 1; j < list.length; j += 1) {
        suggestions.push({
          type: "SHARED_SERVICE",
          from: { label: "Finding", id: list[i].finding_id },
          to: { label: "Finding", id: list[j].finding_id },
          properties: {
            service,
            confidence: 0.6,
          },
          rationale: `Both findings impact service ${service}.`,
        });
      }
    }
  }

  for (const [cve, list] of findingsByCve) {
    if (list.length < 2) continue;
    for (let i = 0; i < list.length; i += 1) {
      for (let j = i + 1; j < list.length; j += 1) {
        suggestions.push({
          type: "SHARED_CVE",
          from: { label: "Finding", id: list[i].finding_id },
          to: { label: "Finding", id: list[j].finding_id },
          properties: {
            cve,
            confidence: 0.7,
          },
          rationale: `Both findings reference ${cve}.`,
        });
      }
    }
  }

  for (const [scanId, list] of findingsByScan) {
    if (list.length < 2) continue;
    const sorted = [...list].sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );
    for (let i = 0; i < sorted.length - 1; i += 1) {
      const current = sorted[i];
      const next = sorted[i + 1];
      const delta =
        new Date(next.timestamp).getTime() -
        new Date(current.timestamp).getTime();
      suggestions.push({
        type: "CO_OCCURS",
        from: { label: "Finding", id: current.finding_id },
        to: { label: "Finding", id: next.finding_id },
        properties: {
          scan_id: scanId,
          delta_minutes: Math.round(delta / 60000),
        },
        rationale: `Findings discovered in scan ${scanId} within the same run.`,
      });
    }
  }

  return suggestions;
}
