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
    manualTitle: 'Đánh giá sức khỏe doanh nghiệp',
    boundSummaryField: {
      fieldId: 'root_health',
      title: 'Đánh giá sức khỏe doanh nghiệp',
      score: 3.0,
      weight: 100
    },
    components: [
      { id: 'ax_1', fieldId: 'p1', title: 'Định hướng doanh nghiệp', score: 2.7, weight: 20 },
      { id: 'ax_2', fieldId: 'p2', title: 'Thị trường & khách hàng', score: 3.0, weight: 20 },
      { id: 'ax_3', fieldId: 'p3', title: 'Quản trị tài chính', score: 3.0, weight: 15 },
      { id: 'ax_4', fieldId: 'p4', title: 'Quản trị sản xuất', score: 3.5, weight: 20 },
      { id: 'ax_5', fieldId: 'p5', title: 'Quản trị công nghệ', score: 3.0, weight: 15 },
      { id: 'ax_6', fieldId: 'p6', title: 'Kế thừa & phát triển tổ chức', score: 3.0, weight: 10 }
    ]
  };
}

export function createDefaultBarChartConfig(id?: string): ReportChartItemConfig {
  return {
    id: id || `bar_${Date.now()}`,
    chartType: 'BAR',
    numLabel: '1',
    manualTitle: 'Định hướng doanh nghiệp',
    boundSummaryField: {
      fieldId: 'p1',
      title: 'Định hướng doanh nghiệp',
      score: 2.7,
      weight: 20
    },
    components: [
      { id: 'cr_1', fieldId: 'c1', title: 'Sản phẩm chủ lực', score: 5.0, weight: 20 },
      { id: 'cr_2', fieldId: 'c2', title: 'Văn hóa tổ chức', score: 0.5, weight: 15 },
      { id: 'cr_3', fieldId: 'c3', title: 'Năng lực cốt lõi', score: 2.5, weight: 25 },
      { id: 'cr_4', fieldId: 'c4', title: 'Hạ tầng & công nghệ', score: 2.0, weight: 15 },
      { id: 'cr_5', fieldId: 'c5', title: 'Đặc trưng nhân sự', score: 2.8, weight: 25 }
    ],
    commentRanges: [
      {
        id: 'r1',
        label: 'Cao',
        minScore: 3.5,
        maxScore: 5.0,
        commentText:
          'Doanh nghiệp có nền tảng chiến lược xuất sắc, định hướng phát triển rõ ràng và nhận được sự đồng thuận cao từ toàn bộ ban lãnh đạo và đội ngũ nhân sự.'
      },
      {
        id: 'r2',
        label: 'Trung bình',
        minScore: 2.5,
        maxScore: 3.4,
        commentText:
          'Doanh nghiệp đã định hình được một số thông tin nền tảng ban đầu nhưng bức tranh định hướng chiến lược tổng thể vẫn còn phân tán và cần đạt được sự đồng thuận nội bộ cao hơn giữa các cấp lãnh đạo.'
      },
      {
        id: 'r3',
        label: 'Cần cải thiện',
        minScore: 0.0,
        maxScore: 2.4,
        commentText:
          'Bức tranh định hướng còn sơ khai, thiếu sự gắn kết giữa các bộ phận cốt lõi, cần nhanh chóng tái định vị và xây dựng lộ trình hành động khẩn cấp.'
      }
    ]
  };
}
