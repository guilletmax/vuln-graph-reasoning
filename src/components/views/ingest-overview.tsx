"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils/cn";

type OverviewMetrics = {
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
  ingestionRuns: Array<{
    fingerprint: string;
    findings: number;
    createdAt: string | null;
    lastIngestedAt: string | null;
  }>;
};

type SummaryMetric = {
  label: string;
  value: string;
  delta?: string;
};

type IngestionLogItem = {
  id: string;
  ts: string;
  message: string;
  status: "success" | "warning" | "info";
};

type IngestionResponsePayload = {
  data?: {
    findings: number;
    nodesCreated: number;
    relationshipsCreated: number;
    agentSuggestionsApplied: number;
    skipped: boolean;
    fingerprint: string;
  };
  error?: string;
};

type UploadState = "idle" | "uploading" | "success" | "error";

type ActionRowProps = {
  title: string;
  description: string;
  tag: string;
  tone?: "neutral" | "success" | "warning" | "danger";
};

const SUMMARY_LOADING_KEYS = [
  "summary-0",
  "summary-1",
  "summary-2",
  "summary-3",
  "summary-4",
  "summary-5",
  "summary-6",
  "summary-7",
];

const ACTION_LOADING_KEYS = ["action-0", "action-1", "action-2"];

export function IngestOverview() {
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [filename, setFilename] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<OverviewMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cancelRef = useRef(false);

  const loadMetrics = useCallback(async () => {
    if (cancelRef.current) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/graph/overview", {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      const json = (await response.json()) as { data: OverviewMetrics };
      if (!cancelRef.current) {
        setMetrics(json.data);
      }
    } catch (err) {
      if (!cancelRef.current) {
        setError("Unable to load latest ingest metrics");
        console.error(err);
      }
    } finally {
      if (!cancelRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    cancelRef.current = false;
    loadMetrics();
    return () => {
      cancelRef.current = true;
    };
  }, [loadMetrics]);

  const summaryMetrics = useMemo<SummaryMetric[]>(() => {
    if (!metrics) return [];
    const totalFindings = metrics.totals.findings || 1;
    const scannersTotal = metrics.scanners.reduce(
      (sum, scanner) => sum + scanner.findings,
      0,
    );
    const patchPercent = Math.round(
      (metrics.patchStatus.patchable / totalFindings) * 100,
    );

    return [
      {
        label: "Total Assets",
        value: formatNumber(metrics.totals.assets),
        delta: `${formatNumber(metrics.totals.services)} services`,
      },
      {
        label: "Total Findings",
        value: formatNumber(metrics.totals.findings),
        delta: `${formatNumber(scannersTotal)} scanner hits`,
      },
      {
        label: "Critical Vulns",
        value: formatNumber(metrics.severity.critical),
        delta: percentageDelta(
          metrics.severity.critical,
          metrics.totals.findings,
        ),
      },
      {
        label: "High Vulns",
        value: formatNumber(metrics.severity.high),
        delta: percentageDelta(metrics.severity.high, metrics.totals.findings),
      },
      {
        label: "Top CWE",
        value: metrics.topCwes[0]?.cweId ?? "—",
        delta: metrics.topCwes[0]
          ? `${formatNumber(metrics.topCwes[0].count)} findings`
          : "No CWE data",
      },
      {
        label: "Top OWASP",
        value: metrics.topOwasp[0]?.owaspId ?? "—",
        delta: metrics.topOwasp[0]
          ? `${formatNumber(metrics.topOwasp[0].count)} findings`
          : "No OWASP data",
      },
      {
        label: "Patch Coverage",
        value: `${Number.isFinite(patchPercent) ? patchPercent : 0}%`,
        delta: `${formatNumber(metrics.patchStatus.patchable)} with mitigation`,
      },
      {
        label: "Blast Radius",
        value:
          metrics.blastRadius.max > 0
            ? `${metrics.blastRadius.max} assets`
            : "Low",
        delta:
          metrics.blastRadius.vulnerabilityTitle ?? "Largest impacted vuln",
      },
      {
        label: "Time Range",
        value:
          metrics.timeRange.days !== null
            ? `${metrics.timeRange.days} days`
            : "N/A",
        delta: metrics.timeRange.lastSeen
          ? `Latest ${formatDate(metrics.timeRange.lastSeen)}`
          : undefined,
      },
    ];
  }, [metrics]);

  const ingestLog = useMemo<IngestionLogItem[]>(() => {
    if (!metrics) return [];
    return metrics.ingestionRuns.map((run) => ({
      id: run.fingerprint,
      ts: run.lastIngestedAt ? formatTime(run.lastIngestedAt) : "—",
      message: `Ingested ${formatNumber(run.findings)} findings`,
      status: "success" as const,
    }));
  }, [metrics]);

  const actionItems = useMemo(() => buildActionItems(metrics), [metrics]);

  async function handleUpload(file: File) {
    setFilename(file.name);
    setUploadState("uploading");
    setError(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/graph/ingest", {
        method: "POST",
        body: formData,
      });

      const raw = await response.text();
      let payload: IngestionResponsePayload | null = null;
      if (raw) {
        try {
          payload = JSON.parse(raw) as IngestionResponsePayload;
        } catch (parseError) {
          console.warn("Failed to parse ingestion response JSON", parseError);
        }
      }

      if (!response.ok) {
        const message =
          payload?.error && payload.error.trim().length > 0
            ? payload.error
            : raw || "Graph ingestion failed.";
        throw new Error(message);
      }

      if (!payload?.data) {
        throw new Error(
          "Graph ingestion completed without a response payload.",
        );
      }

      setUploadState("success");

      if (payload.data.skipped) {
        console.info(
          `Ingestion skipped for fingerprint ${payload.data.fingerprint} (already processed).`,
        );
      }

      await loadMetrics();
    } catch (err) {
      console.error("Failed to upload findings", err);
      setUploadState("error");
      const message =
        err instanceof Error && err.message
          ? err.message
          : "Graph ingestion failed.";
      setError(message);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <Card className="border-rose-900/60 bg-rose-900/20">
          <p className="text-sm text-rose-200">{error}</p>
        </Card>
      )}
      <section className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          <UploadDropzone
            state={uploadState}
            filename={filename}
            onFileSelected={handleUpload}
          />
          <Card
            title="Live ingest log"
            subtitle="Latest sync events and enrichments"
          >
            <div className="flex flex-col gap-3">
              {loading && !metrics && (
                <>
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-4/5" />
                  <Skeleton className="h-12 w-3/5" />
                </>
              )}
              {!loading && ingestLog.length === 0 && (
                <p className="text-sm text-slate-400">
                  No ingestion activity recorded yet.
                </p>
              )}
              {ingestLog.map((entry) => (
                <div key={entry.id} className="flex items-start gap-3">
                  <span className="mt-1 text-xs text-slate-500">
                    {entry.ts}
                  </span>
                  <div className="flex flex-1 flex-col gap-1">
                    <p className="text-sm text-slate-100">{entry.message}</p>
                    <Badge tone={statusTone(entry.status)} className="w-fit">
                      {entry.status.toUpperCase()}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
        <Card
          title="Workflow quick start"
          subtitle="Follow the recommended steps to kick off your investigation."
          className="h-full"
        >
          <ol className="flex list-decimal flex-col gap-3 pl-4 text-sm text-slate-200">
            <li>Upload your latest scanner exports or SBOM bundles.</li>
            <li>
              Review new critical findings in the explorer and tag owners.
            </li>
            <li>
              Open the graph to validate exploit chains and shared root causes.
            </li>
            <li>Loop in the agent console to draft a remediation plan.</li>
            <li>
              Snapshot key insights into the investigation canvas for sharing.
            </li>
          </ol>
        </Card>
      </section>

      <section>
        <h2 className="text-base font-semibold text-slate-100">
          Risk posture at a glance
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {loading && !metrics
            ? SUMMARY_LOADING_KEYS.map((key) => (
                <Skeleton key={key} className="h-24 rounded-xl" />
              ))
            : summaryMetrics.map((metric) => (
                <Card key={metric.label} className="bg-slate-900/70">
                  <p className="text-xs uppercase tracking-wide text-slate-400">
                    {metric.label}
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-slate-100">
                    {metric.value}
                  </p>
                  {metric.delta && (
                    <p className="mt-1 text-xs text-slate-500">
                      {metric.delta}
                    </p>
                  )}
                </Card>
              ))}
        </div>
      </section>

      <section>
        <Card
          title="Next best actions"
          subtitle="What deserves your attention right now"
        >
          <div className="flex flex-col gap-3">
            {loading &&
              !metrics &&
              ACTION_LOADING_KEYS.map((key) => (
                <Skeleton key={key} className="h-20 w-full" />
              ))}
            {!loading && actionItems.length === 0 && (
              <p className="text-sm text-slate-400">
                Upload fresh findings or run a graph analysis to surface next
                actions.
              </p>
            )}
            {actionItems.map((item) => (
              <ActionRow
                key={item.title}
                title={item.title}
                description={item.description}
                tag={item.tag}
                tone={item.tone}
              />
            ))}
          </div>
        </Card>
      </section>
    </div>
  );
}

type UploadDropzoneProps = {
  state: UploadState;
  filename: string | null;
  onFileSelected: (file: File) => void | Promise<void>;
};

function UploadDropzone({
  state,
  filename,
  onFileSelected,
}: UploadDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function handleFile(fileList: FileList | null) {
    if (!fileList || fileList.length === 0 || state === "uploading") return;
    void onFileSelected(fileList[0]);
  }

  return (
    <div className="w-full">
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.csv"
        className="hidden"
        onChange={(event) => handleFile(event.target.files)}
        tabIndex={-1}
      />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          handleFile(event.dataTransfer.files);
        }}
        className={cn(
          "flex h-48 w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-700 bg-slate-950/60 text-center transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400",
          isDragging
            ? "border-blue-400 bg-slate-900"
            : "hover:border-blue-400/80 hover:bg-slate-900/80",
          state === "uploading" ? "cursor-not-allowed opacity-70" : null,
        )}
        disabled={state === "uploading"}
        aria-disabled={state === "uploading"}
        aria-label="Upload findings file"
      >
        <span className="text-3xl" aria-hidden>
          {state === "success" ? "✅" : "📁"}
        </span>
        <div>
          <p className="text-sm font-semibold text-slate-100">
            Drag & drop Findings JSON/CSV
          </p>
          <p className="text-xs text-slate-400">or click to browse files</p>
        </div>
        {filename && (
          <p className="rounded-full bg-slate-900/80 px-3 py-1 text-xs text-slate-300">
            {filename}
          </p>
        )}
        <UploadStateIndicator state={state} />
      </button>
    </div>
  );
}

