import neo4j from "neo4j-driver";
import type {
  AgentExecutedStep,
  AgentPlanStep,
  AgentTool,
} from "@/lib/agents/runtime";
import { executeAgent } from "@/lib/agents/runtime";
import { withNeo4jSession } from "@/lib/graph/neo4j-client";

const DEFAULT_CHAT_MODEL = process.env.CHAT_AGENT_MODEL ?? "o4-mini";

export type ChatAgentFinding = {
  id: string;
  title: string | null;
  severity: string | null;
  service: string | null;
  timestamp: string | null;
};

export type ChatAgentInsight = {
  title: string;
  detail: string;
  citations?: string[];
};

export type ChatAgentResult = {
  answer: string;
  citations: string[];
  findings: ChatAgentFinding[];
  insights: ChatAgentInsight[];
  steps: AgentExecutedStep[];
};

type ChatAgentState = {
  findings: ChatAgentFinding[];
  answer: string;
  citations: string[];
  insights: ChatAgentInsight[];
};

export async function runChatAgent(input: {
  question: string;
  model?: string;
  limit?: number;
}): Promise<ChatAgentResult> {
  const question = input.question.trim();
  if (!question) {
    return {
      answer: "I need a question to analyze the knowledge graph.",
      citations: [],
      findings: [],
      steps: [],
    };
  }

  const tools: AgentTool[] = [
    graphRetrievalTool,
    riskRankingTool,
    relationshipDigestTool,
    synthesisTool,
  ];

  const plan: AgentPlanStep[] = [
    {
      tool: graphRetrievalTool.name,
      input: {
        question,
        limit: input.limit ?? 6,
      },
      continueOnError: true,
    },
    {
      tool: riskRankingTool.name,
      input: {
        limit: input.limit ?? 6,
      },
      continueOnError: true,
    },
    {
      tool: relationshipDigestTool.name,
      input: {
        limit: input.limit ?? 10,
      },
      continueOnError: true,
    },
    {
      tool: synthesisTool.name,
      input: {
        question,
        model: input.model ?? DEFAULT_CHAT_MODEL,
      },
      continueOnError: true,
    },
  ];

  const initialState: ChatAgentState = {
    findings: [],
    answer: "",
    citations: [],
    insights: [],
  };

  const { result, steps } = await executeAgent<ChatAgentState>({
    label: "chat-agent",
    tools,
    plan,
    context: {},
    initialResult: initialState,
    reducer: (state, step) => {
      if (step.error) {
        return state;
      }
      if (Array.isArray(step.data)) {
        const array = step.data as unknown[];
        const looksLikeFinding =
          array.length === 0 || typeof array[0] === "object";
        if (looksLikeFinding) {
          return {
            ...state,
            findings: array as ChatAgentFinding[],
          };
        }
        return state;
      }
      if (step.data && typeof step.data === "object") {
        const data = step.data as Partial<ChatAgentState> & {
          citations?: string[];
          insights?: ChatAgentInsight[];
        };
        return {
          ...state,
          answer: typeof data.answer === "string" ? data.answer : state.answer,
          citations: Array.isArray(data.citations)
            ? mergeCitations(state.citations, data.citations as string[])
            : state.citations,
          insights: Array.isArray(data.insights)
            ? mergeInsights(state.insights, data.insights as ChatAgentInsight[])
            : state.insights,
        };
      }
      return state;
    },
  });

  if (!result.answer) {
    const fallback = buildFallbackAnswer(question, result.findings);
    return {
      answer: fallback.text,
      citations: fallback.citations,
      findings: result.findings,
      insights: result.insights,
      steps,
    };
  }

  return {
    answer: result.answer,
    citations: result.citations,
    findings: result.findings,
    insights: result.insights,
    steps,
  };
}

const graphRetrievalTool: AgentTool<
  { question: string; limit: number },
  ChatAgentFinding[]
