/**
 * SidebarNav — parent-dashboard left nav, 1:1 with AppShell.tsx: teal filled
 * pill for the active route, transparent otherwise.
 * @startingPoint section="Navigation" subtitle="Dashboard sidebar nav" viewport="320x260"
 */
export interface NavEntry { key: string; label: string; }
export interface SidebarNavProps {
  items: NavEntry[];
  activeKey?: string;
  onNavigate?: (key: string) => void;
}
export function SidebarNav(props: SidebarNavProps): JSX.Element;