type UploadStateIndicatorProps = {
  state: UploadState;
};

function UploadStateIndicator({ state }: UploadStateIndicatorProps) {
  if (state === "idle") {
    return null;
  }

  if (state === "uploading") {
    return <Skeleton className="h-2 w-32" aria-label="Uploading" />;
  }

  if (state === "success") {
    return <Badge tone="success">INGESTED</Badge>;
  }

  return <Badge tone="danger">FAILED</Badge>;
}

function statusTone(status: "success" | "info" | "warning") {
  switch (status) {
    case "success":
      return "success";
    case "warning":
      return "warning";
    default:
      return "neutral";
  }
}

function ActionRow({
  title,
  description,
  tag,
  tone = "neutral",
}: ActionRowProps) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-slate-800/70 bg-slate-950/40 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-semibold text-slate-100">{title}</p>
        <Badge tone={tone}>{tag}</Badge>
      </div>
      <p className="text-xs text-slate-400">{description}</p>
      <div className="flex gap-2">
        <Button className="px-2 py-1 text-xs">View details</Button>
        <Button variant="ghost" className="px-2 py-1 text-xs">
          Ask agent
        </Button>
      </div>
    </div>
  );
}

function formatNumber(value: number) {
  return new Intl.NumberFormat().format(value);
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function percentageDelta(value: number, total: number) {
  if (!total) return undefined;
  const pct = Math.round((value / total) * 100);
  return `${pct}% of findings`;
}

function buildActionItems(metrics: OverviewMetrics | null) {
  if (!metrics)
    return [] as Array<{
      title: string;
      description: string;
      tag: string;
      tone?: "neutral" | "success" | "warning" | "danger";
    }>;

  const items: Array<{
    title: string;
    description: string;
    tag: string;
    tone?: "neutral" | "success" | "warning" | "danger";
  }> = [];

  if (metrics.blastRadius.max > 0 && metrics.blastRadius.vulnerabilityId) {
    items.push({
      title: `Validate exposure for ${metrics.blastRadius.vulnerabilityId}`,
      description: metrics.blastRadius.vulnerabilityTitle
        ? `${metrics.blastRadius.vulnerabilityTitle} touches ${metrics.blastRadius.max} assets.`
        : `Vulnerability impacts ${metrics.blastRadius.max} assets across the fleet.`,
      tag: "High blast radius",
      tone: "warning",
    });
  }

  if (metrics.topCwes[0]) {
    items.push({
      title: `Deep-dive recurring ${metrics.topCwes[0].cweId}`,
      description: `${formatNumber(metrics.topCwes[0].count)} findings share this root cause—consider a control fix.`,
      tag: "Root cause",
    });
  }

  if (metrics.patchStatus.withoutPatch > 0) {
    items.push({
      title: "Prioritise findings without mitigations",
      description: `${formatNumber(metrics.patchStatus.withoutPatch)} findings lack a linked package fix.`,
      tag: "Remediation gap",
      tone: "danger",
    });
  }

  return items.slice(0, 3);
}
