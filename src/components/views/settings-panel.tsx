"use client";

import { useId, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils/cn";

export function SettingsPanel() {
  const [baseUrl, setBaseUrl] = useState("https://api.litellm.local");
  const [apiKey, setApiKey] = useState("sk-••••••••••");
  const [retention, setRetention] = useState("30");
  const [theme, setTheme] = useState("dark");
  const baseUrlId = useId();
  const apiKeyId = useId();
  const retentionId = useId();
  const crownJewelsId = useId();
  const ownersId = useId();

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <section className="flex flex-col gap-4">
        <Card
          title="LiteLLM configuration"
          subtitle="Model routing and credentials"
        >
          <form className="flex flex-col gap-4 text-sm text-slate-300">
            <div className="flex flex-col gap-1">
              <label
                className="text-xs uppercase tracking-wide text-slate-400"
                htmlFor={baseUrlId}
              >
                Base URL
              </label>
              <Input
                id={baseUrlId}
                value={baseUrl}
                onChange={(event) => setBaseUrl(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label
                className="text-xs uppercase tracking-wide text-slate-400"
                htmlFor={apiKeyId}
              >
                API key
              </label>
              <Input
                id={apiKeyId}
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                type="password"
              />
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-400">
              <Badge tone="success">Connected</Badge>
              <span>Last tested 2 minutes ago</span>
            </div>
            <div className="flex gap-2">
              <Button type="button">Test connection</Button>
              <Button type="button" variant="secondary">
                Rotate key
              </Button>
            </div>
          </form>
        </Card>

        <Card
          title="Data retention"
          subtitle="Control how long we keep chat + graph context."
        >
          <div className="flex flex-col gap-3 text-sm text-slate-300">
            <div className="flex flex-col gap-1">
              <label
                className="text-xs uppercase tracking-wide text-slate-400"
                htmlFor={retentionId}
              >
                Retention (days)
              </label>
              <Input
                id={retentionId}
                value={retention}
                onChange={(event) => setRetention(event.target.value)}
                type="number"
                min="7"
                max="365"
              />
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <input
                type="checkbox"
                id="redact"
                className="h-4 w-4 rounded border-slate-700 bg-slate-900"
                defaultChecked
              />
              <label htmlFor="redact">Redact secrets from stored context</label>
            </div>
            <div className="flex gap-2">
              <Button type="button">Save policy</Button>
              <Button type="button" variant="secondary">
                Export compliance report
              </Button>
            </div>
          </div>
        </Card>

        <Card title="Organization" subtitle="Metadata powering prioritization">
          <div className="flex flex-col gap-3 text-sm text-slate-300">
            <div className="flex flex-col gap-1">
              <label
                className="text-xs uppercase tracking-wide text-slate-400"
                htmlFor={crownJewelsId}
              >
                Crown jewels
              </label>
              <Input
                id={crownJewelsId}
                placeholder="payments-api, billing-service, user-trust"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label
                className="text-xs uppercase tracking-wide text-slate-400"
                htmlFor={ownersId}
              >
                Critical owners
              </label>
              <Input id={ownersId} placeholder="@alice, @bob, @security-team" />
            </div>
            <Button type="button" variant="secondary">
              Update metadata
            </Button>
          </div>
        </Card>
      </section>

      <aside className="flex flex-col gap-4">
        <Card title="Appearance" subtitle="Theme + preferences">
          <div className="flex flex-col gap-3 text-sm text-slate-300">
            <div className="flex gap-2">
              {[
                { id: "light", label: "Light" },
                { id: "dark", label: "Dark" },
                { id: "auto", label: "Auto" },
              ].map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setTheme(option.id)}
                  className={cn(
                    "rounded-lg border px-3 py-1 text-xs",
                    theme === option.id
                      ? "border-blue-400 bg-blue-500/20 text-blue-200"
                      : "border-slate-700 bg-slate-900/60 text-slate-300 hover:border-blue-400/60",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-400">
              Applies instantly across all views.
            </p>
          </div>
        </Card>
        <Card title="Compliance export" subtitle="Select desired format">
          <div className="flex flex-col gap-3 text-xs text-slate-300">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="export"
                defaultChecked
                className="h-4 w-4 rounded border-slate-700 bg-slate-900"
              />
              <span>CSAF</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="export"
                className="h-4 w-4 rounded border-slate-700 bg-slate-900"
              />
              <span>JSON (custom)</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="export"
                className="h-4 w-4 rounded border-slate-700 bg-slate-900"
              />
              <span>CSV</span>
            </label>
            <Button
              type="button"
              variant="secondary"
              className="mt-2 px-3 py-1 text-xs"
            >
              Export now
            </Button>
          </div>
        </Card>
      </aside>
    </div>
  );
}
