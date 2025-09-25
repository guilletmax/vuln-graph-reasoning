"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { NAV_ITEMS } from "./nav-data";

function buildBreadcrumbs(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) {
    return [
      {
        href: "/",
        label: "Ingest & Overview",
      },
    ];
  }

  const crumbs = segments.map((segment, index) => {
    const href = `/${segments.slice(0, index + 1).join("/")}`;
    const navMatch = NAV_ITEMS.find((item) => item.href === href);

    return {
      href,
      label:
        navMatch?.label ??
        segment.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    };
  });

  return [
    {
      href: "/",
      label: "Ingest & Overview",
    },
    ...crumbs,
  ];
}

export function Header() {
  const pathname = usePathname();
  const breadcrumbs = buildBreadcrumbs(pathname);

  return (
    <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-6 py-4">
        <nav
          className="flex items-center gap-2 text-xs text-slate-400"
          aria-label="Breadcrumb"
        >
          {breadcrumbs.map((crumb, index) => {
            const isLast = index === breadcrumbs.length - 1;
            return (
              <span key={crumb.href} className="flex items-center gap-2">
                <Link
                  href={crumb.href}
                  className={cn(
                    "transition-colors",
                    isLast ? "text-slate-200" : "hover:text-slate-200",
                  )}
                  aria-current={isLast ? "page" : undefined}
                >
                  {crumb.label}
                </Link>
                {!isLast && <span aria-hidden>/</span>}
              </span>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
