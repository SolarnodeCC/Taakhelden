/**
 * AvatarBadge — child avatar with level badge, for "Mijn Held" and the app
 * header. Emoji stand-in for the real avatar-library art (not yet supplied).
 * `tone="teen"` restyles the ring/badge for the muted teen-mode palette.
 * @startingPoint section="Kid App" subtitle="Avatar with level badge" viewport="200x150"
 */
export interface AvatarBadgeProps {
  emoji?: string;
  level?: number;
  size?: number;
  tone?: 'kid' | 'teen';
}
export function AvatarBadge(props: AvatarBadgeProps): JSX.Element;
