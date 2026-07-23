/**
 * RewardCard — reward-shop tile: icon/photo, title, point price. Dims when
 * unaffordable rather than blocking — never a punitive treatment.
 * @startingPoint section="Kid App" subtitle="Reward shop tile" viewport="220x200"
 */
export interface RewardCardProps {
  icon: string;
  title: string;
  price: number;
  affordable?: boolean;
}
export function RewardCard(props: RewardCardProps): JSX.Element;
