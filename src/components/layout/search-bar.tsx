"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils/cn";

export function SearchBar({ className }: { className?: string }) {
  const [value, setValue] = useState("");

  return (
    <div
      className={cn(
        "relative flex items-center gap-2 rounded-lg border border-slate-800/70 bg-slate-900/80 px-3",
        className,
      )}
    >
      <span className="text-slate-500" aria-hidden>
        🔍
      </span>
      <Input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Search findings, entities, ATT&CK, CVE..."
        className="h-10 border-none bg-transparent px-0 text-sm focus-visible:ring-0"
        aria-label="Global search"
      />
    </div>
  );
}
