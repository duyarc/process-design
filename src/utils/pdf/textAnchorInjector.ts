/**
 * Generates a clean text anchor tag format: {{acro:fieldId:type:width:height}}
 */
export function buildAnchorTag(id: string, type: string, width: number = 0, height: number = 0): string {
  return `{{acro:${id}:${type}:${Math.round(width)}:${Math.round(height)}}}`;
}

/**
 * Parses a text anchor tag string back into object components
 */
export function parseAnchorTag(tag: string): { id: string; type: string; width: number; height: number } | null {
  const match = tag.match(/\{\{acro:([^:]+):([^:]+):(\d+):(\d+)\}\}/);
  if (!match) return null;
  return {
    id: match[1],
    type: match[2],
    width: parseInt(match[3], 10),
    height: parseInt(match[4], 10),
  };
}
