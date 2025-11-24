export const PHASE_COLORS = [
  '#3B82F6', // Blue
  '#EF4444', // Red
  '#10B981', // Green
  '#F59E0B', // Amber
  '#8B5CF6', // Purple
  '#06B6D4', // Cyan
  '#F97316', // Orange
  '#EC4899', // Pink
] as const;

export function getPhaseColor(index: number): string {
  return PHASE_COLORS[index % PHASE_COLORS.length];
}

export function getAllPhaseColors(count: number): string[] {
  return Array.from({ length: count }, (_, i) => getPhaseColor(i));
}
