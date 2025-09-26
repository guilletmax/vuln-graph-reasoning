import type {
  AgentExecutedStep,
  AgentPlanStep,
  AgentTool,
} from "@/lib/agents/runtime";
import { executeAgent } from "@/lib/agents/runtime";
import type { FindingRecord, GraphEdge } from "@/lib/models/finding";

const DEFAULT_AGENT_MODEL = process.env.GRAPH_AGENT_MODEL ?? "o4-mini";

export type AgentEdgeSuggestion = GraphEdge;

export type AgentRelationshipInference = {
  edges: AgentEdgeSuggestion[];
  steps: AgentExecutedStep[];
};

export async function inferAgentRelationships(
  findings: FindingRecord[],
): Promise<AgentRelationshipInference> {
  const tools: AgentTool[] = [
    heuristicTool as AgentTool,
    llmTool as AgentTool,
  ];

  const plan: AgentPlanStep[] = [
    { tool: heuristicTool.name, input: { reason: "baseline heuristics" } },
    {
      tool: llmTool.name,
      input: { reason: "liteLLM relationship inference" },
      continueOnError: true,
    },
  ];

  const { result, steps } = await executeAgent<AgentEdgeSuggestion[]>({
    label: "graph-enrichment",
    tools,
    plan,
    context: { findings },
    initialResult: [],
    reducer: (state, step) => {
      if (step.error) {
        return state;
      }
      if (Array.isArray(step.data)) {
        return mergeEdgeLists(state, step.data as AgentEdgeSuggestion[]);
      }
      return state;
    },
  });

  return { edges: result, steps };
}

const heuristicTool: AgentTool<{ reason: string }, AgentEdgeSuggestion[]> = {
  name: "heuristic-relationships",
  description:
    "Generates deterministic relationship suggestions using analytical heuristics (shared service, CVE, scan window).",
  async run({ context }) {
    const findings = (context.findings ?? []) as FindingRecord[];
    const edges = heuristicSuggestions(findings);
    return {
      summary: `Generated ${edges.length} heuristic edge(s).`,
      data: edges,
    };
  },
};

const llmTool: AgentTool<{ reason: string }, AgentEdgeSuggestion[]> = {
  name: "llm-relationship-inference",
  description:
    "Calls LiteLLM to infer novel relationships such as shared root causes, propagation, or ownership overlaps.",
  async run({ context }) {
    const findings = (context.findings ?? []) as FindingRecord[];

    const baseUrl = process.env.LITELLM_BASE_URL;
    const apiKey = process.env.LITELLM_API_KEY;
    if (!baseUrl || !apiKey) {
      return {
        summary: "LiteLLM not configured; skipped LLM enrichment step.",
        data: [],
      };
    }

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
          model: DEFAULT_AGENT_MODEL,
          temperature: 0.2,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content:
                'You are a security knowledge-graph analyst. Given vulnerability findings, infer insightful relationships. Reply as JSON {"edges": AgentEdgeSuggestion[]} where each edge includes type, from {label,id}, to {label,id}, optional properties (confidence, rationale), and rationale string.',
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
      return {
        summary: "LLM returned no content for relationships.",
        data: [],
      };
    }

    try {
      const parsed = JSON.parse(content) as { edges?: AgentEdgeSuggestion[] };
      const edges = Array.isArray(parsed.edges) ? parsed.edges : [];
      const normalized = edges.map((edge) => ({
        ...edge,
        properties: {
          ...(edge.properties ?? {}),
          agent_source:
            typeof edge.properties?.agent_source === "string"
              ? edge.properties.agent_source
              : "llm",
          provenance:
            typeof edge.properties?.provenance === "string"
              ? edge.properties.provenance
              : "agent_llm",
        },
      }));
      return {
        summary: `LLM suggested ${normalized.length} enriched relationship(s).`,
        data: normalized,
      };
    } catch (error) {
      throw new Error(
        `Failed to parse LLM relationship JSON: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  },
};

function mergeEdgeLists(
  existing: AgentEdgeSuggestion[],
  incoming: AgentEdgeSuggestion[],
): AgentEdgeSuggestion[] {
  if (incoming.length === 0) {
    return existing;
  }
  const seen = new Set(
    existing.map((edge) => edgeKey(edge.type, edge.from, edge.to)),
  );
  const merged = [...existing];
  for (const edge of incoming) {
    const key = edgeKey(edge.type, edge.from, edge.to);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(edge);
  }
  return merged;
}

function edgeKey(
  type: string,
  from: { label: string; id: string },
  to: { label: string; id: string },
): string {
  return [
    type.trim().toLowerCase(),
    from.label.trim().toLowerCase(),
    from.id,
    to.label.trim().toLowerCase(),
    to.id,
  ].join("|");
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
      "Propose novel relationships such as shared root causes, dependency propagation, co-occurrence windows, or ownership overlaps. Each edge should include type, from {label,id}, to {label,id}, optional properties (like confidence) and a rationale.",
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
            agent_source: "heuristic",
            provenance: "agent_heuristic",
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
            agent_source: "heuristic",
            provenance: "agent_heuristic",
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
          agent_source: "heuristic",
          provenance: "agent_heuristic",
        },
        rationale: `Findings discovered in scan ${scanId} within the same run.`,
      });
    }
  }

  return suggestions;
}
