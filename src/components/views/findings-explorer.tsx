"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils/cn";

type FindingRow = {
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

type FilterState = {
  severity: Set<string>;
  cwe: Set<string>;
  scanner: Set<string>;
};

const SAVED_VIEWS = [
  {
    name: "Critical internet-exposed",
    description: "Critical findings on assets reachable from internet",
  },
  {
    name: "BLAST > 20",
    description: "High blast radius open vulns",
  },
];

export function FindingsExplorer() {
  const [findings, setFindings] = useState<FindingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState<FilterState>({
    severity: new Set(),
    cwe: new Set(),
    scanner: new Set(),
  });
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;

    async function loadFindings() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/graph/findings");
        if (!response.ok) {
          throw new Error(await response.text());
        }
        const json = (await response.json()) as { data: FindingRow[] };
        if (!cancelled) {
          setFindings(json.data);
          setSelectedFindingId(json.data[0]?.id ?? null);
        }
      } catch (err) {
        if (!cancelled) {
          setError("Unable to load findings from the graph");
          console.error(err);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadFindings();
    return () => {
      cancelled = true;
    };
  }, []);

  const filterOptions = useMemo(() => {
    const severity = new Set<string>();
    const cwe = new Set<string>();
    const scanner = new Set<string>();

    for (const finding of findings) {
      if (finding.severity) severity.add(finding.severity.toUpperCase());
      if (finding.cweId) cwe.add(finding.cweId);
      if (finding.scanner) scanner.add(finding.scanner);
    }

    return {
      severity: Array.from(severity).sort(),
      cwe: Array.from(cwe).sort(),
      scanner: Array.from(scanner).sort(),
    };
  }, [findings]);

  const filteredFindings = useMemo(() => {
    const severityFilter = filters.severity;
    const cweFilter = filters.cwe;
    const scannerFilter = filters.scanner;

    return findings.filter((finding) => {
      const matchesSearch =
        `${finding.assetId ?? ""} ${finding.cveId ?? ""} ${finding.cweId ?? ""} ${finding.title ?? ""}`
          .toLowerCase()
          .includes(searchTerm.toLowerCase());

      const matchesSeverity =
        severityFilter.size === 0 ||
        severityFilter.has(finding.severity.toUpperCase());
      const matchesCwe =
        cweFilter.size === 0 ||
        (finding.cweId ? cweFilter.has(finding.cweId) : false);
      const matchesScanner =
        scannerFilter.size === 0 ||
        (finding.scanner ? scannerFilter.has(finding.scanner) : false);

      return matchesSearch && matchesSeverity && matchesCwe && matchesScanner;
    });
  }, [findings, filters, searchTerm]);

  const selectedFinding = useMemo(() => {
    if (!selectedFindingId) return null;
    return findings.find((finding) => finding.id === selectedFindingId) ?? null;
  }, [findings, selectedFindingId]);

  function toggleFilter(type: keyof FilterState, value: string) {
    setFilters((prev) => {
      const next = new Set(prev[type]);
      if (next.has(value)) {
        next.delete(value);
      } else {
        next.add(value);
      }
      return { ...prev, [type]: next };
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)_320px]">
      <aside className="flex flex-col gap-4">
        <Card title="Filters" subtitle="Stack multiple facets to narrow focus">
          <div className="flex flex-col gap-4">
            <Input
              placeholder="Semantic / keyword search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
            <FilterSection
              label="Severity"
              options={filterOptions.severity}
              activeValues={filters.severity}
              onToggle={(value) => toggleFilter("severity", value)}
            />
            <FilterSection
              label="CWE"
              options={filterOptions.cwe}
              activeValues={filters.cwe}
              onToggle={(value) => toggleFilter("cwe", value)}
            />
            <FilterSection
              label="Scanner"
              options={filterOptions.scanner}
              activeValues={filters.scanner}
              onToggle={(value) => toggleFilter("scanner", value)}
            />
            <Card
              title="Saved views"
              subtitle="Re-open your favourite slices"
              className="bg-slate-950/40"
            >
              <div className="flex flex-col gap-3">
                {SAVED_VIEWS.map((view) => (
                  <div
                    key={view.name}
                    className="rounded-lg border border-slate-800/60 p-3"
                  >
                    <p className="text-sm font-semibold text-slate-100">
                      {view.name}
                    </p>
                    <p className="text-xs text-slate-400">{view.description}</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </Card>
        <Button variant="secondary">Export CSV</Button>
      </aside>

      <section className="flex flex-col gap-3 overflow-hidden">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-100">
              Findings ({loading ? "—" : filteredFindings.length})
            </h2>
            <p className="text-xs text-slate-400">
              Select rows to add to graph selection or chat context.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost">Add to graph selection</Button>
            <Button variant="primary">Ask agent</Button>
          </div>
        </div>
        <div className="overflow-hidden rounded-xl border border-slate-800/70 bg-slate-950/40">
          {loading ? (
            <div className="flex flex-col gap-3 p-8">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-11/12" />
              <Skeleton className="h-8 w-10/12" />
            </div>
          ) : error ? (
            <div className="p-8 text-sm text-rose-300">{error}</div>
          ) : (
            <table className="min-w-full divide-y divide-slate-800 text-left text-sm text-slate-200">
              <thead className="bg-slate-900/70 text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-4 py-3">Asset</th>
                  <th className="px-4 py-3">Service</th>
                  <th className="px-4 py-3">Severity</th>
                  <th className="px-4 py-3">CVE / CWE</th>
                  <th className="px-4 py-3">OWASP</th>
                  <th className="px-4 py-3">Scanner</th>
                  <th className="px-4 py-3">Observed</th>
                  <th className="px-4 py-3">Patch</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {filteredFindings.map((finding) => {
                  const isSelected = selectedFindingId === finding.id;
                  return (
                    <tr
                      key={finding.id}
                      className={cn(
                        "cursor-pointer transition hover:bg-slate-900/70",
                        isSelected && "bg-slate-900/70",
                      )}
                      onClick={() => setSelectedFindingId(finding.id)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <span className="font-medium text-slate-100">
                            {finding.assetId ?? finding.assetType ?? "Unknown"}
                          </span>
                          {finding.blastRadius > 0 && (
                            <span className="text-xs text-slate-500">
                              Blast radius {finding.blastRadius}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {finding.service ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <SeverityBadge severity={finding.severity} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <span>{finding.cveId ?? "—"}</span>
                          <span className="text-xs text-slate-500">
                            {finding.cweId ?? "—"}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {finding.owaspId ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {finding.scanner ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400">
                        {finding.timestamp
                          ? formatDateTime(finding.timestamp)
                          : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={finding.hasPatch ? "success" : "warning"}>
                          {finding.hasPatch ? "Patch available" : "No patch"}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {!loading && !error && filteredFindings.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-2 p-12 text-center text-sm text-slate-400">
              <Skeleton className="h-10 w-10" />
              <p>No findings match your filters yet.</p>
              <p className="text-xs text-slate-500">
                Adjust the filters or clear the search query to reset results.
              </p>
            </div>
          )}
        </div>
      </section>

      <aside className="flex max-h-[calc(100vh-220px)] flex-col gap-3 overflow-hidden">
        <Card title="Details" subtitle="Context for the selected finding">
          {selectedFinding ? (
            <div className="flex flex-col gap-3 text-sm text-slate-200">
              <div>
                <h3 className="text-xs uppercase tracking-wide text-slate-400">
                  Asset
                </h3>
                <p className="font-semibold text-slate-100">
                  {selectedFinding.assetId ??
                    selectedFinding.assetType ??
                    "Unknown"}
                </p>
                <p className="text-xs text-slate-500">
                  Scanner {selectedFinding.scanner ?? "—"} • Scan ID{" "}
                  {selectedFinding.scanId ?? "—"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-slate-300">
                {selectedFinding.cveId && (
                  <Badge tone="danger">{selectedFinding.cveId}</Badge>
                )}
                {selectedFinding.cweId && (
                  <Badge tone="warning">{selectedFinding.cweId}</Badge>
                )}
                {selectedFinding.owaspId && (
                  <Badge tone="neutral">OWASP {selectedFinding.owaspId}</Badge>
                )}
                <Badge tone={selectedFinding.hasPatch ? "success" : "warning"}>
                  {selectedFinding.hasPatch ? "Patch available" : "No patch"}
                </Badge>
              </div>
              <div className="rounded-lg border border-slate-800/60 bg-slate-950/40 p-3 text-xs text-slate-400">
                <p>
                  {selectedFinding.title ??
                    "Evidence linked to this vulnerability."}
                </p>
                {selectedFinding.vector && (
                  <p className="mt-1">Vector: {selectedFinding.vector}</p>
                )}
                {selectedFinding.blastRadius > 0 && (
                  <p className="mt-1">
                    Blast radius: {selectedFinding.blastRadius} assets
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-2 text-xs text-slate-300">
                <span>
                  Observed{" "}
                  {selectedFinding.timestamp
                    ? formatDateTime(selectedFinding.timestamp)
                    : "unknown"}
                </span>
                <span>Severity {selectedFinding.severity.toUpperCase()}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="primary" className="px-3 py-1 text-xs">
                  Open in graph
                </Button>
                <Button variant="secondary" className="px-3 py-1 text-xs">
                  Add to chat context
                </Button>
                <Button variant="ghost" className="px-3 py-1 text-xs">
                  Create ticket
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-400">
              Select a finding to see full context, evidence, and remediation
              guidance.
            </p>
          )}
        </Card>
      </aside>
    </div>
  );
}

type FilterSectionProps = {
  label: string;
  options: string[];
  activeValues: Set<string>;
  onToggle: (value: string) => void;
};

function FilterSection({
  label,
  options,
  activeValues,
  onToggle,
}: FilterSectionProps) {
  if (options.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </h3>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <ToggleChip
            key={option}
            label={option}
            active={activeValues.has(option)}
            onToggle={() => onToggle(option)}
          />
        ))}
      </div>
    </div>
  );
}

type ToggleChipProps = {
  label: string;
  active: boolean;
  onToggle: () => void;
};

function ToggleChip({ label, active, onToggle }: ToggleChipProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "rounded-full border px-2 py-1 text-xs font-medium transition",
        active
          ? "border-blue-400 bg-blue-500/20 text-blue-200"
          : "border-slate-700 bg-slate-900/60 text-slate-300 hover:border-blue-400/60",
      )}
    >
      {label}
    </button>
  );
}

type SeverityBadgeProps = {
  severity: string;
};

function SeverityBadge({ severity }: SeverityBadgeProps) {
  const normalized = severity.toUpperCase();
  const tone =
    normalized === "CRITICAL"
      ? "danger"
      : normalized === "HIGH"
        ? "warning"
        : normalized === "MEDIUM"
          ? "neutral"
          : "success";

  return <Badge tone={tone}>{normalized}</Badge>;
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}