> = {
  name: "graph-retrieval",
  description:
    "Searches the knowledge graph for findings related to the question using keyword matching and severity weighting.",
  async run({ input }) {
    const keywords = extractKeywords(input.question);
    const limitValue = Math.max(1, Math.floor(input.limit ?? 6));
    const limit = neo4j.int(limitValue);

    const findings = await withNeo4jSession(async (session) => {
      if (keywords.length === 0) {
        const result = await session.run(
          `MATCH (f:Finding)
           OPTIONAL MATCH (f)-[:FOUND_ON]->(a:Asset)
           RETURN f.id AS id,
                  coalesce(f.title, f.id) AS title,
                  coalesce(f.severity, 'UNKNOWN') AS severity,
                  a.service AS service,
                  f.timestamp AS timestamp
           ORDER BY CASE upper(coalesce(f.severity, 'LOW'))
             WHEN 'CRITICAL' THEN 0
             WHEN 'HIGH' THEN 1
             WHEN 'MEDIUM' THEN 2
             WHEN 'LOW' THEN 3
             ELSE 4
           END,
           timestamp DESC
           LIMIT $limit`,
          { limit },
        );
        return result.records.map((record) => ({
          id: record.get("id") as string,
          title: record.get("title") as string | null,
          severity: record.get("severity") as string | null,
          service: (record.get("service") as string | null) ?? null,
          timestamp: (record.get("timestamp") as string | null) ?? null,
        }));
      }

      const result = await session.run(
        `MATCH (f:Finding)
         OPTIONAL MATCH (f)-[:FOUND_ON]->(a:Asset)
         WITH f, a,
              [keyword IN $keywords WHERE keyword <> '' AND (toLower(coalesce(f.title, '')) CONTAINS keyword OR toLower(coalesce(f.severity, '')) = keyword OR toLower(coalesce(a.service, '')) = keyword)] AS matched
         WHERE size(matched) > 0
         RETURN f.id AS id,
                coalesce(f.title, f.id) AS title,
                coalesce(f.severity, 'UNKNOWN') AS severity,
                a.service AS service,
                f.timestamp AS timestamp,
                size(matched) AS score
         ORDER BY score DESC, timestamp DESC
         LIMIT $limit`,
        {
          keywords,
          limit,
        },
      );
      let rows = result.records.map((record) => ({
        id: record.get("id") as string,
        title: record.get("title") as string | null,
        severity: record.get("severity") as string | null,
        service: (record.get("service") as string | null) ?? null,
        timestamp: (record.get("timestamp") as string | null) ?? null,
      }));
      if (rows.length === 0) {
        const fallback = await session.run(
          `MATCH (f:Finding)
           OPTIONAL MATCH (f)-[:FOUND_ON]->(a:Asset)
           RETURN f.id AS id,
                  coalesce(f.title, f.id) AS title,
                  coalesce(f.severity, 'UNKNOWN') AS severity,
                  a.service AS service,
                  f.timestamp AS timestamp
           ORDER BY CASE upper(coalesce(f.severity, 'LOW'))
             WHEN 'CRITICAL' THEN 0
             WHEN 'HIGH' THEN 1
             WHEN 'MEDIUM' THEN 2
             WHEN 'LOW' THEN 3
             ELSE 4
           END,
           timestamp DESC
           LIMIT $limit`,
          { limit },
        );
        rows = fallback.records.map((record) => ({
          id: record.get("id") as string,
          title: record.get("title") as string | null,
          severity: record.get("severity") as string | null,
          service: (record.get("service") as string | null) ?? null,
          timestamp: (record.get("timestamp") as string | null) ?? null,
        }));
      }
      return rows;
    });

    return {
      summary: `Retrieved ${findings.length} finding(s) from the knowledge graph.`,
      data: findings,
    };
  },
};

const riskRankingTool: AgentTool<
  { limit: number },
  { insights: ChatAgentInsight[]; citations: string[] }
> = {
  name: "risk-ranking",
  description:
    "Prioritizes findings by severity and recency to suggest remediation order.",
  async run({ input, state }) {
    const currentFindings = Array.isArray((state as ChatAgentState).findings)
      ? (state as ChatAgentState).findings
      : [];

    const limitValue = Math.max(1, Math.floor(input.limit ?? 6));
    const sourceFindings =
      currentFindings.length > 0
        ? currentFindings
        : await fetchTopFindings(limitValue * 2);

    if (sourceFindings.length === 0) {
      return {
        summary: "No findings available for ranking.",
        data: { insights: [], citations: [] },
      };
    }

    const ranked = [...sourceFindings]
      .sort((a, b) => {
        const severityDelta =
          severityWeight(b.severity) - severityWeight(a.severity);
        if (severityDelta !== 0) return severityDelta;
        const timeDelta =
          timestampWeight(b.timestamp) - timestampWeight(a.timestamp);
        if (timeDelta !== 0) return timeDelta;
        return a.id.localeCompare(b.id);
      })
      .slice(0, limitValue);

    const insights: ChatAgentInsight[] = ranked.map((finding, index) => ({
      title: `Priority ${index + 1}: ${finding.title ?? finding.id}`,
      detail: buildRankingDetail(finding),
      citations: [finding.id],
    }));
    const citations = ranked.map((finding) => finding.id);

    return {
      summary: `Ranked ${ranked.length} high-priority finding(s).`,
      data: { insights, citations },
    };
  },
};

