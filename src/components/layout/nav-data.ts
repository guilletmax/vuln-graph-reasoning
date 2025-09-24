export type AppNavItem = {
  href: string;
  label: string;
  description?: string;
  icon?: string;
};

export const NAV_ITEMS: AppNavItem[] = [
  {
    href: "/",
    label: "Ingest & Overview",
    description: "Upload findings and see current risk posture.",
    icon: "📥",
  },
  {
    href: "/findings",
    label: "Findings Explorer",
    description: "Slice, filter, and triage findings.",
    icon: "🧭",
  },
  {
    href: "/graph",
    label: "Graph View",
    description: "Interact with the knowledge graph.",
    icon: "🕸️",
  },
  {
    href: "/chat",
    label: "Chat & Agents",
    description: "Collaborate with investigation agents.",
    icon: "💬",
  },
  {
    href: "/canvas",
    label: "Investigation Canvas",
    description: "Curate narratives and briefings.",
    icon: "📝",
  },
  {
    href: "/playbooks",
    label: "Playbooks & Queries",
    description: "Run reusable graph automations.",
    icon: "📚",
  },
  {
    href: "/settings",
    label: "Settings & Models",
    description: "Configure models and org metadata.",
    icon: "⚙️",
  },
];

export const QUICK_ACTIONS = [
  { label: "Open Graph", href: "/graph" },
  { label: "Start Chat Triage", href: "/chat" },
  { label: "Generate CISO Brief", href: "/canvas" },
];
