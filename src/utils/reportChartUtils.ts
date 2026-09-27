import type {
  ChartComponentItem,
  ReportChartItemConfig,
  ScoreRangeCommentRule
} from '../types';

export function getScoreSemanticColor(score: number): 'green' | 'amber' | 'red' {
  if (score >= 3.5) return 'green';
  if (score >= 2.0) return 'amber';
  return 'red';
}

export function getScoreColorHex(score: number): string {
  if (score >= 3.5) return '#0d9488';
  if (score >= 2.0) return '#d97706';
  return '#ef4444';
}

export function calculateWeightedChartScore(components: ChartComponentItem[]): {
  combinedScore: number;
  totalWeight: number;
} {
  let totalWeight = 0;
  let weightedSum = 0;

  for (const item of components) {
    const w = Number(item.weight) || 0;
    const s = Number(item.score) || 0;
    totalWeight += w;
    weightedSum += s * w;
  }

  const rawScore = totalWeight > 0 ? weightedSum / totalWeight : 0;
  const combinedScore = Math.round(rawScore * 10) / 10;
  return {
    combinedScore,
    totalWeight: Math.round(totalWeight)
  };
}

export function resolveChartSummaryState(chart: ReportChartItemConfig): {
  displayNum: string;
  displayTitle: string;
  activeOverallScore: number;
  combinedScore: number;
  totalWeight: number;
  isHeaderVisible: boolean;
} {
  const { combinedScore, totalWeight } = calculateWeightedChartScore(chart.components || []);
  const displayNum = (chart.numLabel || '').trim().replace(/^#/, '');
  const displayTitle = (
    chart.boundSummaryField
      ? chart.boundSummaryField.title
      : chart.manualTitle || ''
  ).trim();
  const activeOverallScore = chart.boundSummaryField
    ? Number(chart.boundSummaryField.score) || 0
    : combinedScore;

  return {
    displayNum,
    displayTitle,
    activeOverallScore: Math.round(activeOverallScore * 10) / 10,
    combinedScore,
    totalWeight,
    isHeaderVisible: Boolean(displayNum || displayTitle)
  };
}

export function resolveScoreRangeComment(
  score: number,
  ranges?: ScoreRangeCommentRule[]
): ScoreRangeCommentRule | null {
  if (!ranges || ranges.length === 0) return null;
  for (const r of ranges) {
    if (score >= r.minScore && score <= r.maxScore) {
      return r;
    }
  }
  return null;
}

export interface RadarSvgLabelPoint {
  x: number;
  y: number;
  anchor: 'start' | 'middle' | 'end';
  dy: string;
  title: string;
  scoreText: string;
  scoreColor: string;
}

export function buildRadarPolygonPoints(
  components: ChartComponentItem[],
  cx: number,
  cy: number,
  radius: number,
  maxScale = 5
): {
  gridRings: string[];
  axesLines: { x1: number; y1: number; x2: number; y2: number }[];
  polygonPoints: string;
  dots: { x: number; y: number }[];
  labels: RadarSvgLabelPoint[];
} {
  const totalAxes = components.length;
  if (totalAxes < 3) {
    return { gridRings: [], axesLines: [], polygonPoints: '', dots: [], labels: [] };
  }

  const gridRings: string[] = [];
  const ringCount = 5;
  for (let r = 1; r <= ringCount; r++) {
    const ringRadius = (radius / ringCount) * r;
    const pts: string[] = [];
    for (let i = 0; i < totalAxes; i++) {
      const angle = -Math.PI / 2 + (i * 2 * Math.PI) / totalAxes;
      const px = (cx + ringRadius * Math.cos(angle)).toFixed(1);
      const py = (cy + ringRadius * Math.sin(angle)).toFixed(1);
      pts.push(`${px},${py}`);
    }
    gridRings.push(pts.join(' '));
  }

  const axesLines: { x1: number; y1: number; x2: number; y2: number }[] = [];
  const dataPts: string[] = [];
  const dots: { x: number; y: number }[] = [];
  const labels: RadarSvgLabelPoint[] = [];

  for (let i = 0; i < totalAxes; i++) {
    const comp = components[i];
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / totalAxes;
    const endX = cx + radius * Math.cos(angle);
    const endY = cy + radius * Math.sin(angle);
    axesLines.push({ x1: cx, y1: cy, x2: endX, y2: endY });

    const normalized = Math.min(1, Math.max(0, (Number(comp.score) || 0) / maxScale));
    const valRadius = radius * normalized;
    const dx = cx + valRadius * Math.cos(angle);
    const dyVal = cy + valRadius * Math.sin(angle);
    dataPts.push(`${dx.toFixed(1)},${dyVal.toFixed(1)}`);
    dots.push({ x: dx, y: dyVal });

    const lx = cx + (radius + 20) * Math.cos(angle);
    const ly = cy + (radius + 20) * Math.sin(angle);
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    const anchor: 'start' | 'middle' | 'end' =
      cosA > 0.3 ? 'start' : cosA < -0.3 ? 'end' : 'middle';
    const dy =
      sinA < -0.7 ? '-0.4em' : sinA > 0.7 ? '1.0em' : '0.35em';

    labels.push({
      x: lx,
      y: ly,
      anchor,
      dy,
      title: comp.title,
      scoreText: `(${(Number(comp.score) || 0).toFixed(1)})`,
      scoreColor: getScoreColorHex(Number(comp.score) || 0)
    });
  }

  return {
    gridRings,
    axesLines,
    polygonPoints: dataPts.join(' '),
    dots,
    labels
  };
}

export function createDefaultRadarChartConfig(id?: string): ReportChartItemConfig {
  return {
    id: id || `radar_${Date.now()}`,
    chartType: 'RADAR',
    numLabel: '',
    manualTitle: '',
    boundSummaryField: null,
    components: []
  };
}

export function createDefaultBarChartConfig(id?: string): ReportChartItemConfig {
  return {
    id: id || `bar_${Date.now()}`,
    chartType: 'BAR',
    numLabel: '',
    manualTitle: '',
    boundSummaryField: null,
    components: [],
    commentRanges: [
      {
        id: 'r1',
        label: 'Cao',
        minScore: 3.5,
        maxScore: 5.0,
        commentText: ''
      },
      {
        id: 'r2',
        label: 'Trung bình',
        minScore: 2.5,
        maxScore: 3.4,
        commentText: ''
      },
      {
        id: 'r3',
        label: 'Cần cải thiện',
        minScore: 0.0,
        maxScore: 2.4,
        commentText: ''
      }
    ]
  };
}

const DEMO_SUMMARY_FIELD_IDS = new Set(['root_health', 'p1']);
const DEMO_COMPONENT_IDS = new Set([
  'ax_1', 'ax_2', 'ax_3', 'ax_4', 'ax_5', 'ax_6',
  'cr_1', 'cr_2', 'cr_3', 'cr_4', 'cr_5'
]);
const DEMO_TITLES = new Set([
  'Đánh giá sức khỏe doanh nghiệp',
  'Định hướng doanh nghiệp'
]);

export function sanitizeDemoChartConfig(chart: ReportChartItemConfig): ReportChartItemConfig {
  const isDemoSummary =
    chart.boundSummaryField &&
    DEMO_SUMMARY_FIELD_IDS.has(chart.boundSummaryField.fieldId) &&
    DEMO_TITLES.has(chart.boundSummaryField.title);

  const isAllDemoComponents =
    Array.isArray(chart.components) &&
    chart.components.length > 0 &&
    chart.components.every(c => DEMO_COMPONENT_IDS.has(c.id));

  if (!isDemoSummary && !isAllDemoComponents) {
    return chart;
  }

  return {
    ...chart,
    numLabel: isDemoSummary && chart.numLabel === '1' ? '' : chart.numLabel,
    manualTitle: DEMO_TITLES.has(chart.manualTitle || '') ? '' : chart.manualTitle,
    boundSummaryField: isDemoSummary ? null : chart.boundSummaryField,
    components: isAllDemoComponents ? [] : chart.components,
    commentRanges: chart.commentRanges?.map(r => ({
      ...r,
      commentText:
        r.commentText.startsWith('Doanh nghiệp có nền tảng chiến lược xuất sắc') ||
        r.commentText.startsWith('Doanh nghiệp đã định hình được một số thông tin nền tảng') ||
        r.commentText.startsWith('Bức tranh định hướng còn sơ khai')
          ? ''
          : r.commentText
    }))
  };
}

