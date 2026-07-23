/**
 * TaskCard — kid-app "Mijn Dag" task row: icon, title, points, big round
 * checkmark button. Mirrors the productvoorstel's home-screen description.
 * @startingPoint section="Kid App" subtitle="Task row with checkmark button" viewport="700x110"
 */
export interface TaskCardProps {
  icon: string;
  title: string;
  points: number;
  done?: boolean;
  onToggle?: () => void;
}
export function TaskCard(props: TaskCardProps): JSX.Element;
