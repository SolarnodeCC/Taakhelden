// Single source for the dashboard navigation: order, routes, i18n label keys,
// and permission gating. `requiresFull` items (task/reward management) mirror
// the API's requireParent(c, { full: true }) enforcement and are hidden from
// approve_only parents. Labels come from the `nav` message namespace.
export interface NavItem {
  key: string;
  href: string;
  requiresFull: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { key: "vandaag", href: "/vandaag", requiresFull: false },
  { key: "goedkeuren", href: "/goedkeuren", requiresFull: false },
  { key: "taken", href: "/taken", requiresFull: true },
  { key: "winkel", href: "/winkel", requiresFull: true },
  { key: "inzichten", href: "/inzichten", requiresFull: false },
];