const relationshipDigestTool: AgentTool<
  { limit: number },
  { insights: ChatAgentInsight[]; citations: string[] }
> = {
  name: "relationship-digest",
  description:
    "Summarizes enriched relationships between the retrieved findings and other assets or services.",
  async run({ input, state }) {
    const findings = Array.isArray((state as ChatAgentState).findings)
      ? (state as ChatAgentState).findings
      : [];
    if (findings.length === 0) {
      return {
        summary: "No findings available to summarize relationships.",
        data: { insights: [], citations: [] },
      };
    }

    const ids = findings.map((finding) => finding.id);
    const limit = neo4j.int(Math.max(1, Math.floor(input.limit ?? 10)));

    const rows = await withNeo4jSession(async (session) => {
      const result = await session.run(
        `MATCH (f:Finding)-[r]->(other)
         WHERE f.id IN $ids AND (coalesce(r.provenance, 'base') STARTS WITH 'agent' OR r.enriched = true)
         RETURN f.id AS fromId,
                type(r) AS type,
                coalesce(r.agent_source, r.provenance, 'agent') AS source,
                coalesce(r.rationale, '') AS rationale,
                coalesce(other.id, id(other)) AS toId,
                coalesce(other.title, other.id, labels(other)[0]) AS toTitle
         ORDER BY CASE coalesce(r.agent_source, r.provenance)
           WHEN 'llm' THEN 0
           WHEN 'agent_llm' THEN 0
           WHEN 'heuristic' THEN 1
           WHEN 'agent_heuristic' THEN 1
           ELSE 2
         END, f.id, type(r)
         LIMIT $limit`,
        { ids, limit },
      );
      return result.records.map((record) => ({
        fromId: record.get("fromId") as string,
        type: record.get("type") as string,
        source: (record.get("source") as string | null) ?? "agent",
        rationale: (record.get("rationale") as string | null) ?? "",
        toId: String(record.get("toId")),
        toTitle: (record.get("toTitle") as string | null) ?? "",
      }));
    });

    if (rows.length === 0) {
      return {
        summary: "No enriched relationships found for the selected findings.",
        data: { insights: [], citations: [] },
      };
    }

    const insights: ChatAgentInsight[] = rows.map((row) => ({
      title: `${row.type} between ${row.fromId} and ${row.toTitle || row.toId}`,
      detail:
        row.rationale && row.rationale.trim().length > 0
          ? row.rationale
          : `Relationship ${row.type} links ${row.fromId} to ${row.toTitle || row.toId}.`,
      citations: [row.fromId, row.toId].filter(Boolean),
    }));

    const citations = mergeCitations(
      [],
      insights.flatMap((insight) => insight.citations ?? []),
    );

    return {
      summary: `Highlighted ${insights.length} enriched relationship(s).`,
      data: { insights, citations },
    };
  },
};

const synthesisTool: AgentTool<
  { question: string; model: string },
  { answer: string; citations: string[] }
