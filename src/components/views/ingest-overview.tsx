"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
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
};

type SummaryMetric = {
  label: string;
  value: string;
  delta?: string;
};

type IngestionResponsePayload = {
  data?: {
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
  error?: string;
};

type IngestionSummary = IngestionResponsePayload["data"];

type UploadState = "idle" | "uploading" | "success" | "error";

type PersistedUploadState = {
  filename: string;
  summary: IngestionSummary;
  timestamp: string;
};

const UPLOAD_STORAGE_KEY = "ingestOverviewUploadState";

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

export function IngestOverview() {
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [filename, setFilename] = useState<string | null>(null);
  const [ingestSummary, setIngestSummary] = useState<IngestionSummary | null>(
    null,
  );
  const [metrics, setMetrics] = useState<OverviewMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cancelRef = useRef(false);
  const persistedUploadRef = useRef<PersistedUploadState | null>(null);

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
    const persisted = loadPersistedUploadState();
    if (persisted) {
      setFilename(persisted.filename);
      setIngestSummary(persisted.summary);
      persistedUploadRef.current = persisted;
    }
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

    const list: SummaryMetric[] = [
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

    if (ingestSummary) {
      list.unshift(
        {
          label: "AI Graph",
          value: `${formatNumber(ingestSummary.provenance.agent.relationships)} rels`,
          delta: `${formatNumber(ingestSummary.provenance.agent.nodes)} nodes enriched`,
        },
        {
          label: "Base Graph",
          value: `${formatNumber(ingestSummary.provenance.base.relationships)} rels`,
          delta: `${formatNumber(ingestSummary.provenance.base.nodes)} nodes modeled`,
        },
      );
    }

    return list;
  }, [ingestSummary, metrics]);

  async function handleUpload(file: File) {
    setFilename(file.name);
    setUploadState("uploading");
    setError(null);
    setIngestSummary(null);

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
        console.info("Ingestion skipped (already processed dataset).");
      }

      setIngestSummary(payload.data);
      const persisted: PersistedUploadState = {
        filename: file.name,
        summary: payload.data,
        timestamp: new Date().toISOString(),
      };
      savePersistedUploadState(persisted);
      persistedUploadRef.current = persisted;
      await loadMetrics();
    } catch (err) {
      console.error("Failed to upload findings", err);
      setUploadState("error");
      setIngestSummary(null);
      const message =
        err instanceof Error && err.message
          ? err.message
          : "Graph ingestion failed.";
      setError(message);
      const previous = persistedUploadRef.current;
      setFilename(previous?.filename ?? null);
      setIngestSummary(previous?.summary ?? null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <Card className="border-rose-900/60 bg-rose-900/20">
          <p className="text-sm text-rose-200">{error}</p>
        </Card>
      )}
      <section>
        <UploadDropzone
          state={uploadState}
          filename={filename}
          onFileSelected={handleUpload}
        />
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
    return <UploadSpinner />;
  }

  if (state === "success") {
    return <Badge tone="success">INGESTED</Badge>;
  }

  return <Badge tone="danger">FAILED</Badge>;
}

function UploadSpinner() {
  return (
    <span className="relative inline-flex h-4 w-4 items-center justify-center">
      <span
        className="absolute inline-flex h-full w-full animate-spin rounded-full border-2 border-slate-500/40 border-t-blue-400"
        aria-hidden
      />
      <span className="sr-only">Uploading</span>
    </span>
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

function percentageDelta(value: number, total: number) {
  if (!total) return undefined;
  const pct = Math.round((value / total) * 100);
  return `${pct}% of findings`;
}

function loadPersistedUploadState(): PersistedUploadState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(UPLOAD_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedUploadState;
    if (!parsed.filename || !parsed.summary) {
      return null;
    }
    return parsed;
  } catch (error) {
    console.warn("Failed to load persisted ingest upload state", error);
    return null;
  }
}

function savePersistedUploadState(state: PersistedUploadState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(UPLOAD_STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn("Failed to persist ingest upload state", error);
  }
}
