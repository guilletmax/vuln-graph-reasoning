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
];

export const QUICK_ACTIONS = [
  { label: "View Overview", href: "/" },
  { label: "Open Graph", href: "/graph" },
  { label: "Start Chat", href: "/chat" },
];