> = {
  name: "answer-synthesis",
  description:
    "Synthesizes a natural-language answer using LiteLLM and the retrieved findings.",
  async run({ input, state }) {
    const baseUrl = process.env.LITELLM_BASE_URL;
    const apiKey = process.env.LITELLM_API_KEY;
    if (!baseUrl || !apiKey) {
      return {
        summary: "LiteLLM not configured; falling back to template answer.",
        data: {
          answer:
            "LLM-based synthesis is unavailable. Please configure LiteLLM to enable conversational reasoning.",
          citations: [],
        },
      };
    }

    const findings = Array.isArray((state as ChatAgentState).findings)
      ? (state as ChatAgentState).findings
      : [];
    const insights = Array.isArray((state as ChatAgentState).insights)
      ? (state as ChatAgentState).insights
      : [];
    const payload = {
      question: input.question,
      findings: findings.slice(0, 8),
      insights: insights.slice(0, 8),
    };

    const response = await fetch(
      `${baseUrl.replace(/\/$/, "")}/chat/completions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: input.model,
          temperature: 0.1,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content:
                'You are an IR analyst grounded in a vulnerability knowledge graph. Provide concise, evidence-backed answers. Respond as JSON {"answer": string, "citations": string[]} where citations references finding IDs or services.',
            },
            {
              role: "user",
              content: JSON.stringify(payload),
            },
          ],
        }),
      },
    );

    if (!response.ok) {
      throw new Error(
        `LiteLLM chat request failed: ${response.status} ${response.statusText}`,
      );
    }

    const body = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
    };
    const content = body.choices?.[0]?.message?.content;
    if (!content) {
      return {
        summary: "Chat model returned no content.",
        data: {
          answer: "No conversational response produced.",
          citations: [],
        },
      };
    }

    const parsed = JSON.parse(content) as {
      answer?: string;
      citations?: string[];
    };

    return {
      summary: "Generated response using LiteLLM agent.",
      data: {
        answer: parsed.answer ?? "No answer produced.",
        citations: Array.isArray(parsed.citations)
          ? parsed.citations
          : citationsFromFindings(findings),
      },
    };
  },
};

function extractKeywords(question: string): string[] {
  return question
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 4 && token !== "findings")
    .slice(0, 6);
}

function buildFallbackAnswer(question: string, findings: ChatAgentFinding[]) {
  if (findings.length === 0) {
    return {
      text: `I could not locate findings related to "${question}".`,
      citations: [],
    };
  }

  const topFinding = findings[0];
  const headline = topFinding.title ?? topFinding.id;
  const service = topFinding.service ? ` on ${topFinding.service}` : "";

  const text = `I found ${findings.length} finding(s) relevant to "${question}". Highest priority appears to be ${headline}${service}. Configure LiteLLM for richer analysis.`;
  return {
    text,
    citations: findings.map((finding) => finding.id),
  };
}

async function fetchTopFindings(limit: number): Promise<ChatAgentFinding[]> {
  return withNeo4jSession(async (session) => {
    const result = await session.run(
      `MATCH (f:Finding)
       OPTIONAL MATCH (f)-[:FOUND_ON]->(a:Asset)
       RETURN f.id AS id,
              coalesce(f.title, f.id) AS title,
              coalesce(f.severity, 'UNKNOWN') AS severity,
              a.service AS service,
              f.timestamp AS timestamp
       ORDER BY CASE upper(coalesce(f.severity, 'LOW'))
         WHEN 'CRITICAL' THEN 0
         WHEN 'HIGH' THEN 1
         WHEN 'MEDIUM' THEN 2
         WHEN 'LOW' THEN 3
         ELSE 4
       END,
       timestamp DESC
       LIMIT $limit`,
      { limit: neo4j.int(Math.max(1, limit)) },
    );
    return result.records.map((record) => ({
      id: record.get("id") as string,
      title: record.get("title") as string | null,
      severity: record.get("severity") as string | null,
      service: (record.get("service") as string | null) ?? null,
      timestamp: (record.get("timestamp") as string | null) ?? null,
    }));
  });
}

function severityWeight(input: string | null | undefined): number {
  switch ((input ?? "").toUpperCase()) {
    case "CRITICAL":
      return 400;
    case "HIGH":
      return 300;
    case "MEDIUM":
      return 200;
    case "LOW":
      return 100;
    default:
      return 0;
  }
}

function timestampWeight(input: string | null | undefined): number {
  if (!input) return 0;
  const value = Date.parse(input);
  return Number.isNaN(value) ? 0 : value;
}

function buildRankingDetail(finding: ChatAgentFinding): string {
  const parts: string[] = [];
  if (finding.severity) {
    parts.push(`Severity ${finding.severity}`);
  }
  if (finding.service) {
    parts.push(`Service ${finding.service}`);
  }
  if (finding.timestamp) {
    const formatted = new Date(finding.timestamp).toLocaleString();
    parts.push(`Seen ${formatted}`);
  }
  return parts.length > 0 ? parts.join(" · ") : `Reported as ${finding.id}.`;
}

function mergeCitations(existing: string[], incoming: string[]): string[] {
  const set = new Set(existing);
  for (const id of incoming) {
    if (id && id.trim().length > 0) {
      set.add(id);
    }
  }
  return Array.from(set);
}

function mergeInsights(
  existing: ChatAgentInsight[],
  incoming: ChatAgentInsight[],
): ChatAgentInsight[] {
  const map = new Map(existing.map((insight) => [insight.title, insight]));
  for (const insight of incoming) {
    if (!insight || !insight.title) continue;
    const current = map.get(insight.title);
    if (current) {
      if (insight.detail && insight.detail.trim().length > 0) {
        current.detail = insight.detail;
      }
      const updatedCitations = mergeCitations(
        current.citations ?? [],
        insight.citations ?? [],
      );
      current.citations =
        updatedCitations.length > 0 ? updatedCitations : undefined;
    } else {
      const citations = insight.citations
        ? mergeCitations([], insight.citations)
        : [];
      map.set(insight.title, {
        ...insight,
        citations: citations.length > 0 ? citations : undefined,
      });
    }
  }
  return Array.from(map.values());
}

function citationsFromFindings(findings: ChatAgentFinding[]): string[] {
  return mergeCitations(
    [],
    findings.map((finding) => finding.id),
  );
}
