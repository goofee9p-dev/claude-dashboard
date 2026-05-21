/* ── 매체 고정 색상 ─────────────────────────────────────────── */
const MEDIA_COLORS = {
  "네이버(GFA)":                        "#00B894",
  "네이버 검색광고(zinusinc.naver)":    "#00CEC9",
  "네이버 검색광고(sypglobal01)":       "#55EFC4",
  "메타(공홈)":                         "#6C5CE7",
  "메타(네이버협력)":                   "#A29BFE",
  "메타(오늘의집)":                     "#FD79A8",
  "구글":                              "#E17055",
  /* 브랜드검색 캠페인 */
  "4.브랜드 검색":                      "#6C5CE7",
};
function mediaColor(name) {
  return MEDIA_COLORS[String(name)] || "#b2bec3";
}

/* ── 필터 레이블 ────────────────────────────────────────────── */
const FILTER_LABELS = { media: "매체", promotion: "프로모션", objective: "목적", target: "타겟" };

const moneyFormatter = new Intl.NumberFormat("ko-KR", {
  style: "currency",
  currency: "KRW",
  maximumFractionDigits: 0,
});
const numberFormatter = new Intl.NumberFormat("ko-KR");
const percentFormatter = new Intl.NumberFormat("ko-KR", {
  style: "percent",
  maximumFractionDigits: 2,
});
const decimalFormatter = new Intl.NumberFormat("ko-KR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const state = {
  data: null,
  promotionIndex: [],
  metric: "impressions",
  secondaryMetric: null,
  groupBy: "promotion",
  filters: {
    type: "all",
    promotion: "all",
    objective: "all",
    target: "all",
    channel: "all",
    media: "all",
  },
  range: {
    dateStart: "",
    dateEnd: "",
  },
  pendingRange: {
    dateStart: "",
    dateEnd: "",
  },
  promotionDetail: "all",
  campaignQuery: "",
  creativeQuery: "",
  keywordQuery: "",
  currentView: "home",
  homeMedia: "all",
  homePromotion: "all",
  brandMetric: "clicks",
  brandCreativeDevice: "all",
  reportMetrics: {
    daily: ["cost", "ctr", null],
    weekly: ["cost", "ctr", null],
    monthly: ["cost", "ctr", null],
  },
  homeDailyMetrics: ["cost", "ctr", null],
  homeMediaMetric: "cost",
  mediaReportMetrics: ["cost", "ctr", null],
  activePreset: null,
  showAnomalyMarkers: false,
  promotionViewFilter: [],
  homeWidgetOrder: (() => { try { const v = JSON.parse(localStorage.getItem('zinus-home-widgets')); return Array.isArray(v) ? v : ['media-pie','daily-trend','insights']; } catch { return ['media-pie','daily-trend','insights']; } })(),
  homeWidgetSizes: (() => { try { const v = JSON.parse(localStorage.getItem('zinus-widget-sizes')); return (v && typeof v === 'object') ? v : {}; } catch { return {}; } })(),
  kpiOrder: (() => { try { const v = JSON.parse(localStorage.getItem('zinus-kpi-order')); return Array.isArray(v) ? v : ['impressions','clicks','cost','purchases','revenue','ctr','cpc','cvr','cpa','roas']; } catch { return ['impressions','clicks','cost','purchases','revenue','ctr','cpc','cvr','cpa','roas']; } })(),
  homeEditMode: false,
  kpiJiggle: false,
};

const homeMediaOptions = {
  all: { label: "전체", matches: () => true },
  naver: { label: "네이버", matches: (row) => String(row.media || "").startsWith("네이버") },
  "naver-syp": { label: "sypglobal01", matches: (row) => row.media === "네이버 검색광고(sypglobal01)" },
  "naver-zinus": { label: "zinusinc:naver", matches: (row) => row.media === "네이버 검색광고(zinusinc.naver)" },
  "naver-gfa": { label: "GFA-주식회사 지누스", matches: (row) => row.media === "네이버(GFA)" },
  meta: { label: "메타", matches: (row) => String(row.media || "").startsWith("메타") },
  "meta-naver": { label: "네이버 협력", matches: (row) => row.media === "메타(네이버협력)" },
  "meta-ohouse": { label: "오늘의집 협력", matches: (row) => row.media === "메타(오늘의집)" },
  "meta-official": { label: "메타 공홈", matches: (row) => row.media === "메타(공홈)" },
  google: { label: "구글", matches: (row) => row.media === "구글" },
};

const quickMediaOrder = ["all", "naver", "naver-syp", "naver-zinus", "naver-gfa", "meta", "meta-naver", "meta-ohouse", "meta-official", "google"];
let datePickerMonth = null;
let datePickerSelecting = "start";

const metricMeta = {
  impressions: { label: "노출", unit: "회", basis: "노출수 합계(회)", format: formatNumber },
  clicks: { label: "클릭", unit: "회", basis: "클릭수 합계(회)", format: formatNumber },
  cost: { label: "비용", unit: "원", basis: "네이버는 총비용 VAT+, 메타/구글은 총비용 VAT+ × Fee+ 기준(원)", format: formatMoney },
  purchases: { label: "전환", unit: "건", basis: "구매완료 수 합계(건)", format: formatNumber },
  revenue: { label: "매출", unit: "원", basis: "구매완료 전환매출액 합계(원)", format: formatMoney },
  ctr: { label: "CTR", unit: "%", basis: "CTR=클릭수/노출수", format: formatPercent },
  cpc: { label: "CPC", unit: "원", basis: "CPC=VAT+/Fee+ 비용/클릭수", format: formatMoney },
  cvr: { label: "CVR", unit: "%", basis: "CVR=구매완료 수/클릭수", format: formatPercent },
  cpa: { label: "CPA", unit: "원", basis: "CPA=VAT+/Fee+ 비용/구매완료 수", format: formatMoney },
  roas: { label: "ROAS", unit: "%", basis: "ROAS=전환매출액/VAT+/Fee+ 비용", format: formatRoas },
};

const metricOrder = ["impressions", "clicks", "cost", "purchases", "revenue", "ctr", "cpc", "cvr", "cpa", "roas"];
const brandMetricOrder = ["impressions", "clicks", "ctr", "purchases", "revenue", "cvr"];

function metricSelectLabel(metric) {
  if (metric === "cost") return "비용(VAT+/Fee+)";
  return metricMeta[metric]?.label ?? metric;
}

function metricOptionsHtml(includeNone = false) {
  const options = metricOrder
    .map((metric) => `<option value="${metric}">${escapeHtml(metricSelectLabel(metric))}</option>`)
    .join("");
  return includeNone ? `<option value="">없음</option>${options}` : options;
}

function brandMetricOptionsHtml() {
  return brandMetricOrder
    .map((metric) => `<option value="${metric}">${escapeHtml(metricSelectLabel(metric))}</option>`)
    .join("");
}

const groupMeta = {
  promotion: "프로모션명",
  objective: "목적",
  target: "타겟",
  type: "상시/프로모션",
  channel: "상품/지면",
  creativeTheme: "소재 메시지",
  campaign: "캠페인",
  group: "그룹",
  creative: "소재",
};

const viewMeta = {
  home: ["Home", "광고 전반 지표를 한눈에 확인합니다."],
  daily: ["일간 보고서", "선택 기간의 일자별 성과 추이를 확인합니다."],
  weekly: ["주간 보고서", "선택 기간의 주차별 성과 추이를 확인합니다."],
  monthly: ["월간 보고서", "선택 기간의 월별 성과 추이를 확인합니다."],
  media: ["매체 보고서", "네이버, 메타, 구글과 세부 계정의 성과를 비교합니다."],
  brand: ["브랜드 검색", "브랜드 검색 캠페인의 노출, 클릭, 전환 흐름을 확인합니다."],
  promotion: ["프로모션 보고서", "프로모션별 성과와 매체 기여도를 확인합니다."],
  keyword: ["키워드 보고서", "기간 기준 키워드 매출 TOP10, ROAS 고효율 키워드와 상세를 확인합니다."],
};

function formatMoney(value) {
  return moneyFormatter.format(Math.round(value || 0));
}

function formatCompactMoney(value) {
  const safe = Math.round(value || 0);
  if (Math.abs(safe) >= 100000000) return `${(safe / 100000000).toFixed(1)}억`;
  if (Math.abs(safe) >= 10000) return `${Math.round(safe / 10000).toLocaleString("ko-KR")}만`;
  return safe.toLocaleString("ko-KR");
}

function formatNumber(value) {
  return numberFormatter.format(Math.round(value || 0));
}

function formatPercent(value) {
  return percentFormatter.format(value || 0);
}

function formatRoas(value) {
  return `${Math.round((value || 0) * 100).toLocaleString("ko-KR")}%`;
}

function formatShort(value, metric) {
  if (metric === "ctr" || metric === "cvr") return formatPercent(value);
  if (metric === "roas") return formatRoas(value);
  if (metric === "purchases" || metric === "clicks" || metric === "impressions") return formatNumber(value);
  return formatCompactMoney(value);
}

function formatDetailed(value, metric) {
  if (metric === "ctr" || metric === "cvr") return formatPercent(value);
  if (metric === "roas") return formatRoas(value);
  if (metric === "cost" || metric === "revenue" || metric === "cpc" || metric === "cpa") return formatMoney(value);
  const number = decimalFormatter.format(value || 0);
  const unit = metricMeta[metric]?.unit ?? "";
  return `${number}${unit}`;
}

function formatPlainMoney(value) {
  return Math.round(value || 0).toLocaleString("ko-KR");
}

function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseLocalDate(value) {
  return new Date(`${value}T00:00:00`);
}

function truncate(text, length = 34) {
  const safe = String(text ?? "-");
  return safe.length > length ? `${safe.slice(0, length - 1)}...` : safe;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/\n/g, "&#10;");
}

function splitLabel(text, firstLineLimit = 13, secondLineLimit = 18) {
  const safe = String(text ?? "-");
  if (safe.length <= firstLineLimit) return [safe];

  const preferredBreaks = [" ", "_", "+", "-"];
  let breakAt = -1;
  for (const char of preferredBreaks) {
    const idx = safe.lastIndexOf(char, firstLineLimit);
    if (idx > 4) {
      breakAt = idx + (char === " " ? 0 : 1);
      break;
    }
  }

  if (breakAt < 0) breakAt = firstLineLimit;
  const first = safe.slice(0, breakAt).trim();
  let second = safe.slice(breakAt).trim();
  if (second.length > secondLineLimit) second = `${second.slice(0, secondLineLimit - 1)}…`;
  return second ? [first, second] : [first];
}

function svgMultilineLabel(text, x, y, options = {}) {
  const lines = splitLabel(text, options.firstLineLimit ?? 13, options.secondLineLimit ?? 18);
  const anchor = options.anchor ?? "end";
  const lineHeight = options.lineHeight ?? 12;
  const startY = lines.length > 1 ? y - lineHeight / 2 : y;
  return `<text class="axis axis-label" x="${x}" y="${startY}" text-anchor="${anchor}">
    ${lines.map((line, idx) => `<tspan x="${x}" dy="${idx === 0 ? 0 : lineHeight}">${escapeHtml(line)}</tspan>`).join("")}
  </text>`;
}

function emptyMetrics() {
  return { cost: 0, impressions: 0, clicks: 0, purchases: 0, revenue: 0 };
}

function addMetrics(target, row) {
  target.cost += adjustedCost(row);
  target.impressions += row.impressions || 0;
  target.clicks += row.clicks || 0;
  target.purchases += row.purchases || 0;
  target.revenue += row.revenue || 0;
}

function adjustedCost(row) {
  const baseCost = row.cost || 0;
  const media = String(row.media ?? "");
  const vat = 1.1;
  const markup = media.includes("메타") || media.includes("구글") ? 1.13 : 1;
  return baseCost * vat * markup;
}

function enrich(item) {
  return {
    ...item,
    ctr: item.impressions ? item.clicks / item.impressions : 0,
    cvr: item.clicks ? item.purchases / item.clicks : 0,
    roas: item.cost ? item.revenue / item.cost : 0,
    cpc: item.clicks ? item.cost / item.clicks : 0,
    cpa: item.purchases ? item.cost / item.purchases : 0,
  };
}

function filteredRecords() {
  return state.data.records.filter((row) => {
    const dimensionMatch = Object.entries(state.filters).every(([key, value]) => {
      if (state.homeMedia !== "all" && key === "media") return true;
      if (state.homePromotion !== "all" && key === "promotion") return true;
      return value === "all" || String(row[key]) === String(value);
    });
    const homeMediaMatch = state.homeMedia === "all"
      || homeMediaOptions[state.homeMedia]?.matches(row);
    const homePromotionMatch = state.homePromotion === "all"
      || row.promotion === state.homePromotion;
    const dateMatch = (!state.range.dateStart || row.date >= state.range.dateStart)
      && (!state.range.dateEnd || row.date <= state.range.dateEnd);
    return dimensionMatch && homeMediaMatch && homePromotionMatch && dateMatch;
  });
}

function filteredKeywordRecords() {
  const keywordRecords = state.data.keywordRecords || [];
  return keywordRecords.filter((row) => {
    const dimensionMatch = Object.entries(state.filters).every(([key, value]) => {
      if (state.homeMedia !== "all" && key === "media") return true;
      if (state.homePromotion !== "all" && key === "promotion") return true;
      if (value === "all") return true;
      if (!(key in row)) return true;
      return String(row[key]) === String(value);
    });
    const homeMediaMatch = state.homeMedia === "all"
      || homeMediaOptions[state.homeMedia]?.matches(row);
    const homePromotionMatch = state.homePromotion === "all"
      || row.promotion === state.homePromotion;
    const dateMatch = (!state.range.dateStart || row.date >= state.range.dateStart)
      && (!state.range.dateEnd || row.date <= state.range.dateEnd);
    return dimensionMatch && homeMediaMatch && homePromotionMatch && dateMatch;
  });
}

function previousPeriodRows() {
  const { dateStart, dateEnd } = state.range;
  if (!dateStart || !dateEnd) return [];
  const start = new Date(`${dateStart}T00:00:00`);
  const end = new Date(`${dateEnd}T00:00:00`);
  const diffDays = Math.round((end - start) / 86400000) + 1;
  const prevEnd = new Date(start);
  prevEnd.setDate(prevEnd.getDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevEnd.getDate() - diffDays + 1);
  const prevStartStr = formatLocalDate(prevStart);
  const prevEndStr = formatLocalDate(prevEnd);

  return state.data.records.filter((row) => {
    if (!row.date || row.date < prevStartStr || row.date > prevEndStr) return false;
    const dimensionMatch = Object.entries(state.filters).every(([key, value]) => {
      if (state.homeMedia !== "all" && key === "media") return true;
      if (state.homePromotion !== "all" && key === "promotion") return true;
      return value === "all" || String(row[key]) === String(value);
    });
    const homeMediaMatch =
      state.homeMedia === "all" ||
      homeMediaOptions[state.homeMedia]?.matches(row);
    const homePromotionMatch =
      state.homePromotion === "all" ||
      row.promotion === state.homePromotion;
    return dimensionMatch && homeMediaMatch && homePromotionMatch;
  });
}

function aggregate(rows, key) {
  const map = new Map();
  for (const row of rows) {
    const name = row[key] || "기타";
    if (!map.has(name)) map.set(name, emptyMetrics());
    addMetrics(map.get(name), row);
  }
  return [...map.entries()]
    .map(([name, metrics]) => enrich({ name, ...metrics }))
    .sort((a, b) => (b[state.metric] || 0) - (a[state.metric] || 0));
}

function keywordName(row) {
  return row.keyword || row.searchKeyword || row.creative || "키워드 없음";
}

function aggregateByName(rows, keyFn) {
  const map = new Map();
  for (const row of rows) {
    const name = keyFn(row) || "기타";
    if (!map.has(name)) map.set(name, emptyMetrics());
    addMetrics(map.get(name), row);
  }
  return [...map.entries()]
    .map(([name, metrics]) => enrich({ name, ...metrics }))
    .sort((a, b) => b.revenue - a.revenue);
}

function weekKey(date) {
  const d = parseLocalDate(date);
  if (Number.isNaN(d.getTime())) return date;
  const day = d.getDay() || 7;
  const monday = new Date(d);
  monday.setDate(d.getDate() - day + 1);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return `${formatLocalDate(monday)} ~ ${formatLocalDate(sunday)}`;
}

function monthKey(date) {
  return String(date || "").slice(0, 7);
}

function availableWeeks() {
  return [...new Set(state.data.records.map((row) => weekKey(row.date)).filter(Boolean))].sort();
}

function aggregateRows(rows) {
  const totals = rows.reduce((acc, row) => {
    addMetrics(acc, row);
    return acc;
  }, emptyMetrics());
  return enrich(totals);
}

function aggregateTotals(rows) {
  return aggregateRows(rows);
}

function uniqueValues(key) {
  return [...new Set(state.data.records.map((row) => row[key]).filter(Boolean))]
    .sort((a, b) => String(a).localeCompare(String(b), "ko"));
}

function buildPromotionIndex() {
  const index = new Map();
  for (const row of state.data.records) {
    const prom = row.promotion || "";
    if (!prom) continue;
    if (!index.has(prom)) {
      index.set(prom, {
        name: prom,
        firstDate: "9999-99-99",
        lastDate: "0000-00-00",
        revenue: 0,
        hasPCampaign: false,
        hasACampaign: false,
      });
    }
    const item = index.get(prom);
    if (row.date) {
      if (row.date < item.firstDate) item.firstDate = row.date;
      if (row.date > item.lastDate) item.lastDate = row.date;
    }
    item.revenue += row.revenue || 0;
    const firstChar = (row.campaign || "").charAt(0).toUpperCase();
    if (firstChar === "P") item.hasPCampaign = true;
    if (firstChar === "A") item.hasACampaign = true;
  }

  return [...index.values()]
    .filter((item) => {
      const normalized = item.name.trim().toLowerCase();
      if (!normalized) return false;
      if (normalized === "상시" || normalized === "프로모션" || normalized === "전체 프로모션") return false;
      if (normalized.includes("advoost") || normalized.includes("advosst")) return false;
      if (item.hasACampaign && !item.hasPCampaign) return false;
      return true;
    })
    .sort((a, b) => b.lastDate.localeCompare(a.lastDate) || b.revenue - a.revenue);
}

function populateFilter(id, key, label) {
  const select = document.querySelector(id);
  const current = state.filters[key];
  const values = uniqueValues(key);
  select.innerHTML = `<option value="all">${label} 전체</option>` + values
    .map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`)
    .join("");
  select.value = values.includes(current) ? current : "all";
  updateFilterSelectDisplay(select);
}

function quickMediaGroup(key) {
  if (key.startsWith("naver")) return "naver";
  if (key.startsWith("meta")) return "meta";
  if (key === "google") return "google";
  return "all";
}

function renderMediaQuickFilter() {
  const wrap = document.querySelector("#mediaQuickFilter");
  if (!wrap) return;
  wrap.innerHTML = quickMediaOrder
    .filter((key) => homeMediaOptions[key])
    .map((key) => {
      const option = homeMediaOptions[key];
      const isMajor = ["all", "naver", "meta", "google"].includes(key);
      return `<button type="button" class="media-quick-btn${isMajor ? " is-major" : ""}" data-home-media="${escapeAttribute(key)}" data-media-group="${escapeAttribute(quickMediaGroup(key))}">
        ${escapeHtml(option.label)}
      </button>`;
    })
    .join("");
}

function clearDrawerMediaFilter() {
  state.filters.media = "all";
  pendingFilters.media = "all";
  const mediaSelect = document.querySelector("#drawerMediaFilter");
  if (mediaSelect) {
    mediaSelect.value = "all";
    updateFilterSelectDisplay(mediaSelect);
  }
}

function populateMetricControls() {
  document.querySelectorAll("[data-primary-metric-select]").forEach((select) => {
    select.innerHTML = metricOptionsHtml();
    select.value = metricOrder.includes(state.metric) ? state.metric : "impressions";
  });

  const secondaryMetricSelect = document.querySelector("#secondaryMetricSelect");
  if (secondaryMetricSelect) {
    secondaryMetricSelect.innerHTML = metricOptionsHtml(true);
    secondaryMetricSelect.value = state.secondaryMetric || "";
  }

  const brandMetricSelect = document.querySelector("#brandMetricSelect");
  if (brandMetricSelect) {
    brandMetricSelect.innerHTML = brandMetricOptionsHtml();
    brandMetricSelect.value = brandMetricOrder.includes(state.brandMetric) ? state.brandMetric : "clicks";
  }
}

function updateFilterSelectDisplay(select) {
  if (!select) return;
  const display = document.querySelector(`[data-filter-select-display="${select.id}"]`);
  if (!display) return;
  display.textContent = select.options[select.selectedIndex]?.textContent || "";
}

function populateRangeControls() {
  const dates = uniqueValues("date");
  const dateStart = document.querySelector("#dateStart");
  const dateEnd = document.querySelector("#dateEnd");

  const hasSavedRange = Boolean(state.range.dateStart || state.range.dateEnd);
  if (!hasSavedRange && dates.length) {
    const { start, end } = getPresetRange("D30");
    state.range.dateStart = start;
    state.range.dateEnd = end;
    state.activePreset = "D30";
  } else {
    state.range.dateStart = state.range.dateStart || dates[0] || "";
    state.range.dateEnd = state.range.dateEnd || dates.at(-1) || "";
  }
  state.pendingRange.dateStart = state.pendingRange.dateStart || state.range.dateStart;
  state.pendingRange.dateEnd = state.pendingRange.dateEnd || state.range.dateEnd;

  if (dateStart.type !== "hidden") {
    dateStart.min = dates[0] || "";
    dateStart.max = dates.at(-1) || "";
  }
  if (dateEnd.type !== "hidden") {
    dateEnd.min = dates[0] || "";
    dateEnd.max = dates.at(-1) || "";
  }
  dateStart.value = state.pendingRange.dateStart;
  dateEnd.value = state.pendingRange.dateEnd;
  if (!datePickerMonth && state.range.dateStart) {
    const start = parseLocalDate(state.range.dateStart);
    datePickerMonth = new Date(start.getFullYear(), start.getMonth(), 1);
  }
  updateDateRangeText();
  renderDatePicker();
}

function populatePromotionDetailSelect() {
  const select = document.querySelector("#promotionDetailSelect");
  if (!select) return;
  const promotions = uniqueValues("promotion");
  const topPromotion = aggregate(filteredRecords(), "promotion")[0]?.name ?? promotions[0] ?? "all";
  if (state.promotionDetail === "all") state.promotionDetail = topPromotion;

  select.innerHTML = promotions
    .map((promotion) => `<option value="${escapeHtml(promotion)}">${escapeHtml(promotion)}</option>`)
    .join("");
  select.value = promotions.includes(state.promotionDetail) ? state.promotionDetail : topPromotion;
  state.promotionDetail = select.value;
}

function populateWeekSelects() {
  const weeks = availableWeeks();
  for (const [id, fallbackIndex] of [["#weekASelect", Math.max(0, weeks.length - 2)], ["#weekBSelect", Math.max(0, weeks.length - 1)]]) {
    const select = document.querySelector(id);
    if (!select) continue;
    const savedValue = select.value;
    select.innerHTML = weeks.map((week) => `<option value="${escapeHtml(week)}">${escapeHtml(week)}</option>`).join("");
    select.value = savedValue && weeks.includes(savedValue) ? savedValue : weeks[fallbackIndex] ?? "";
  }
}

function dateBounds() {
  const dates = uniqueValues("date");
  return { minDate: dates[0] || "", maxDate: dates.at(-1) || "" };
}

function referenceDateForRange(minDate, maxDate) {
  const sysToday = new Date();
  const sysStr = formatLocalDate(sysToday);
  return sysStr >= minDate && sysStr <= maxDate
    ? sysToday
    : parseLocalDate(maxDate);
}

function clampDate(value, minDate, maxDate) {
  if (!value) return value;
  if (minDate && value < minDate) return minDate;
  if (maxDate && value > maxDate) return maxDate;
  return value;
}

function getPresetRange(preset) {
  const { minDate, maxDate } = dateBounds();
  const today = referenceDateForRange(minDate, maxDate);
  let start = minDate;
  let end = maxDate;

  if (preset === "thisWeek") {
    const day = today.getDay() || 7;
    const monday = new Date(today);
    monday.setDate(today.getDate() - day + 1);
    start = formatLocalDate(monday);
    end = maxDate;
  } else if (preset === "lastWeek") {
    const day = today.getDay() || 7;
    const prevMonday = new Date(today);
    prevMonday.setDate(today.getDate() - day + 1 - 7);
    const prevSunday = new Date(prevMonday);
    prevSunday.setDate(prevMonday.getDate() + 6);
    start = formatLocalDate(prevMonday);
    end = formatLocalDate(prevSunday);
  } else if (preset === "thisMonth") {
    const y = today.getFullYear();
    const m = today.getMonth() + 1;
    start = `${y}-${String(m).padStart(2, "0")}-01`;
    end = maxDate;
  } else if (preset === "lastMonth") {
    const lastDay = new Date(today.getFullYear(), today.getMonth(), 0);
    const firstDay = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    start = formatLocalDate(firstDay);
    end = formatLocalDate(lastDay);
  } else if (preset === "D7") {
    const d = new Date(today);
    d.setDate(d.getDate() - 6);
    start = formatLocalDate(d);
    end = formatLocalDate(today);
  } else if (preset === "D30") {
    const d = new Date(today);
    d.setDate(d.getDate() - 29);
    start = formatLocalDate(d);
    end = formatLocalDate(today);
  } else if (preset === "D365") {
    const d = new Date(today);
    d.setDate(d.getDate() - 364);
    start = formatLocalDate(d);
    end = formatLocalDate(today);
  } else if (preset === "today") {
    start = formatLocalDate(today);
    end = formatLocalDate(today);
  } else if (preset === "yesterday") {
    const yest = new Date(today);
    yest.setDate(yest.getDate() - 1);
    start = formatLocalDate(yest);
    end = formatLocalDate(yest);
  }

  start = clampDate(start, minDate, maxDate);
  end = clampDate(end, minDate, maxDate);
  if (end < start) end = start;
  return { start, end };
}

function commitDateRange(start, end, preset = null) {
  state.activePreset = preset;
  state.range.dateStart = start;
  state.range.dateEnd = end;
  state.pendingRange = { ...state.range };
  document.querySelector("#dateStart").value = start;
  document.querySelector("#dateEnd").value = end;
  updateDateRangeText();
  renderDatePicker();
  populatePromotionDetailSelect();
  populateWeekSelects();
  renderAll();
}

function applyPreset(preset) {
  const { start, end } = getPresetRange(preset);
  commitDateRange(start, end, preset);
}

function setPendingDateRange(start, end = "") {
  const { minDate, maxDate } = dateBounds();
  let safeStart = clampDate(start, minDate, maxDate);
  let safeEnd = end ? clampDate(end, minDate, maxDate) : "";
  if (safeStart && safeEnd && safeStart > safeEnd) {
    [safeStart, safeEnd] = [safeEnd, safeStart];
  }
  state.pendingRange.dateStart = safeStart || "";
  state.pendingRange.dateEnd = safeEnd || "";
  document.querySelector("#dateStart").value = state.pendingRange.dateStart;
  document.querySelector("#dateEnd").value = state.pendingRange.dateEnd;
  renderDatePicker();
}

function applyPendingDateRange() {
  let start = state.pendingRange.dateStart || state.range.dateStart;
  let end = state.pendingRange.dateEnd || start || state.range.dateEnd;
  if (start && end && start > end) [start, end] = [end, start];
  commitDateRange(start, end, state.activePreset);
  closeDatePicker();
}

function setDatePickerPreset(preset) {
  const { start, end } = getPresetRange(preset);
  state.activePreset = preset;
  setPendingDateRange(start, end);
}

function updateDateRangeText() {
  const text = document.querySelector("#dateRangeText");
  if (!text) return;
  const start = state.range.dateStart || "-";
  const end = state.range.dateEnd || "-";
  text.textContent = `${start} ~ ${end}`;
}

function openDatePicker() {
  const panel = document.querySelector("#datePickerPanel");
  const trigger = document.querySelector("#dateRangeTrigger");
  if (!panel || !trigger) return;
  state.pendingRange = { ...state.range };
  const basis = state.range.dateStart || state.range.dateEnd;
  if (basis) {
    const date = parseLocalDate(basis);
    datePickerMonth = new Date(date.getFullYear(), date.getMonth(), 1);
  }
  datePickerSelecting = "start";
  renderDatePicker();
  panel.classList.add("is-open");
  panel.setAttribute("aria-hidden", "false");
  trigger.setAttribute("aria-expanded", "true");
}

function closeDatePicker() {
  const panel = document.querySelector("#datePickerPanel");
  const trigger = document.querySelector("#dateRangeTrigger");
  if (!panel || !trigger) return;
  panel.classList.remove("is-open");
  panel.setAttribute("aria-hidden", "true");
  trigger.setAttribute("aria-expanded", "false");
  state.pendingRange = { ...state.range };
  document.querySelector("#dateStart").value = state.range.dateStart;
  document.querySelector("#dateEnd").value = state.range.dateEnd;
  renderDatePicker();
}

function shiftDatePickerMonth(delta) {
  const basis = datePickerMonth || parseLocalDate(state.range.dateStart || dateBounds().maxDate);
  datePickerMonth = new Date(basis.getFullYear(), basis.getMonth() + delta, 1);
  renderDatePicker();
}

function renderDatePicker() {
  const wrap = document.querySelector("#datePickerMonths");
  if (!wrap) return;
  const { minDate, maxDate } = dateBounds();
  if (!minDate || !maxDate) {
    wrap.innerHTML = `<div class="date-picker-empty">날짜 데이터가 없습니다.</div>`;
    return;
  }
  const base = datePickerMonth || parseLocalDate(state.range.dateStart || minDate);
  datePickerMonth = new Date(base.getFullYear(), base.getMonth(), 1);
  const months = [datePickerMonth, new Date(datePickerMonth.getFullYear(), datePickerMonth.getMonth() + 1, 1)];
  wrap.innerHTML = months.map((month, index) => renderDatePickerMonth(month, index, minDate, maxDate)).join("");
  document.querySelectorAll(".date-preset-chip").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.preset === state.activePreset);
  });
}

function renderDatePickerMonth(month, index, minDate, maxDate) {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const title = `${year}. ${monthIndex + 1}.`;
  const first = new Date(year, monthIndex, 1);
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  const blanks = first.getDay();
  const selectedStart = state.pendingRange.dateStart;
  const selectedEnd = state.pendingRange.dateEnd;
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  const cells = [];
  for (let i = 0; i < blanks; i += 1) {
    cells.push(`<span class="date-picker-day is-empty"></span>`);
  }
  for (let day = 1; day <= lastDay; day += 1) {
    const value = formatLocalDate(new Date(year, monthIndex, day));
    const disabled = value < minDate || value > maxDate;
    const isStart = value === selectedStart;
    const isEnd = value === selectedEnd;
    const inRange = selectedStart && selectedEnd && value > selectedStart && value < selectedEnd;
    const classes = [
      "date-picker-day",
      disabled ? "is-disabled" : "",
      isStart ? "is-start" : "",
      isEnd ? "is-end" : "",
      inRange ? "is-in-range" : "",
    ].filter(Boolean).join(" ");
    cells.push(`<button type="button" class="${classes}" data-date="${escapeAttribute(value)}" ${disabled ? "disabled" : ""}>${day}</button>`);
  }
  const nav = index === 1
    ? `<div class="date-picker-nav">
        <button type="button" data-calendar-nav="-1" aria-label="이전 달">‹</button>
        <button type="button" data-calendar-nav="1" aria-label="다음 달">›</button>
      </div>`
    : "";
  return `<section class="date-picker-calendar">
    <header class="date-picker-month-header">
      <strong>${escapeHtml(title)} <span>⌄</span></strong>
      ${nav}
    </header>
    <div class="date-picker-weekdays">${weekdays.map((day) => `<span>${day}</span>`).join("")}</div>
    <div class="date-picker-grid">${cells.join("")}</div>
  </section>`;
}

/* ── Preset Labels ───────────────────────────────────────────── */

function updatePresetLabels() {
  const dates = uniqueValues("date");
  const minDate = dates[0] || "";
  const maxDate = dates.at(-1) || "";
  const sysStr = formatLocalDate(new Date());
  const ref = sysStr >= minDate && sysStr <= maxDate
    ? parseLocalDate(sysStr)
    : parseLocalDate(maxDate);

  const isoDate = formatLocalDate;
  const pad = (n) => String(n).padStart(2, "0");
  const m = (d) => d.getMonth() + 1;
  const day = (d) => d.getDate();

  const dayOfWeek = ref.getDay() || 7;
  const monday = new Date(ref);
  monday.setDate(ref.getDate() - dayOfWeek + 1);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const prevMonday = new Date(monday);
  prevMonday.setDate(monday.getDate() - 7);
  const prevSunday = new Date(prevMonday);
  prevSunday.setDate(prevMonday.getDate() + 6);

  const weekNum = (mon) => Math.ceil(mon.getDate() / 7);

  const d7start = new Date(ref);
  d7start.setDate(ref.getDate() - 6);
  const d30start = new Date(ref);
  d30start.setDate(ref.getDate() - 29);
  const d365start = new Date(ref);
  d365start.setDate(ref.getDate() - 364);

  const yesterday = new Date(ref);
  yesterday.setDate(ref.getDate() - 1);

  const lastMonthEnd = new Date(ref.getFullYear(), ref.getMonth(), 0);
  const lastMonthStart = new Date(ref.getFullYear(), ref.getMonth() - 1, 1);

  const labels = {
    thisWeek: {
      main: "이번 주",
      sub: `${m(monday)}월 ${weekNum(monday)}째주 (${day(monday)}~${day(sunday)})`,
    },
    lastWeek: {
      main: "지난 주",
      sub: `${m(prevMonday)}월 ${weekNum(prevMonday)}째주 (${day(prevMonday)}~${day(prevSunday)})`,
    },
    D7: {
      main: "D-7",
      sub: `${m(d7start)}.${pad(day(d7start))}~${m(ref)}.${pad(day(ref))}`,
    },
    D30: {
      main: "D-30",
      sub: `${m(d30start)}.${pad(day(d30start))}~${m(ref)}.${pad(day(ref))}`,
    },
    D365: {
      main: "1년",
      sub: `${d365start.getFullYear()}.${pad(m(d365start))}~${ref.getFullYear()}.${pad(m(ref))}`,
    },
    thisMonth: {
      main: "이번 달",
      sub: `${m(ref)}월 (1~${day(ref)})`,
    },
    lastMonth: {
      main: "지난 달",
      sub: `${m(lastMonthStart)}월 (${day(lastMonthStart)}~${day(lastMonthEnd)})`,
    },
    today: {
      main: "오늘",
      sub: `${m(ref)}월 ${pad(day(ref))}일`,
    },
    yesterday: {
      main: "어제",
      sub: `${m(yesterday)}월 ${pad(day(yesterday))}일`,
    },
    all: { main: "전체", sub: "" },
  };

  document.querySelectorAll(".preset-button").forEach((btn) => {
    const info = labels[btn.dataset.preset];
    if (!info) return;
    if (btn.classList.contains("date-preset-chip")) {
      const compact = { yesterday: "어제", thisMonth: "이번 달", D7: "7일", D30: "30일", D365: "1년" };
      btn.textContent = compact[btn.dataset.preset] ?? info.main;
      return;
    }
    btn.innerHTML = `<span class="preset-main">${info.main}</span>${info.sub ? `<span class="preset-sub">${escapeHtml(info.sub)}</span>` : ""}`;
  });
}

/* ── Promotion Modal ─────────────────────────────────────────── */

function openPromotionModal() {
  const modal = document.querySelector("#promotionModal");
  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden", "false");
  const searchInput = document.querySelector("#promotionModalSearch");
  searchInput.value = "";
  renderPromotionModalList("");
  searchInput.focus();
}

function closePromotionModal() {
  const modal = document.querySelector("#promotionModal");
  modal.classList.remove("is-open");
  modal.setAttribute("aria-hidden", "true");
}

function renderPromotionModalList(query) {
  const list = document.querySelector("#promotionModalList");
  const q = (query || "").trim().toLowerCase();
  const promotions = state.promotionIndex;
  const filtered = q ? promotions.filter((p) => p.name.toLowerCase().includes(q)) : promotions;

  const monthGroups = filtered.reduce((groups, item) => {
    const ym = item.lastDate.slice(0, 7);
    const m = ym ? `${Number(ym.slice(5, 7))}월 (${ym.slice(0, 4)})` : "기타";
    if (!groups.has(m)) groups.set(m, []);
    groups.get(m).push(item);
    return groups;
  }, new Map());

  const allActiveClass = state.homePromotion === "all" ? "is-active" : "";
  let html = `<button type="button" class="promotion-modal-all ${allActiveClass}">전체 프로모션 보기</button>`;

  if (filtered.length === 0) {
    html += `<div style="padding:24px 18px;color:#8fa0b0;font-size:13px;">검색 결과가 없습니다.</div>`;
  } else {
    for (const [month, items] of monthGroups) {
      html += `<div class="promotion-modal-month">${escapeHtml(month)}</div>`;
      for (const p of items) {
        const activeClass = state.homePromotion === p.name ? "is-active" : "";
        html += `<button type="button" class="promotion-modal-item ${activeClass}" data-promotion="${escapeAttribute(p.name)}">
          <span class="promo-name" title="${escapeAttribute(p.name)}">${escapeHtml(truncate(p.name, 32))}</span>
          <span class="promo-date">${escapeHtml(p.lastDate.slice(0, 10))}</span>
        </button>`;
      }
    }
  }

  list.innerHTML = html;

  list.querySelector(".promotion-modal-all")?.addEventListener("click", () => {
    state.homePromotion = "all";
    closePromotionModal();
    setView("home");
    syncHomePromotionControls();
    renderAll();
  });

  list.querySelectorAll(".promotion-modal-item").forEach((button) => {
    button.addEventListener("click", () => {
      state.homePromotion = button.dataset.promotion;
      closePromotionModal();
      setView("home");
      syncHomePromotionControls();
      renderAll();
    });
  });
}

function setupPromotionModal() {
  document.querySelector("#openPromotionModal")?.addEventListener("click", openPromotionModal);
  document.querySelector("#closePromotionModal")?.addEventListener("click", closePromotionModal);
  document.querySelector("#promotionModalBackdrop")?.addEventListener("click", closePromotionModal);
  document.querySelector("#promotionModalSearch")?.addEventListener("input", (e) => {
    renderPromotionModalList(e.target.value);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closePromotionModal();
  });
}

/* ── KPI Rendering ───────────────────────────────────────────── */

function renderSparkline(dailySeries, metric) {
  const values = dailySeries.map((d) => d[metric] || 0);
  const max = Math.max(...values);
  if (!values.length || max <= 0) return "";
  const count = values.length;
  const w = 200;
  const h = 30;
  const gap = count > 60 ? 0.25 : count > 30 ? 0.8 : 1.5;
  const barW = Math.max(0.75, Math.min(6, (w - gap * (count - 1)) / count));
  const step = count > 1 ? (w - barW) / (count - 1) : 0;
  const bars = values
    .map((v, i) => {
      const bh = Math.max(1, (v / max) * h);
      const x = (i * step).toFixed(1);
      const y = (h - bh).toFixed(1);
      return `<rect x="${x}" y="${y}" width="${barW.toFixed(1)}" height="${bh.toFixed(1)}" rx="1.5"/>`;
    })
    .join("");
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="width:100%;height:30px;display:block;" fill="var(--mint)">${bars}</svg>`;
}

function kpiCompareLabel() {
  switch (state.activePreset) {
    case "today":
    case "yesterday": return "전일 대비";
    case "thisWeek":
    case "lastWeek":  return "전 주 대비";
    case "thisMonth":
    case "lastMonth": return "전 월 대비";
    case "D7":        return "직전 7일 대비";
    case "D30":       return "직전 30일 대비";
    default:          return "전기간 대비";
  }
}

function kpiDeltaHtml(curr, prev, isPositiveGood = true) {
  if (!prev && !curr) return `<span class="kpi-delta neutral">-</span>`;
  if (!prev) return `<span class="kpi-delta neutral">비교 데이터 없음</span>`;
  const rate = (curr - prev) / Math.abs(prev);
  const pct = (Math.abs(rate) * 100).toFixed(1);
  const isUp = rate > 0;
  const isNeutral = Math.abs(rate) < 0.001;
  const isGood = isPositiveGood ? isUp : !isUp;
  const cls = isNeutral ? "neutral" : isGood ? "positive" : "negative";
  const arrow = isUp ? "▲" : "▼";
  return `<span class="kpi-delta ${cls}">${arrow} ${pct}% ${kpiCompareLabel()}</span>`;
}

/* ═══════════════════════════════════════════════════
   홈 위젯 시스템
═══════════════════════════════════════════════════ */
const WIDGET_DEFS = {
  'media-pie':   { label: '매체별 성과',       span: 1, tag: 'Media Overview' },
  'daily-trend': { label: '일자별 트렌드',      span: 2, tag: 'Daily Trend' },
  'insights':    { label: '요약 인사이트',      span: 3, tag: 'Key Findings' },
  'camp-table':  { label: '캠페인/소재 테이블', span: 3, tag: 'Campaign' },
};
const DEFAULT_WIDGET_ORDER = ['media-pie', 'daily-trend', 'insights'];
const KPI_ALL_KEYS = ['impressions', 'clicks', 'cost', 'purchases', 'revenue', 'ctr', 'cpc', 'cvr', 'cpa', 'roas'];

function loadHomeWidgets() {
  try { const v = JSON.parse(localStorage.getItem('zinus-home-widgets')); return Array.isArray(v) ? v : [...DEFAULT_WIDGET_ORDER]; }
  catch { return [...DEFAULT_WIDGET_ORDER]; }
}
function saveHomeWidgets() { localStorage.setItem('zinus-home-widgets', JSON.stringify(state.homeWidgetOrder)); }

/* 사용자 기본값 저장 / 불러오기 (완료 버튼 클릭 시 저장, 초기화 시 복원) */
const USER_DEFAULT_KEY = 'zinus-home-user-default';
function saveUserDefault() {
  localStorage.setItem(USER_DEFAULT_KEY, JSON.stringify({
    widgets:     [...state.homeWidgetOrder],
    widgetSizes: { ...state.homeWidgetSizes },
    kpiOrder:    [...state.kpiOrder],
  }));
}
function loadUserDefault() {
  try {
    const v = JSON.parse(localStorage.getItem(USER_DEFAULT_KEY));
    if (v && Array.isArray(v.widgets)) return v;
  } catch {}
  return { widgets: [...DEFAULT_WIDGET_ORDER], widgetSizes: {}, kpiOrder: [...KPI_ALL_KEYS] };
}
function loadKpiOrder() {
  try { const v = JSON.parse(localStorage.getItem('zinus-kpi-order')); return Array.isArray(v) ? v : [...KPI_ALL_KEYS]; }
  catch { return [...KPI_ALL_KEYS]; }
}
function saveKpiOrder() { localStorage.setItem('zinus-kpi-order', JSON.stringify(state.kpiOrder)); }

/* 위젯 크기 저장/불러오기 */
function saveWidgetSizes() { localStorage.setItem('zinus-widget-sizes', JSON.stringify(state.homeWidgetSizes)); }
function loadWidgetSizes() {
  try { const v = JSON.parse(localStorage.getItem('zinus-widget-sizes')); return (v && typeof v === 'object') ? v : {}; }
  catch { return {}; }
}

/* 위젯 HTML 템플릿 */
function widgetHtml(id, jiggle) {
  const def = WIDGET_DEFS[id];
  if (!def) return '';
  const userSpan = state.homeWidgetSizes?.[id] ?? def.span;
  const spanClass = userSpan > 1 ? ` span-${userSpan}` : '';
  const jiggleClass = jiggle ? ' is-jiggling' : '';
  const deleteBtn = jiggle ? `<button type="button" class="widget-delete-btn" data-remove-widget="${escapeAttribute(id)}">×</button>` : '';
  const sizeBar = jiggle ? `
    <div class="widget-size-bar">
      ${[1,2,3].map((s) => `<button type="button" class="widget-size-dot${userSpan === s ? ' active' : ''}" data-resize-widget="${escapeAttribute(id)}" data-size="${s}"></button>`).join('')}
    </div>` : '';
  const drag = jiggle ? `draggable="true" data-widget-id="${id}"` : `data-widget-id="${id}"`;

  switch (id) {
    case 'media-pie': return `
      <article class="panel chart-panel home-widget${spanClass}${jiggleClass}" ${drag}>
        ${deleteBtn}${sizeBar}
        <header>
          <p>Media Overview</p>
          <div><h2>매체별 성과</h2><small class="basis">기준: 선택 지표 기준 비중</small></div>
          <div class="report-combo-selectors">
            <div class="report-combo-selector-item">
              <span class="combo-slot-dot" style="background:${COMBO_SLOT_COLORS[0]}"></span>
              <select id="homeMediaMetricSelect" class="report-metric-select">
                ${reportMetricOptionsHtml(state.homeMediaMetric, false)}
              </select>
            </div>
          </div>
        </header>
        <div id="homeMediaChart" class="chart pie-chart"></div>
      </article>`;
    case 'daily-trend': {
      const hdMetrics = state.homeDailyMetrics;
      const hdSelectors = [0, 1, 2].map((i) => {
        const cur   = hdMetrics[i] ?? null;
        const color = COMBO_SLOT_COLORS[i];
        return `<div class="report-combo-selector-item">
          <span class="combo-slot-dot" style="background:${color}"></span>
          <select class="home-daily-metric-select report-metric-select" data-home-daily-slot="${i}">
            ${reportMetricOptionsHtml(cur, true)}
          </select>
        </div>`;
      }).join('');
      return `
      <article class="panel chart-panel home-widget${spanClass}${jiggleClass}" ${drag}>
        ${deleteBtn}${sizeBar}
        <header>
          <div><p>Daily Trend</p><h2>일자별 트렌드</h2></div>
          <div class="report-combo-selectors">${hdSelectors}</div>
        </header>
        <div id="dailyChart" class="chart report-chart report-chart--combo"></div>
      </article>`;
    }
    case 'insights': return `
      <article class="panel list-panel home-widget${spanClass}${jiggleClass}" ${drag}>
        ${deleteBtn}${sizeBar}
        <header><p>Key Findings</p><h2>요약 인사이트</h2></header>
        <div class="insights" id="insights"></div>
      </article>`;
    case 'camp-table': return `
      <article class="panel table-panel home-widget${spanClass}${jiggleClass}" ${drag}>
        ${deleteBtn}${sizeBar}
        <header><p>Campaign</p><h2>캠페인/소재 성과</h2></header>
        <div id="homeWidgetCampTable" class="home-camp-table-wrap"></div>
      </article>`;
    default: return '';
  }
}

/* 위젯 추가 패널 HTML */
function widgetAddPanelHtml(activeWidgets) {
  const available = Object.entries(WIDGET_DEFS).filter(([id]) => !activeWidgets.includes(id));
  if (!available.length) return '';
  return available.map(([id, def]) => `
    <button type="button" class="widget-add-chip" data-add-widget="${escapeAttribute(id)}">
      <span class="widget-add-plus">+</span>${def.label}
    </button>`).join('');
}

/* 지글 바 (편집 모드 진입 시 상단에 나타나는 완료/초기화 바) */
function renderJiggleBar() {
  const bar = document.querySelector('#homeJiggleBar');
  if (!bar) return;
  const active = state.homeEditMode || state.kpiJiggle;
  if (!active) {
    bar.innerHTML = '';
    return;
  }
  bar.innerHTML = `
    <div class="home-jiggle-bar">
      <button type="button" class="jiggle-bar-btn jiggle-bar-reset" id="jiggleResetBtn">↺ 초기화</button>
      <span class="jiggle-bar-label">편집 모드 · 완료 시 기본값 저장</span>
      <button type="button" class="jiggle-bar-btn jiggle-bar-done" id="jiggleDoneBtn">완료</button>
    </div>`;

  /* 초기화: 마지막으로 저장된 사용자 기본값으로 복원 */
  document.querySelector('#jiggleResetBtn').addEventListener('click', () => {
    const def = loadUserDefault();
    state.homeWidgetOrder = def.widgets;
    state.homeWidgetSizes = def.widgetSizes;
    state.kpiOrder        = def.kpiOrder;
    state.homeEditMode    = false;
    state.kpiJiggle       = false;
    saveHomeWidgets();
    saveWidgetSizes();
    saveKpiOrder();
    renderAll();
  });

  /* 완료: 현재 상태를 기본값으로 저장 후 편집 종료 */
  document.querySelector('#jiggleDoneBtn').addEventListener('click', () => {
    saveUserDefault();
    state.homeEditMode = false;
    state.kpiJiggle    = false;
    renderAll();
  });
}

/* 홈 위젯 렌더링 (iOS 지글 모드) */
function renderHomeWidgets(rows) {
  renderJiggleBar();
  const grid = document.querySelector('#homeWidgets');
  if (!grid) return;
  const jiggle = state.homeEditMode;

  /* 추가 패널: 숨겨진 위젯이 있으면 항상 표시 (지글 모드 무관) */
  const addPanelInner = widgetAddPanelHtml(state.homeWidgetOrder);
  const addPanel = addPanelInner
    ? `<div class="widget-add-panel span-3">${addPanelInner}</div>`
    : '';

  grid.innerHTML =
    state.homeWidgetOrder.map((id) => widgetHtml(id, jiggle)).join('') + addPanel;

  /* 위젯 삭제 */
  grid.querySelectorAll('[data-remove-widget]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.removeWidget;
      state.homeWidgetOrder = state.homeWidgetOrder.filter((w) => w !== id);
      saveHomeWidgets();
      reRenderHome(rows);
    });
  });

  /* 위젯 크기 변경 */
  grid.querySelectorAll('[data-resize-widget]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.resizeWidget;
      const size = Number(btn.dataset.size);
      state.homeWidgetSizes[id] = size;
      saveWidgetSizes();
      reRenderHome(rows);
    });
  });

  /* 위젯 추가 */
  grid.querySelectorAll('[data-add-widget]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.addWidget;
      if (!state.homeWidgetOrder.includes(id)) {
        state.homeWidgetOrder.push(id);
        saveHomeWidgets();
        reRenderHome(rows);
      }
    });
  });

  /* 지글 모드: 드래그 정렬 바인딩 */
  if (jiggle) bindWidgetDrag(grid, rows);

  /* 지글 모드: 외부 클릭하면 종료 */
  if (jiggle) {
    const exitHandler = (e) => {
      if (!grid.contains(e.target)) {
        state.homeEditMode = false;
        reRenderHome(rows);
        document.removeEventListener('pointerdown', exitHandler);
      }
    };
    setTimeout(() => document.addEventListener('pointerdown', exitHandler), 100);
  }

  /* 지글 모드: Escape로 종료 */
  const escHandler = (e) => {
    if (e.key === 'Escape' && state.homeEditMode) {
      state.homeEditMode = false;
      reRenderHome(rows);
    }
  };
  document.addEventListener('keydown', escHandler, { once: true });

  rebindHomeControls();

  /* 꾹 누르기 감지 (지글 진입) */
  bindLongPress(grid, rows);
}

function reRenderHome(rows) {
  renderHomeWidgets(rows);
  rebindHomeControls();
  renderChartsForHome(rows);
}

/* 꾹 누르기 → 지글 모드 진입 */
function bindLongPress(grid, rows) {
  if (state.homeEditMode) return;
  let timer = null;
  /* 위젯이 있으면 각 위젯에, 없으면 그리드 자체에 바인딩 */
  const targets = grid.querySelectorAll('.home-widget');
  const bindTargets = targets.length > 0 ? targets : [grid];
  bindTargets.forEach((el) => {
    el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 && e.button !== undefined) return;
      timer = setTimeout(() => {
        state.homeEditMode = true;
        if (navigator.vibrate) navigator.vibrate(30);
        reRenderHome(rows);
      }, 600);
    });
    el.addEventListener('pointerup',    () => clearTimeout(timer));
    el.addEventListener('pointermove',  () => clearTimeout(timer));
    el.addEventListener('pointercancel',() => clearTimeout(timer));
  });
}

/* KPI도 꾹 누르기 → KPI 지글 진입 */
function bindKpiLongPress() {
  const grid = document.querySelector('#kpis');
  if (!grid || state.kpiJiggle) return;
  let timer = null;
  grid.querySelectorAll('.kpi').forEach((el) => {
    el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 && e.button !== undefined) return;
      timer = setTimeout(() => {
        state.kpiJiggle = true;
        if (navigator.vibrate) navigator.vibrate(30);
        renderKpis(filteredRecords());
        const exitHandler = (ev) => {
          if (!grid.contains(ev.target)) {
            state.kpiJiggle = false;
            renderKpis(filteredRecords());
            document.removeEventListener('pointerdown', exitHandler);
          }
        };
        setTimeout(() => document.addEventListener('pointerdown', exitHandler), 100);
      }, 600);
    });
    el.addEventListener('pointerup',    () => clearTimeout(timer));
    el.addEventListener('pointermove',  () => clearTimeout(timer));
    el.addEventListener('pointercancel',() => clearTimeout(timer));
  });
}

/* 드래그 정렬 */
function bindWidgetDrag(grid, rows) {
  let dragSrcId = null;
  grid.querySelectorAll('.home-widget[draggable="true"]').forEach((el) => {
    el.addEventListener('dragstart', (e) => {
      dragSrcId = el.dataset.widgetId;
      e.dataTransfer.effectAllowed = 'move';
      setTimeout(() => el.classList.add('widget-dragging'), 0);
    });
    el.addEventListener('dragend',   () => el.classList.remove('widget-dragging'));
    el.addEventListener('dragover',  (e) => { e.preventDefault(); el.classList.add('widget-drag-over'); });
    el.addEventListener('dragleave', () => el.classList.remove('widget-drag-over'));
    el.addEventListener('drop', (e) => {
      e.preventDefault();
      el.classList.remove('widget-drag-over');
      const targetId = el.dataset.widgetId;
      if (!dragSrcId || dragSrcId === targetId) return;
      const order = [...state.homeWidgetOrder];
      const si = order.indexOf(dragSrcId), ti = order.indexOf(targetId);
      if (si === -1 || ti === -1) return;
      order.splice(si, 1); order.splice(ti, 0, dragSrcId);
      state.homeWidgetOrder = order;
      saveHomeWidgets();
      reRenderHome(rows);
    });
  });
}

/* 홈 차트 렌더링 (위젯 재생성 후 호출) */
function renderChartsForHome(rows) {
  const dateRows = aggregateDateRows(rows);
  if (document.querySelector('#dailyChart')) {
    renderPeriodComboChart(document.querySelector('#dailyChart'), dateRows, state.homeDailyMetrics, 'daily');
    /* 홈 일자별 지표 셀렉터 이벤트 */
    document.querySelectorAll('.home-daily-metric-select').forEach((sel) => {
      sel.addEventListener('change', (e) => {
        const slot = Number(e.target.dataset.homeDailySlot);
        state.homeDailyMetrics[slot] = e.target.value || null;
        renderChartsForHome(filteredRecords());
      });
    });
  }
  if (document.querySelector('#homeMediaChart')) {
    renderPieChart(document.querySelector('#homeMediaChart'), aggregate(rows, 'media'), state.homeMediaMetric);
    const hmSel = document.querySelector('#homeMediaMetricSelect');
    if (hmSel) {
      hmSel.addEventListener('change', (e) => {
        state.homeMediaMetric = e.target.value || 'cost';
        renderChartsForHome(filteredRecords());
      });
    }
  }
  if (document.querySelector('#insights')) renderInsights(rows);
  if (document.querySelector('#homeWidgetCampTable')) renderHomeCampTable(rows);
}

function aggregateDateRows(rows) {
  return aggregate(rows, 'date').sort((a, b) => a.name.localeCompare(b.name)).map((r) => ({ ...r, date: r.name }));
}

/* 캠페인/소재 테이블 (홈 위젯용 간략 버전) */
function renderHomeCampTable(rows) {
  const wrap = document.querySelector('#homeWidgetCampTable');
  if (!wrap) return;
  const activeCampaigns = buildActiveSet('campaign');
  const campRows = aggregate(rows, 'campaign').slice(0, 10);
  wrap.innerHTML = `<table class="data-table">
    <thead><tr>
      <th>캠페인</th><th>광고비</th><th>매출</th><th>ROAS</th><th>전환</th><th>CTR</th><th>CPA</th>
    </tr></thead>
    <tbody>${campRows.map((r) => `<tr>
      <td title="${escapeHtml(r.name)}">${statusBadge(activeCampaigns.has(r.name))} ${escapeHtml(truncate(r.name, 28))}</td>
      <td>${formatMoney(r.cost)}</td><td>${formatMoney(r.revenue)}</td>
      <td>${formatRoas(r.roas)}</td><td>${formatNumber(r.purchases)}</td>
      <td>${formatPercent(r.ctr)}</td><td>${formatMoney(r.cpa)}</td>
    </tr>`).join('')}</tbody>
  </table>`;
}

/* 홈 컨트롤 이벤트 재바인딩 (위젯 DOM 재생성 후) */
function rebindHomeControls() {
  const metricSel = document.querySelector('#metricSelect');
  if (metricSel) {
    metricSel.innerHTML = metricOptionsHtml(false);
    metricSel.value = metricOrder.includes(state.metric) ? state.metric : 'impressions';
    metricSel.addEventListener('change', (e) => { state.metric = e.target.value; renderAll(); });
  }
  const secSel = document.querySelector('#secondaryMetricSelect');
  if (secSel) {
    secSel.innerHTML = metricOptionsHtml(true);
    secSel.value = state.secondaryMetric || '';
    secSel.addEventListener('change', (e) => { state.secondaryMetric = e.target.value || null; renderAll(); });
  }
  const homeMetricSel = document.querySelector('#homeMetricSelect');
  if (homeMetricSel) {
    homeMetricSel.innerHTML = metricOptionsHtml(false);
    homeMetricSel.value = metricOrder.includes(state.metric) ? state.metric : 'impressions';
    homeMetricSel.addEventListener('change', (e) => { state.metric = e.target.value; renderAll(); });
  }
  document.querySelectorAll('.metric-button').forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.metric === state.metric);
    btn.addEventListener('click', () => { state.metric = btn.dataset.metric; renderAll(); });
  });
  document.querySelectorAll('.efficiency-button').forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.secondaryMetric === state.secondaryMetric);
    btn.addEventListener('click', () => {
      const m = btn.dataset.secondaryMetric;
      state.secondaryMetric = state.secondaryMetric === m ? null : m;
      renderAll();
    });
  });
  const anomalyBtn = document.querySelector('#toggleAnomalyBtn');
  if (anomalyBtn) {
    anomalyBtn.checked = state.showAnomalyMarkers;
    anomalyBtn.addEventListener('change', (e) => { state.showAnomalyMarkers = e.target.checked; renderAll(); });
  }
}

/* KPI 드래그 정렬 */
function bindKpiDrag() {
  const grid = document.querySelector('#kpis');
  if (!grid) return;
  let dragSrc = null;
  grid.querySelectorAll('.kpi[draggable="true"]').forEach((el) => {
    el.addEventListener('dragstart', (e) => {
      dragSrc = el.dataset.kpiKey;
      e.dataTransfer.effectAllowed = 'move';
      el.classList.add('kpi-dragging');
    });
    el.addEventListener('dragend', () => el.classList.remove('kpi-dragging'));
    el.addEventListener('dragover', (e) => { e.preventDefault(); el.classList.add('kpi-drag-over'); });
    el.addEventListener('dragleave', () => el.classList.remove('kpi-drag-over'));
    el.addEventListener('drop', (e) => {
      e.preventDefault();
      el.classList.remove('kpi-drag-over');
      const target = el.dataset.kpiKey;
      if (!dragSrc || dragSrc === target) return;
      const order = [...state.kpiOrder];
      const si = order.indexOf(dragSrc), ti = order.indexOf(target);
      if (si === -1 || ti === -1) return;
      order.splice(si, 1); order.splice(ti, 0, dragSrc);
      state.kpiOrder = order;
      saveKpiOrder();
      renderKpis(filteredRecords());
    });
  });
}

const KPI_ITEM_MAP = (totals, prevTotals) => ({
  impressions: { key: 'impressions', label: '노출수',          value: formatCompactMoney(totals.impressions), delta: kpiDeltaHtml(totals.impressions, prevTotals?.impressions, true) },
  clicks:      { key: 'clicks',      label: '클릭수',          value: formatNumber(totals.clicks),            delta: kpiDeltaHtml(totals.clicks, prevTotals?.clicks, true) },
  cost:        { key: 'cost',        label: '비용 (VAT+/Fee+)',value: formatCompactMoney(totals.cost),        delta: kpiDeltaHtml(totals.cost, prevTotals?.cost, false) },
  purchases:   { key: 'purchases',   label: '전환',            value: formatNumber(totals.purchases),         delta: kpiDeltaHtml(totals.purchases, prevTotals?.purchases, true) },
  revenue:     { key: 'revenue',     label: '전환매출액',       value: formatCompactMoney(totals.revenue),    delta: kpiDeltaHtml(totals.revenue, prevTotals?.revenue, true) },
  ctr:         { key: 'ctr',         label: 'CTR',             value: formatPercent(totals.ctr),              delta: kpiDeltaHtml(totals.ctr, prevTotals?.ctr, true),   sub: '클릭수 / 노출수' },
  cpc:         { key: 'cpc',         label: 'CPC',             value: formatMoney(totals.cpc),                delta: kpiDeltaHtml(totals.cpc, prevTotals?.cpc, false),  sub: '비용(VAT+/Fee+) / 클릭수' },
  cvr:         { key: 'cvr',         label: 'CVR',             value: formatPercent(totals.cvr),              delta: kpiDeltaHtml(totals.cvr, prevTotals?.cvr, true),   sub: '전환수 / 클릭수' },
  cpa:         { key: 'cpa',         label: 'CPA',             value: formatMoney(totals.cpa),                delta: kpiDeltaHtml(totals.cpa, prevTotals?.cpa, false),  sub: '비용(VAT+/Fee+) / 전환수' },
  roas:        { key: 'roas',        label: 'ROAS',            value: formatRoas(totals.roas),                delta: kpiDeltaHtml(totals.roas, prevTotals?.roas, true),  sub: '매출 / 비용(VAT+/Fee+)' },
});

function renderKpis(rows) {
  renderJiggleBar();
  const totals = aggregateTotals(rows);
  const prevRows = previousPeriodRows();
  const prevTotals = prevRows.length ? aggregateTotals(prevRows) : null;
  const itemMap = KPI_ITEM_MAP(totals, prevTotals);
  const jiggle = state.kpiJiggle;

  const grid = document.querySelector('#kpis');

  if (jiggle) {
    /* 지글 모드: 활성 카드(순서대로, ×버튼) + 삭제된 빈 슬롯(+버튼) */
    const activeHtml = state.kpiOrder.map((key) => {
      const item = itemMap[key];
      if (!item) return '';
      return `<article class="kpi is-jiggling" draggable="true" data-kpi-key="${key}">
        <button type="button" class="kpi-delete-btn" data-remove-kpi="${escapeAttribute(key)}">×</button>
        <span class="kpi-label">${escapeHtml(item.label)}</span>
        <strong class="kpi-value">${item.value}</strong>
        ${item.delta}
        ${item.sub ? `<small class="kpi-sub">${escapeHtml(item.sub)}</small>` : ''}
      </article>`;
    }).join('');

    const emptyHtml = KPI_ALL_KEYS
      .filter((key) => !state.kpiOrder.includes(key))
      .map((key) => {
        const item = itemMap[key];
        if (!item) return '';
        return `<article class="kpi kpi-empty-slot" data-kpi-key="${key}">
          <span class="kpi-label">${escapeHtml(item.label)}</span>
          <button type="button" class="kpi-add-btn" data-add-kpi="${escapeAttribute(key)}">+</button>
        </article>`;
      }).join('');

    grid.innerHTML = activeHtml + emptyHtml;

    /* 삭제 버튼 */
    grid.querySelectorAll('[data-remove-kpi]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const key = btn.dataset.removeKpi;
        state.kpiOrder = state.kpiOrder.filter((k) => k !== key);
        saveKpiOrder();
        renderKpis(filteredRecords());
      });
    });

    /* 추가 버튼 */
    grid.querySelectorAll('[data-add-kpi]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const key = btn.dataset.addKpi;
        if (!state.kpiOrder.includes(key)) {
          /* 자연 순서(KPI_ALL_KEYS) 기준으로 삽입 위치 결정 */
          const naturalIdx = KPI_ALL_KEYS.indexOf(key);
          let insertAt = state.kpiOrder.length;
          for (let i = 0; i < state.kpiOrder.length; i++) {
            if (KPI_ALL_KEYS.indexOf(state.kpiOrder[i]) > naturalIdx) {
              insertAt = i;
              break;
            }
          }
          state.kpiOrder.splice(insertAt, 0, key);
          saveKpiOrder();
          renderKpis(filteredRecords());
        }
      });
    });

    /* 지글 모드에서도 드래그 정렬 */
    bindKpiDrag();
  } else {
    /* 일반 모드 */
    grid.innerHTML = state.kpiOrder.map((key) => {
      const item = itemMap[key];
      if (!item) return '';
      return `<article class="kpi" draggable="true" data-kpi-key="${key}" title="드래그하여 순서 변경">
        <span class="kpi-label">${escapeHtml(item.label)}</span>
        <strong class="kpi-value">${item.value}</strong>
        ${item.delta}
        ${item.sub ? `<small class="kpi-sub">${escapeHtml(item.sub)}</small>` : ''}
      </article>`;
    }).join('');

    bindKpiDrag();
  }

  bindKpiLongPress();
}

function renderInsights(rows) {
  const byPromotion = aggregate(rows, "promotion");
  const byMedia     = aggregate(rows, "media");
  const byTarget    = aggregate(rows, "target");

  const bestRoas    = byPromotion.filter((i) => i.cost > 0).sort((a, b) => b.roas - a.roas)[0];
  const bestRevenue = byPromotion.sort((a, b) => b.revenue - a.revenue)[0];
  const lowCpa      = byPromotion.filter((i) => i.purchases > 0 && i.cost > 0).sort((a, b) => a.cpa - b.cpa)[0];
  const bestCtr     = byMedia.filter((i) => i.impressions > 100000).sort((a, b) => b.ctr - a.ctr)[0];
  const bestClicks  = byMedia.sort((a, b) => b.clicks - a.clicks)[0];
  const bestTarget  = byTarget.filter((i) => i.cost > 0).sort((a, b) => b.revenue - a.revenue)[0];

  /* 핵심 숫자 강조 헬퍼 */
  const n  = (v) => `<strong class="in-num">${v}</strong>`;
  const nm = (v) => `<em class="in-name">${escapeHtml(truncate(String(v), 20))}</em>`;

  const lines = [
    bestRoas ? {
      color: "#2ec4b6",
      tag: "ROAS",
      text: `프로모션 중 ${nm(bestRoas.name)}의 ROAS가 ${n(formatRoas(bestRoas.roas))}로 가장 높습니다. 매출 ${n(formatCompactMoney(bestRoas.revenue) + "원")}.`,
    } : null,
    bestRevenue ? {
      color: "#3a86ff",
      tag: "매출",
      text: `매출 최다 프로모션은 ${nm(bestRevenue.name)}으로 ${n(formatCompactMoney(bestRevenue.revenue) + "원")}을 기록했습니다. 구매 ${n(formatNumber(bestRevenue.purchases) + "건")}.`,
    } : null,
    lowCpa ? {
      color: "#8338ec",
      tag: "CPA",
      text: `전환 효율이 가장 좋은 프로모션은 ${nm(lowCpa.name)}입니다. CPA ${n(formatMoney(lowCpa.cpa))}, 전환 ${n(formatNumber(lowCpa.purchases) + "건")}.`,
    } : null,
    bestCtr ? {
      color: "#00b894",
      tag: "CTR",
      text: `클릭률이 가장 높은 매체는 ${nm(bestCtr.name)}으로 CTR ${n(formatPercent(bestCtr.ctr))}를 기록했습니다. 클릭 ${n(formatNumber(bestCtr.clicks) + "회")}.`,
    } : null,
    bestClicks ? {
      color: "#e17055",
      tag: "클릭",
      text: `${nm(bestClicks.name)} 매체에서 클릭 ${n(formatNumber(bestClicks.clicks) + "회")}로 가장 많은 유입이 발생했습니다. CTR ${n(formatPercent(bestClicks.ctr))}.`,
    } : null,
    bestTarget ? {
      color: "#fd79a8",
      tag: "타겟",
      text: `${nm(bestTarget.name)} 타겟에서 매출 ${n(formatCompactMoney(bestTarget.revenue) + "원")}으로 타겟 중 성과가 가장 높습니다. ROAS ${n(formatRoas(bestTarget.roas))}.`,
    } : null,
  ].filter(Boolean);

  document.querySelector("#insights").innerHTML = `<ul class="insight-list">${
    lines.map(({ color, tag, text }) => `
      <li class="insight-item">
        <span class="insight-tag" style="background:${color}20;color:${color}">${escapeHtml(tag)}</span>
        <span class="insight-text">${text}</span>
      </li>`).join("")
  }</ul>`;
}

/* ── Chart Helpers ───────────────────────────────────────────── */

function chartScales(values, width, height, padding) {
  const max = Math.max(...values, 1);
  const xStep = values.length > 1 ? (width - padding.left - padding.right) / (values.length - 1) : 0;
  const y = (value) => height - padding.bottom - (value / max) * (height - padding.top - padding.bottom);
  const x = (index) => padding.left + index * xStep;
  return { max, x, y };
}

function dateTickLabel(row, idx, rows) {
  const [, month, day] = String(row.date || "").split("-");
  if (!month || !day) return "";
  if (rows.length <= 20) {
    const step = Math.ceil(rows.length / 6);
    return idx % step === 0 || idx === rows.length - 1 ? `${month}.${day}` : "";
  }
  const isMonthStart = day === "01";
  const isMidMonth = day === "15";
  if (!isMonthStart && !isMidMonth) return "";
  if (isMonthStart) return `${Number(month)}월`;
  return `${month}.${day}`;
}

function ratioAxisMax(values, metric) {
  const max = Math.max(...values, 0);
  if (!max) return 0.01;
  if (metric === "ctr" || metric === "cvr") {
    const padded = max * 1.2;
    if (padded <= 0.01) return Math.ceil(padded * 1000) / 1000;
    if (padded <= 0.05) return Math.ceil(padded * 200) / 200;
    return Math.ceil(padded * 100) / 100;
  }
  return max * 1.12;
}

function smoothPath(points) {
  if (!points.length) return "";
  if (points.length === 1) return `M ${points[0][0]} ${points[0][1]}`;
  let path = `M ${points[0][0]} ${points[0][1]}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
    const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
    const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
    const cp2y = p2[1] - (p3[1] - p1[1]) / 6;
    path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2[0]} ${p2[1]}`;
  }
  return path;
}

function renderLineChart(node, rows, metric) {
  const width = 820;
  const height = 270;
  const padding = { top: 24, right: 24, bottom: 46, left: 66 };
  if (!rows.length) {
    node.innerHTML = `<div class="empty-chart">선택한 조건에 해당하는 데이터가 없습니다.</div>`;
    return;
  }
  const values = rows.map((row) => row[metric] || 0);
  const { max, x, y } = chartScales(values, width, height, padding);
  const points = values.map((value, idx) => `${x(idx)},${y(value)}`).join(" ");
  const area = `${padding.left},${height - padding.bottom} ${points} ${x(values.length - 1)},${height - padding.bottom}`;
  const grid = [0, 0.25, 0.5, 0.75, 1].map((ratio) => {
    const yy = padding.top + ratio * (height - padding.top - padding.bottom);
    const labelValue = max * (1 - ratio);
    return `<line class="grid-line" x1="${padding.left}" y1="${yy}" x2="${width - padding.right}" y2="${yy}"></line>
      <text class="axis" x="8" y="${yy + 4}">${formatShort(labelValue, metric)}</text>`;
  }).join("");
  const labels = rows.map((row, idx) => {
    const label = dateTickLabel(row, idx, rows);
    if (!label) return "";
    return `
      <line class="tick-line" x1="${x(idx)}" y1="${height - padding.bottom}" x2="${x(idx)}" y2="${height - padding.bottom + 5}"></line>
      <text class="axis date-axis" x="${x(idx)}" y="${height - 16}" text-anchor="middle">${escapeHtml(label)}</text>
    `;
  }).join("");
  const dots = rows.map((row, idx) => `
    <circle class="dot" cx="${x(idx)}" cy="${y(row[metric] || 0)}" r="4" data-tooltip="${escapeAttribute(`${row.date}\n${metricMeta[metric].label}: ${formatDetailed(row[metric] || 0, metric)}`)}">
      <title>${escapeHtml(row.date)} ${metricMeta[metric].label}: ${formatDetailed(row[metric] || 0, metric)}</title>
    </circle>
  `).join("");

  node.innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="일자별 ${metricMeta[metric].label} 차트">
    ${grid}
    <polygon class="series-area" points="${area}"></polygon>
    <polyline class="series-line" points="${points}"></polyline>
    ${dots}
    ${labels}
  </svg>`;
}

function renderDailyComboChart(node, rows, metric, prevRows = null) {
  const width = 820;
  const height = 290;
  const hasPrev = Array.isArray(prevRows) && prevRows.length > 0;
  const secondary = state.secondaryMetric;
  const padding = { top: 26, right: secondary ? 72 : 24, bottom: 48, left: 66 };
  if (!rows.length) {
    node.innerHTML = `<div class="empty-chart">선택한 조건에 해당하는 데이터가 없습니다.</div>`;
    return;
  }

  const primaryValues = rows.map((row) => row[metric] || 0);
  const prevMax = hasPrev ? Math.max(...prevRows.map((r) => r[metric] || 0), 0) : 0;
  const primaryMax = Math.max(...primaryValues, prevMax, 1);
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  const slot = innerWidth / Math.max(rows.length, 1);
  const barWidth = Math.max(3, Math.min(18, slot * 0.62));
  const pointRadius = Math.max(1.6, Math.min(3.6, barWidth * 0.36));
  const anomalyRadius = Math.max(1.4, Math.min(3.5, barWidth * 0.34));
  const anomalyOffset = Math.max(5, Math.min(10, anomalyRadius * 2.8));
  const yPrimary = (value) => height - padding.bottom - (value / primaryMax) * innerHeight;
  const xCenter = (idx) => padding.left + slot * idx + slot / 2;
  const primaryMeta = metricMeta[metric];
  const secondaryMeta = secondary ? metricMeta[secondary] : null;
  const secondaryValues = secondary ? rows.map((row) => row[secondary] || 0) : [];
  const secondaryMax = secondary ? ratioAxisMax(secondaryValues, secondary) : 1;
  const ySecondary = (value) => height - padding.bottom - (value / secondaryMax) * innerHeight;
  const simplifiedLine = rows.length >= 31;

  const grid = [0, 0.25, 0.5, 0.75, 1].map((ratio) => {
    const yy = padding.top + ratio * innerHeight;
    const primaryLabel = formatShort(primaryMax * (1 - ratio), metric);
    const secondaryLabel = secondary ? `<text class="axis secondary-axis" x="${width - 6}" y="${yy + 4}" text-anchor="end">${formatShort(secondaryMax * (1 - ratio), secondary)}</text>` : "";
    return `<line class="grid-line" x1="${padding.left}" y1="${yy}" x2="${width - padding.right}" y2="${yy}"></line>
      <text class="axis" x="8" y="${yy + 4}">${primaryLabel}</text>${secondaryLabel}`;
  }).join("");

  const bars = rows.map((row, idx) => {
    const value = row[metric] || 0;
    const x = xCenter(idx) - barWidth / 2;
    const y = yPrimary(value);
    const secondaryText = secondary ? `\n${secondaryMeta.label}: ${formatDetailed(row[secondary] || 0, secondary)}` : "";
    const detail = `${row.date}\n${primaryMeta.label}: ${formatDetailed(value, metric)}${secondaryText}`;
    return `<rect class="daily-bar" x="${x}" y="${y}" width="${barWidth}" height="${Math.max(height - padding.bottom - y, 1)}" rx="2" data-tooltip="${escapeAttribute(detail)}">
      <title>${escapeHtml(detail)}</title>
    </rect>`;
  }).join("");

  const line = secondary ? (() => {
    const pointPairs = rows.map((row, idx) => [xCenter(idx), ySecondary(row[secondary] || 0)]);
    const points = pointPairs.map(([x, y]) => `${x},${y}`).join(" ");
    const lineShape = simplifiedLine
      ? `<path class="combo-line combo-line-smooth" d="${smoothPath(pointPairs)}"></path>`
      : `<polyline class="combo-line" points="${points}"></polyline>`;
    const dots = simplifiedLine ? "" : rows.map((row, idx) => {
      const detail = `${row.date}\n${secondaryMeta.label}: ${formatDetailed(row[secondary] || 0, secondary)}`;
      return `<circle class="combo-dot" cx="${xCenter(idx)}" cy="${ySecondary(row[secondary] || 0)}" r="${pointRadius.toFixed(1)}" data-tooltip="${escapeAttribute(detail)}">
        <title>${escapeHtml(detail)}</title>
      </circle>`;
    }).join("");
    return `${lineShape}${dots}`;
  })() : "";

  /* ── 전주 비교 점선 ─────────────────────────────────────────── */
  const compLine = hasPrev ? (() => {
    const pts = rows.map((_, idx) => {
      const v = idx < prevRows.length ? (prevRows[idx][metric] || 0) : 0;
      return `${xCenter(idx)},${yPrimary(v)}`;
    }).join(" ");
    return `<polyline class="prev-period-line" points="${pts}"/>`;
  })() : "";

  /* ── 이상치 마커 (전일 대비 ±35% 이상, 토글 가능) ──────────── */
  const anomalyMarkers = state.showAnomalyMarkers ? rows.map((row, idx) => {
    if (idx === 0) return "";
    const cur = row[metric] || 0;
    const prev = rows[idx - 1][metric] || 0;
    if (!prev || cur < primaryMax * 0.03) return "";
    const change = (cur - prev) / prev;
    if (Math.abs(change) < 0.35) return "";
    const isUp = change > 0;
    const cx = xCenter(idx);
    const cy = yPrimary(cur) - anomalyOffset;
    const pct = `${change > 0 ? "+" : ""}${Math.round(change * 100)}%`;
    return `<circle class="anomaly-dot anomaly-${isUp ? "up" : "down"}" cx="${cx}" cy="${cy}" r="${anomalyRadius.toFixed(1)}" data-tooltip="${escapeAttribute(`${row.date}: 전일 대비 ${pct}`)}">
      <title>${escapeHtml(`${row.date}: 전일 대비 ${pct}`)}</title>
    </circle>`;
  }).join("") : "";

  const labels = rows.map((row, idx) => {
    const label = dateTickLabel(row, idx, rows);
    if (!label) return "";
    return `<line class="tick-line" x1="${xCenter(idx)}" y1="${height - padding.bottom}" x2="${xCenter(idx)}" y2="${height - padding.bottom + 5}"></line>
      <text class="axis date-axis" x="${xCenter(idx)}" y="${height - 16}" text-anchor="middle">${escapeHtml(label)}</text>`;
  }).join("");

  /* ── 범례 ────────────────────────────────────────────────────── */
  const legendParts = [];
  if (secondary) {
    legendParts.push(
      `<rect x="0" y="2" width="10" height="10" class="legend-bar"></rect>`,
      `<text class="axis" x="14" y="11">${escapeHtml(primaryMeta.label)}</text>`,
      `<line x1="60" y1="7" x2="78" y2="7" class="combo-line"></line>`,
      `<text class="axis" x="82" y="11">${escapeHtml(secondaryMeta.label)}</text>`
    );
  }
  if (hasPrev) {
    const ox = secondary ? 150 : 0;
    legendParts.push(
      `<line x1="${ox}" y1="7" x2="${ox + 18}" y2="7" class="prev-period-line"></line>`,
      `<text class="axis" x="${ox + 22}" y="11">전주</text>`
    );
  }
  const legendWidth = (secondary ? 160 : 0) + (hasPrev ? 60 : 0);
  const legend = legendParts.length
    ? `<g class="chart-legend" transform="translate(${width - padding.right - legendWidth}, 8)">${legendParts.join("")}</g>`
    : "";

  node.innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="일자별 ${primaryMeta.label} 막대 차트">
    ${grid}
    ${bars}
    ${compLine}
    ${line}
    ${anomalyMarkers}
    ${labels}
    ${legend}
  </svg>`;
}

/* ── 매체 상세 테이블 ────────────────────────────────────────── */
function renderMediaDetailTable(mediaRows) {
  const wrap = document.querySelector("#mediaDetailTable");
  if (!wrap) return;
  const activeCampaigns = buildActiveSet("campaign");
  wrap.innerHTML = `
    <thead>
      <tr>
        <th>매체</th>
        <th>광고비</th>
        <th>노출</th>
        <th>클릭</th>
        <th>CTR</th>
        <th>CPC</th>
        <th>전환</th>
        <th>전환매출</th>
        <th>ROAS</th>
        <th>CPA</th>
      </tr>
    </thead>
    <tbody>${mediaRows.map((r) => `
      <tr>
        <td>
          <span class="media-color-dot" style="background:${mediaColor(r.name)}"></span>
          ${escapeHtml(truncate(r.name, 30))}
        </td>
        <td>${formatMoney(r.cost)}</td>
        <td>${formatNumber(r.impressions)}</td>
        <td>${formatNumber(r.clicks)}</td>
        <td>${formatPercent(r.ctr)}</td>
        <td>${formatMoney(r.cpc)}</td>
        <td>${formatNumber(r.purchases)}</td>
        <td>${formatMoney(r.revenue)}</td>
        <td>${formatRoas(r.roas)}</td>
        <td>${formatMoney(r.cpa)}</td>
      </tr>`).join("")}
    </tbody>`;
}

function renderPieChart(container, rows, metric) {
  if (!container) return;
  const filtered = rows.filter((r) => (r[metric] || 0) > 0);
  const total = filtered.reduce((s, r) => s + (r[metric] || 0), 0);
  if (!total) {
    container.innerHTML = '<p style="color:var(--muted);text-align:center;padding:40px 0">데이터 없음</p>';
    return;
  }
  const cx = 90, cy = 90, outerR = 78, innerR = 42, size = 180;
  let angle = -Math.PI / 2;
  const slices = filtered.map((row) => {
    const value = row[metric] || 0;
    const sweep = (value / total) * 2 * Math.PI;
    const s = { row, value, startAngle: angle, endAngle: angle + sweep, color: mediaColor(row.name) };
    angle += sweep;
    return s;
  });
  function donutPath(sa, ea) {
    if (ea - sa >= 2 * Math.PI - 0.001) ea = sa + 2 * Math.PI - 0.001;
    const x1 = cx + outerR * Math.cos(sa), y1 = cy + outerR * Math.sin(sa);
    const x2 = cx + outerR * Math.cos(ea), y2 = cy + outerR * Math.sin(ea);
    const x3 = cx + innerR * Math.cos(ea), y3 = cy + innerR * Math.sin(ea);
    const x4 = cx + innerR * Math.cos(sa), y4 = cy + innerR * Math.sin(sa);
    const lg = ea - sa > Math.PI ? 1 : 0;
    return `M${x1},${y1} A${outerR},${outerR} 0 ${lg} 1 ${x2},${y2} L${x3},${y3} A${innerR},${innerR} 0 ${lg} 0 ${x4},${y4} Z`;
  }
  const paths = slices.map((s) => {
    const isActive = state.filters.media === String(s.row.name);
    return `<path d="${donutPath(s.startAngle, s.endAngle)}" fill="${s.color}"
      data-media="${escapeAttribute(String(s.row.name))}"
      style="cursor:pointer;opacity:${isActive ? "1" : "0.85"};${isActive ? "filter:brightness(1.15)" : ""}"/>`;
  }).join("");
  const centerVal = escapeHtml(formatShort(total, metric));
  const centerLbl = escapeHtml(metricMeta[metric]?.label ?? "");
  const legend = slices.map((s) => {
    const pct = ((s.value / total) * 100).toFixed(1);
    const name = escapeHtml(truncate(String(s.row.name || "-"), 22));
    const val = escapeHtml(formatShort(s.value, metric));
    return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
      <span style="flex-shrink:0;width:10px;height:10px;border-radius:2px;background:${s.color};display:inline-block;"></span>
      <span style="flex:1;font-size:12px;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${name}</span>
      <span style="flex-shrink:0;font-size:11px;color:var(--muted);min-width:40px;text-align:right;">${val}</span>
      <span style="flex-shrink:0;font-size:12px;font-weight:700;color:var(--text);min-width:38px;text-align:right;">${pct}%</span>
    </div>`;
  }).join("");
  container.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;gap:16px;padding:8px 0;">
    <svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
      ${paths}
      <text x="${cx}" y="${cy - 8}" text-anchor="middle" style="font-size:10px;fill:var(--muted)">${centerLbl}</text>
      <text x="${cx}" y="${cy + 11}" text-anchor="middle" style="font-size:16px;font-weight:700;fill:var(--text)">${centerVal}</text>
    </svg>
    <div style="width:100%;">${legend}</div>
  </div>`;
  container.querySelectorAll("path[data-media]").forEach((path) => {
    path.addEventListener("click", () => {
      const media = path.getAttribute("data-media");
      if (!media) return;
      state.filters.media = state.filters.media === media ? "all" : media;
      renderAll();
    });
  });
}

/* ── 전환 퍼널 차트 ─────────────────────────────────────────── */
function renderFunnelChart(container, rows) {
  if (!container) return;
  const total = aggregateRows(rows);
  if (!total || !total.impressions) {
    container.innerHTML = `<div class="empty-chart">데이터 없음</div>`;
    return;
  }
  const maxVal = total.impressions || 1;
  const funnelSteps = [
    {
      label: "노출", value: total.impressions,
      fmt: formatNumber, color: "#2ec4b6", rate: null,
    },
    {
      label: "클릭", value: total.clicks,
      fmt: formatNumber, color: "#3a86ff",
      rate: `CTR ${formatPercent(total.ctr)}`,
    },
    {
      label: "전환", value: total.purchases,
      fmt: formatNumber, color: "#8338ec",
      rate: `CVR ${formatPercent(total.cvr)}`,
    },
  ];
  container.innerHTML = `<div class="funnel-steps">
    ${funnelSteps.map((step) => {
      const pct = Math.max((step.value / maxVal) * 100, 0.5);
      const rateHtml = step.rate ? `<span class="funnel-rate">${escapeHtml(step.rate)}</span>` : "";
      return `<div class="funnel-step">
        <div class="funnel-label-row">
          <span class="funnel-step-label">${escapeHtml(step.label)}</span>
          ${rateHtml}
          <span class="funnel-step-value">${escapeHtml(step.fmt(step.value))}</span>
        </div>
        <div class="funnel-bar-track">
          <div class="funnel-bar-fill" style="width:${pct.toFixed(1)}%;background:${step.color}"></div>
        </div>
      </div>`;
    }).join("")}
    <div class="funnel-kpi-row">
      <div class="funnel-kpi">
        <span class="funnel-kpi-label">매출</span>
        <span class="funnel-kpi-value">${escapeHtml(formatCompactMoney(total.revenue))}원</span>
      </div>
      <div class="funnel-kpi">
        <span class="funnel-kpi-label">ROAS</span>
        <span class="funnel-kpi-value">${escapeHtml(formatRoas(total.roas))}</span>
      </div>
      <div class="funnel-kpi">
        <span class="funnel-kpi-label">CPA</span>
        <span class="funnel-kpi-value">${escapeHtml(formatCompactMoney(total.cpa))}원</span>
      </div>
    </div>
  </div>`;
}

/* ── 누적 막대 차트 (매체별 Weekly) ──────────────────────────── */
function renderStackedChart(node, rows, metric) {
  if (!node) return;
  const width = 820;
  const height = 220;
  const padding = { top: 20, right: 20, bottom: 44, left: 62 };
  if (!rows.length) {
    node.innerHTML = `<div class="empty-chart">데이터 없음</div>`;
    return;
  }

  /* 주차별 집계 */
  const byWeek = new Map();
  for (const row of rows) {
    const wk = weekKey(row.date);
    if (!wk) continue;
    if (!byWeek.has(wk)) byWeek.set(wk, new Map());
    const wMap = byWeek.get(wk);
    const med = String(row.media || "기타");
    if (!wMap.has(med)) wMap.set(med, 0);
    wMap.set(med, wMap.get(med) + (row[metric] || 0));
  }

  const weeks = [...byWeek.keys()].sort().slice(-12); /* 최근 12주 */
  const medias = [...new Set(rows.map((r) => String(r.media || "기타")))];
  const weekTotals = weeks.map((wk) => {
    const wMap = byWeek.get(wk) || new Map();
    return medias.reduce((s, m) => s + (wMap.get(m) || 0), 0);
  });
  const maxVal = Math.max(...weekTotals, 1);

  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;
  const slot = innerW / Math.max(weeks.length, 1);
  const barW = Math.min(slot * 0.7, 48);
  const xCenter = (i) => padding.left + slot * i + slot / 2;
  const yScale = (v) => height - padding.bottom - (v / maxVal) * innerH;

  const grid = [0, 0.5, 1].map((r) => {
    const yy = padding.top + r * innerH;
    return `<line class="grid-line" x1="${padding.left}" y1="${yy}" x2="${width - padding.right}" y2="${yy}"></line>
      <text class="axis" x="8" y="${yy + 4}">${formatShort(maxVal * (1 - r), metric)}</text>`;
  }).join("");

  const bars = weeks.map((wk, wi) => {
    const wMap = byWeek.get(wk) || new Map();
    let y = height - padding.bottom;
    const segs = medias.map((med) => {
      const v = wMap.get(med) || 0;
      const h = (v / maxVal) * innerH;
      const seg = h > 0.5
        ? `<rect x="${xCenter(wi) - barW / 2}" y="${y - h}" width="${barW}" height="${h}" fill="${mediaColor(med)}" rx="2" data-tooltip="${escapeAttribute(`${wk}\n${med}: ${formatShort(v, metric)}`)}" opacity="0.9">
            <title>${escapeHtml(`${wk} ${med}: ${formatShort(v, metric)}`)}</title>
           </rect>`
        : "";
      y -= h;
      return seg;
    });
    const startDate = wk.split(" ~ ")[0] || wk;
    const [, mm, dd] = startDate.split("-");
    const wLabel = mm && dd ? `${parseInt(mm)}/${parseInt(dd)}` : startDate.slice(5);
    return `${segs.join("")}<text class="axis date-axis" x="${xCenter(wi)}" y="${height - 12}" text-anchor="middle">${escapeHtml(wLabel)}</text>`;
  }).join("");

  /* 범례 */
  const legend = medias.map((med, i) => {
    const lx = padding.left + (i % 4) * 200;
    const ly = height - 4 + Math.floor(i / 4) * 14;
    return `<rect x="${lx}" y="${ly}" width="8" height="8" fill="${mediaColor(med)}" rx="2"/>
      <text class="axis" x="${lx + 12}" y="${ly + 7}">${escapeHtml(truncate(med, 22))}</text>`;
  }).join("");

  node.innerHTML = `<svg viewBox="0 0 ${width} ${height + Math.ceil(medias.length / 4) * 14}" role="img" aria-label="매체별 누적 막대 차트">
    ${grid}${bars}${legend}
  </svg>`;
}

/* ── 트리맵 레이아웃 (재귀 이진 분할) ──────────────────────── */
function layoutTreemap(items, x, y, w, h) {
  if (!items.length) return [];
  if (items.length === 1) return [{ ...items[0], x, y, w, h }];
  const total = items.reduce((s, it) => s + it.value, 0);
  if (!total) return [];
  let bestIdx = 1, bestScore = Infinity, cum = 0;
  for (let i = 1; i < items.length; i++) {
    cum += items[i - 1].value;
    const r = cum / total;
    let score;
    if (w >= h) {
      const w1 = w * r || 1, w2 = w * (1 - r) || 1;
      score = Math.max(w1 / h, h / w1) + Math.max(w2 / h, h / w2);
    } else {
      const h1 = h * r || 1, h2 = h * (1 - r) || 1;
      score = Math.max(w / h1, h1 / w) + Math.max(w / h2, h2 / w);
    }
    if (score < bestScore) { bestScore = score; bestIdx = i; }
  }
  const left = items.slice(0, bestIdx), right = items.slice(bestIdx);
  const leftRatio = left.reduce((s, it) => s + it.value, 0) / total;
  if (w >= h) {
    const w1 = w * leftRatio;
    return [...layoutTreemap(left, x, y, w1, h), ...layoutTreemap(right, x + w1, y, w - w1, h)];
  } else {
    const h1 = h * leftRatio;
    return [...layoutTreemap(left, x, y, w, h1), ...layoutTreemap(right, x, y + h1, w, h - h1)];
  }
}

/* ── 매체 트리맵 ─────────────────────────────────────────────── */
function renderTreemap(container, rows, metric) {
  if (!container) return;
  const items = rows
    .map((r) => ({ name: String(r.name || "-"), value: r[metric] || 0 }))
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value);
  if (!items.length) {
    container.innerHTML = '<div class="empty-chart">데이터 없음</div>';
    return;
  }
  const total = items.reduce((s, it) => s + it.value, 0);
  const VW = 320, VH = 210;
  const rects = layoutTreemap(items, 0, 0, VW, VH);
  const svgRects = rects.map((r) => {
    const pct = ((r.value / total) * 100).toFixed(1);
    const color = mediaColor(r.name);
    const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
    const fs = Math.min(12, Math.max(9, Math.floor(r.w / 9)));
    const showLabel = r.w >= 48 && r.h >= 28;
    const shortName = truncate(r.name, Math.max(3, Math.floor(r.w / fs * 0.9)));
    const isActive = state.filters.media === r.name;
    return `<rect class="treemap-rect" x="${r.x.toFixed(1)}" y="${r.y.toFixed(1)}"
      width="${Math.max(r.w - 2, 1).toFixed(1)}" height="${Math.max(r.h - 2, 1).toFixed(1)}"
      rx="4" fill="${color}" opacity="${isActive ? "1" : "0.82"}"
      stroke="${isActive ? "#fff" : "none"}" stroke-width="2"
      data-media="${escapeAttribute(r.name)}">
      <title>${r.name}: ${formatShort(r.value, metric)} (${pct}%)</title>
    </rect>
    ${showLabel ? `<text class="treemap-label" x="${cx.toFixed(1)}" y="${(cy - 5).toFixed(1)}"
      text-anchor="middle" fill="#fff" font-size="${fs}px" pointer-events="none">${escapeHtml(shortName)}</text>
      <text class="treemap-pct" x="${cx.toFixed(1)}" y="${(cy + 9).toFixed(1)}"
      text-anchor="middle" fill="#fff" font-size="10px" opacity="0.88" pointer-events="none">${pct}%</text>` : ""}`;
  }).join("");
  container.innerHTML = `<svg class="treemap-svg" viewBox="0 0 ${VW} ${VH}"
    role="img" aria-label="매체 트리맵">
    ${svgRects}
  </svg>`;
  container.querySelectorAll(".treemap-rect").forEach((rect) => {
    rect.addEventListener("click", () => {
      const media = rect.getAttribute("data-media");
      if (!media) return;
      state.filters.media = state.filters.media === media ? "all" : media;
      renderAll();
    });
  });
}

/* ── 요일별 성과 히트맵 ─────────────────────────────────────── */
function renderHeatmap(container, rows, metric) {
  if (!container) return;
  if (!rows.length) {
    container.innerHTML = '<div class="empty-chart">데이터 없음</div>';
    return;
  }
  const byDate = new Map();
  for (const row of rows) {
    const d = row.date;
    if (!d) continue;
    byDate.set(d, (byDate.get(d) || 0) + (row[metric] || 0));
  }
  if (!byDate.size) {
    container.innerHTML = '<div class="empty-chart">데이터 없음</div>';
    return;
  }
  const dates = [...byDate.keys()].sort();
  const lastDate = new Date(`${dates[dates.length - 1]}T00:00:00`);
  const dowJS = lastDate.getDay();
  const dayOffset = dowJS === 0 ? 6 : dowJS - 1;
  const lastMonday = new Date(lastDate);
  lastMonday.setDate(lastDate.getDate() - dayOffset);
  const NUM_WEEKS = 10;
  const firstMonday = new Date(lastMonday);
  firstMonday.setDate(lastMonday.getDate() - (NUM_WEEKS - 1) * 7);
  const DAYS_KO = ["월", "화", "수", "목", "금", "토", "일"];
  const weeks = [];
  for (let w = 0; w < NUM_WEEKS; w++) {
    const wStart = new Date(firstMonday);
    wStart.setDate(firstMonday.getDate() + w * 7);
    const days = [];
    for (let d = 0; d < 7; d++) {
      const dt = new Date(wStart);
      dt.setDate(wStart.getDate() + d);
      const dateStr = formatLocalDate(dt);
      days.push({ date: dateStr, value: byDate.has(dateStr) ? byDate.get(dateStr) : null });
    }
    weeks.push({ start: wStart, days });
  }
  const allValues = [...byDate.values()].filter((v) => v > 0);
  const maxVal = Math.max(...allValues, 1);
  const cellW = 52, cellH = 24, cellGap = 4;
  const labelW = 26, topH = 26;
  const svgW = labelW + NUM_WEEKS * (cellW + cellGap);
  const svgH = topH + 7 * (cellH + cellGap);
  const weekLabels = weeks.map((wk, wi) => {
    const mm = wk.start.getMonth() + 1;
    const dd = wk.start.getDate();
    const x = labelW + wi * (cellW + cellGap) + cellW / 2;
    return `<text class="axis" x="${x}" y="18" text-anchor="middle" font-size="9">${mm}/${dd}</text>`;
  }).join("");
  const dayLabels = DAYS_KO.map((day, di) => {
    const y = topH + di * (cellH + cellGap) + cellH / 2 + 4;
    return `<text class="axis" x="${labelW - 5}" y="${y}" text-anchor="end" font-size="10">${day}</text>`;
  }).join("");
  const R = 46, G = 196, B = 182;
  const cells = weeks.map((wk, wi) => wk.days.map((day, di) => {
    const x = labelW + wi * (cellW + cellGap);
    const y = topH + di * (cellH + cellGap);
    if (day.value === null) {
      return `<rect class="heat-cell-empty" x="${x}" y="${y}" width="${cellW}" height="${cellH}" rx="3"/>`;
    }
    const t = day.value / maxVal;
    const alpha = (0.12 + t * 0.85).toFixed(3);
    const valStr = escapeHtml(formatShort(day.value, metric));
    return `<rect class="heat-cell" x="${x}" y="${y}" width="${cellW}" height="${cellH}" rx="3"
      fill="rgba(${R},${G},${B},${alpha})"><title>${day.date}: ${valStr}</title></rect>
      <text x="${x + cellW / 2}" y="${y + cellH / 2 + 4}" text-anchor="middle"
      font-size="9" fill="${t > 0.5 ? "#fff" : "var(--text)"}" pointer-events="none">${valStr}</text>`;
  }).join("")).join("");
  container.innerHTML = `<svg class="heatmap-svg" viewBox="0 0 ${svgW} ${svgH}"
    role="img" aria-label="요일별 성과 히트맵">
    ${weekLabels}${dayLabels}${cells}
  </svg>`;
}

function renderBarChart(node, rows, metric, options = {}) {
  const width = options.width ?? 520;
  const height = options.height ?? 290;
  const padding = { top: 18, right: 42, bottom: 42, left: options.horizontal ? (options.leftPadding ?? 190) : 56 };
  const values = rows.map((row) => row[metric] || 0);
  const max = Math.max(...values, 1);
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  let body = "";

  if (options.horizontal) {
    const rowHeight = innerHeight / Math.max(rows.length, 1);
    body = rows.map((row, idx) => {
      const barWidth = ((row[metric] || 0) / max) * innerWidth;
      const y = padding.top + idx * rowHeight;
      const detail = `${row.name} ${metricMeta[metric].label}: ${formatDetailed(row[metric] || 0, metric)}`;
      return `${svgMultilineLabel(row.name, padding.left - 10, y + rowHeight * 0.58, {
          firstLineLimit: options.firstLineLimit ?? 15,
          secondLineLimit: options.secondLineLimit ?? 18,
        })}
        <rect class="bar ${idx % 2 ? "alt" : ""}" x="${padding.left}" y="${y + 5}" width="${barWidth}" height="${Math.max(rowHeight - 9, 4)}" rx="2" data-tooltip="${escapeAttribute(detail)}">
          <title>${escapeHtml(detail)}</title>
        </rect>
        <text class="chart-label" x="${padding.left + 7 + barWidth}" y="${y + rowHeight * 0.6}" data-tooltip="${escapeAttribute(detail)}">
          <title>${escapeHtml(detail)}</title>${formatShort(row[metric] || 0, metric)}
        </text>`;
    }).join("");
  } else {
    const gap = 5;
    const barWidth = innerWidth / Math.max(rows.length, 1) - gap;
    body = rows.map((row, idx) => {
      const barHeight = ((row[metric] || 0) / max) * innerHeight;
      const x = padding.left + idx * (barWidth + gap);
      const y = height - padding.bottom - barHeight;
      return `<rect class="bar ${idx % 2 ? "alt" : ""}" x="${x}" y="${y}" width="${Math.max(barWidth, 2)}" height="${barHeight}" rx="2" data-tooltip="${escapeAttribute(`${row.hour ?? row.name}\n${metricMeta[metric].label}: ${formatDetailed(row[metric] || 0, metric)}`)}">
          <title>${escapeHtml(row.hour ?? row.name)} ${metricMeta[metric].label}: ${formatDetailed(row[metric] || 0, metric)}</title>
        </rect>
        ${idx % 3 === 0 ? `<text class="axis" x="${x + barWidth / 2}" y="${height - 14}" text-anchor="middle">${escapeHtml(row.hour ?? truncate(row.name, 8))}</text>` : ""}`;
    }).join("");
  }

  const grid = [0, 0.5, 1].map((ratio) => {
    const y = padding.top + ratio * innerHeight;
    return `<line class="grid-line" x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}"></line>`;
  }).join("");

  node.innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${metricMeta[metric].label} 막대 차트">
    ${grid}
    ${body}
  </svg>`;
}

/* ── 일간/주간/월간 보고서 ───────────────────────────────────── */
const reportMeta = {
  daily: {
    titlePrefix: "일자별",
    tableLabel: "일자",
    chartLabel: "일별",
    keyInfo: (date) => ({
      key: date,
      sort: date,
      name: date,
      short: String(date || "").slice(5).replace("-", "/"),
    }),
  },
  weekly: {
    titlePrefix: "주차별",
    tableLabel: "주차",
    chartLabel: "주별",
    keyInfo: weeklyReportInfo,
  },
  monthly: {
    titlePrefix: "월별",
    tableLabel: "월",
    chartLabel: "월별",
    keyInfo: (date) => {
      const key = monthKey(date);
      const [year, month] = key.split("-");
      return {
        key,
        sort: key,
        name: `${year}년 ${Number(month)}월`,
        short: `${Number(month)}월`,
      };
    },
  },
};

function weeklyReportInfo(date) {
  const d = parseLocalDate(date);
  if (Number.isNaN(d.getTime())) return { key: date, sort: date, name: date, short: date };
  const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
  const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  const day = d.getDay() || 7;
  const naturalStart = new Date(d);
  naturalStart.setDate(d.getDate() - day + 1);
  const naturalEnd = new Date(naturalStart);
  naturalEnd.setDate(naturalStart.getDate() + 6);
  const start = naturalStart < monthStart ? monthStart : naturalStart;
  const end = naturalEnd > monthEnd ? monthEnd : naturalEnd;
  let index = 1;
  let cursor = new Date(monthStart);
  while (formatLocalDate(cursor) < formatLocalDate(start)) {
    const cursorDay = cursor.getDay() || 7;
    cursor.setDate(cursor.getDate() + (8 - cursorDay));
    index += 1;
  }
  const startText = `${String(start.getMonth() + 1).padStart(2, "0")}/${String(start.getDate()).padStart(2, "0")}`;
  const endText = `${String(end.getMonth() + 1).padStart(2, "0")}/${String(end.getDate()).padStart(2, "0")}`;
  const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  return {
    key: `${ym}-W${index}`,
    sort: `${ym}-${String(index).padStart(2, "0")}`,
    name: `${d.getMonth() + 1}월 ${index}주차 (${startText} ~ ${endText})`,
    short: `${d.getMonth() + 1}월 ${index}주차`,
  };
}

const PERIOD_DEFAULT_COUNT = { daily: 14, weekly: 7, monthly: 6 };

function aggregatePeriodRows(rows, view) {
  const meta = reportMeta[view] ?? reportMeta.daily;
  const map = new Map();
  for (const row of rows) {
    const info = meta.keyInfo(row.date);
    if (!info.key) continue;
    if (!map.has(info.key)) {
      map.set(info.key, { name: info.name, short: info.short, sort: info.sort, ...emptyMetrics() });
    }
    addMetrics(map.get(info.key), row);
  }
  const sorted = [...map.values()]
    .map((row) => enrich(row))
    .sort((a, b) => String(a.sort).localeCompare(String(b.sort)));
  const limit = PERIOD_DEFAULT_COUNT[view];
  return limit ? sorted.slice(-limit) : sorted;
}

function reportMetricOptionsHtml(selected, includeNone = false) {
  const noneOpt = includeNone ? `<option value=""${!selected ? " selected" : ""}>없음</option>` : "";
  return noneOpt + metricOrder
    .map((metric) => `<option value="${metric}" ${metric === selected ? "selected" : ""}>${escapeHtml(metricSelectLabel(metric))}</option>`)
    .join("");
}

function renderPeriodMetricChart(node, rows, metric, view) {
  if (!node) return;
  if (!rows.length) {
    node.innerHTML = `<div class="empty-chart">선택한 조건에 해당하는 데이터가 없습니다.</div>`;
    return;
  }
  const width = 560;
  const height = 260;
  const padding = { top: 18, right: 22, bottom: 48, left: 64 };
  const values = rows.map((row) => row[metric] || 0);
  const max = ratioAxisMax(values, metric);
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;
  const slot = innerW / Math.max(rows.length, 1);
  const barW = Math.max(4, Math.min(28, slot * 0.54));
  const isLineMetric = ["ctr", "cpc", "cvr", "cpa", "roas"].includes(metric);
  const xCenter = (idx) => padding.left + slot * idx + slot / 2;
  const y = (value) => height - padding.bottom - (value / max) * innerH;
  const step = rows.length <= 8 ? 1 : Math.ceil(rows.length / 6);
  const meta = metricMeta[metric];
  const grid = [0, 0.25, 0.5, 0.75, 1].map((ratio) => {
    const yy = padding.top + ratio * innerH;
    const label = formatShort(max * (1 - ratio), metric);
    return `<line class="grid-line" x1="${padding.left}" y1="${yy}" x2="${width - padding.right}" y2="${yy}"></line>
      <text class="axis" x="8" y="${yy + 4}">${escapeHtml(label)}</text>`;
  }).join("");
  const labels = rows.map((row, idx) => {
    if (idx % step !== 0 && idx !== rows.length - 1) return "";
    return `<text class="axis date-axis" x="${xCenter(idx)}" y="${height - 16}" text-anchor="middle">${escapeHtml(row.short || row.name)}</text>`;
  }).join("");
  const body = isLineMetric
    ? (() => {
      const points = rows.map((row, idx) => [xCenter(idx), y(row[metric] || 0)]);
      const path = rows.length > 12 ? smoothPath(points) : `M ${points.map((p) => p.join(" ")).join(" L ")}`;
      const dots = rows.length > 31 ? "" : rows.map((row, idx) => {
        const detail = `${row.name}\n${meta.label}: ${formatDetailed(row[metric] || 0, metric)}`;
        return `<circle class="report-dot" cx="${xCenter(idx)}" cy="${y(row[metric] || 0)}" r="3" data-tooltip="${escapeAttribute(detail)}"><title>${escapeHtml(detail)}</title></circle>`;
      }).join("");
      return `<path class="report-line" d="${path}"></path>${dots}`;
    })()
    : rows.map((row, idx) => {
      const value = row[metric] || 0;
      const barH = Math.max(1, (value / max) * innerH);
      const x = xCenter(idx) - barW / 2;
      const yy = height - padding.bottom - barH;
      const detail = `${row.name}\n${meta.label}: ${formatDetailed(value, metric)}`;
      return `<rect class="report-bar" x="${x}" y="${yy}" width="${barW}" height="${barH}" rx="5" data-tooltip="${escapeAttribute(detail)}"><title>${escapeHtml(detail)}</title></rect>`;
    }).join("");

  node.innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${reportMeta[view].chartLabel} ${meta.label} 차트">
    ${grid}
    ${body}
    ${labels}
  </svg>`;
}

/* 슬롯별 고정 색상 (0: 민트 막대, 1: 로즈 선, 2: 블루 선) */
const COMBO_SLOT_COLORS = ["#3ecbc4", "#e09ea0", "#4691c7"];

/* ── 3지표 콤보 차트 (막대 + 라인, 듀얼 Y축) ── */
function renderPeriodComboChart(node, rows, metrics, view) {
  if (!node) return;
  /* null/빈 지표 제거 */
  const activeMetrics = metrics.filter((m) => m && m !== "");
  if (!rows.length || !activeMetrics.length) {
    node.innerHTML = `<div class="empty-chart">선택한 조건에 해당하는 데이터가 없습니다.</div>`;
    return;
  }
  const width = 1100;
  const height = 320;
  const pad = { top: 24, right: 80, bottom: 52, left: 72 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const slot = innerW / Math.max(rows.length, 1);
  const barW = Math.max(6, Math.min(36, slot * 0.5));
  const xC = (i) => pad.left + slot * i + slot / 2;

  /* 슬롯 인덱스 유지 (색상 일관성) */
  const slotIndices = metrics.map((m, i) => ({ m, i })).filter(({ m }) => m && m !== "");
  const BAR_PRIORITY = ["revenue", "cost", "impressions", "clicks", "purchases"];
  const barMetric = activeMetrics.find((m) => BAR_PRIORITY.includes(m)) ?? activeMetrics[0];
  const lineMetrics = activeMetrics.filter((m) => m !== barMetric);

  /* 좌측 Y: 매출 (₩), 우측 Y: CPC/ROAS */
  const barValues  = rows.map((r) => r[barMetric] || 0);
  const barMax     = ratioAxisMax(barValues, barMetric);
  const yBar       = (v) => height - pad.bottom - (v / barMax) * innerH;

  /* 우측 축: 각 라인 지표의 최대값을 같은 비율로 스케일 */
  const lineMaxes  = lineMetrics.map((m) => ratioAxisMax(rows.map((r) => r[m] || 0), m));
  const rightMax   = Math.max(...lineMaxes, 1);
  const yLine      = (v, maxVal) => height - pad.bottom - (v / maxVal) * innerH;

  /* 격자 + 좌측 라벨 */
  const grid = [0, 0.25, 0.5, 0.75, 1].map((ratio) => {
    const yy  = pad.top + ratio * innerH;
    const lbl = formatShort(barMax * (1 - ratio), barMetric);
    /* 우측: 첫 번째 라인 지표 스케일 */
    const rLbl = lineMetrics.length
      ? `<text class="axis secondary-axis" x="${width - 6}" y="${yy + 4}" text-anchor="end">${formatShort(lineMaxes[0] * (1 - ratio), lineMetrics[0])}</text>`
      : "";
    return `<line class="grid-line" x1="${pad.left}" y1="${yy}" x2="${width - pad.right}" y2="${yy}"></line>
      <text class="axis" x="8" y="${yy + 4}">${escapeHtml(lbl)}</text>${rLbl}`;
  }).join("");

  /* 슬롯 원본 인덱스로 색상 결정 */
  const barSlotIdx  = slotIndices.find(({ m }) => m === barMetric)?.i ?? 0;
  const barColor    = COMBO_SLOT_COLORS[barSlotIdx];

  /* 막대 */
  const bars = rows.map((row, i) => {
    const v  = row[barMetric] || 0;
    const bh = Math.max(1, (v / barMax) * innerH);
    const detail = `${row.name}\n${metricMeta[barMetric].label}: ${formatDetailed(v, barMetric)}`;
    return `<rect fill="${barColor}" fill-opacity="0.45" x="${xC(i) - barW / 2}" y="${yBar(v)}" width="${barW}" height="${bh}" rx="4"
      data-tooltip="${escapeAttribute(detail)}"><title>${escapeHtml(detail)}</title></rect>`;
  }).join("");

  /* 라인 두 개 (슬롯 인덱스 기반 색상) */
  const lines = lineMetrics.map((m, li) => {
    const maxVal  = lineMaxes[li];
    const slotIdx = slotIndices.find((s) => s.m === m)?.i ?? (li + 1);
    const color   = COMBO_SLOT_COLORS[slotIdx] ?? COMBO_SLOT_COLORS[li + 1];
    const pts     = rows.map((r, i) => [xC(i), yLine(r[m] || 0, maxVal)]);
    const path    = rows.length > 12 ? smoothPath(pts) : `M ${pts.map((p) => p.join(" ")).join(" L ")}`;
    const dots    = rows.map((r, i) => {
      const detail = `${r.name}\n${metricMeta[m].label}: ${formatDetailed(r[m] || 0, m)}`;
      return `<circle cx="${pts[i][0]}" cy="${pts[i][1]}" r="3.5"
        fill="${color}" stroke="#fff" stroke-width="1.5"
        data-tooltip="${escapeAttribute(detail)}"><title>${escapeHtml(detail)}</title></circle>`;
    }).join("");
    return `<path d="${path}" fill="none" stroke="${color}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"></path>${dots}`;
  }).join("");

  /* X축 라벨 */
  const step = rows.length <= 8 ? 1 : Math.ceil(rows.length / 8);
  const labels = rows.map((row, i) => {
    if (i % step !== 0 && i !== rows.length - 1) return "";
    return `<text class="axis date-axis" x="${xC(i)}" y="${height - 14}" text-anchor="middle">${escapeHtml(row.short || row.name)}</text>`;
  }).join("");

  node.innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="콤보 차트">
    ${grid}${bars}${lines}${labels}
  </svg>`;
}

function renderPeriodReport(view, rows) {
  const meta = reportMeta[view] ?? reportMeta.daily;
  const periodRows = aggregatePeriodRows(rows, view);
  const metrics = state.reportMetrics[view] ?? ["cost", "ctr", null];
  const chartWrap = document.querySelector(`#${view}ReportCharts`);
  if (!chartWrap) return;

  /* 지표 셀렉터 3개 (슬롯 색상 점 포함) */
  const selectors = [0, 1, 2].map((i) => {
    const cur   = metrics[i] ?? null;
    const color = COMBO_SLOT_COLORS[i];
    return `<div class="report-combo-selector-item">
      <span class="combo-slot-dot" style="background:${color};"></span>
      <select class="report-metric-select" data-report-view="${escapeAttribute(view)}" data-report-slot="${i}">
        ${reportMetricOptionsHtml(cur, true)}
      </select>
    </div>`;
  }).join("");

  const activeLabels = metrics.filter((m) => m).map((m) => metricMeta[m]?.label ?? m).join(" · ") || "-";

  chartWrap.innerHTML = `
    <article class="panel chart-panel report-chart-card report-chart-card--combo">
      <header>
        <div>
          <p>${escapeHtml(meta.chartLabel)} Trend</p>
          <h2>${escapeHtml(meta.titlePrefix)} 콤보 차트</h2>
          <small class="basis">${escapeHtml(activeLabels)} · ${escapeHtml(meta.chartLabel)} 집계</small>
        </div>
        <div class="report-combo-selectors">${selectors}</div>
      </header>
      <div id="${view}ReportChartCombo" class="chart report-chart report-chart--combo"></div>
    </article>`;

  renderPeriodComboChart(document.querySelector(`#${view}ReportChartCombo`), periodRows, metrics, view);

  chartWrap.querySelectorAll(".report-metric-select").forEach((select) => {
    select.addEventListener("change", (event) => {
      const slot = Number(event.target.dataset.reportSlot || 0);
      const reportView = event.target.dataset.reportView;
      state.reportMetrics[reportView][slot] = event.target.value || null;
      renderPeriodReport(reportView, filteredRecords());
    });
  });

  const count = document.querySelector(`#${view}ReportCount`);
  if (count) count.textContent = `${formatNumber(periodRows.length)}개 ${meta.tableLabel}`;
  const tbody = document.querySelector(`#${view}ReportTable`);
  if (!tbody) return;
  tbody.innerHTML = periodRows.map((row) => `
    <tr>
      <td>${escapeHtml(row.name)}</td>
      <td>${formatNumber(row.impressions)}</td>
      <td>${formatNumber(row.clicks)}</td>
      <td>${formatMoney(row.cost)}</td>
      <td>${formatPercent(row.ctr)}</td>
      <td>${formatMoney(row.cpc)}</td>
      <td>${formatNumber(row.purchases)}</td>
      <td>${formatPercent(row.cvr)}</td>
      <td>${formatMoney(row.cpa)}</td>
      <td>${formatMoney(row.revenue)}</td>
      <td>${formatRoas(row.roas)}</td>
    </tr>
  `).join("");
}

function renderMatrix(rows) {
  const combos = aggregate(rows.map((row) => ({ ...row, combo: `${row.objective} / ${row.target}` })), "combo").slice(0, 8);
  document.querySelector("#matrixChart").innerHTML = combos.map((item) => `
    <div class="matrix-cell">
      <span>${escapeHtml(item.name)}</span>
      <strong>${metricMeta[state.metric].format(item[state.metric] || 0)}</strong>
      <small>매출 ${formatMoney(item.revenue)} · ROAS ${formatRoas(item.roas)}</small>
    </div>
  `).join("");
}

/* ── 캠페인 활성 상태 계산 ───────────────────────────────────── */
function buildActiveSet(key = "campaign") {
  const allRecords = state.data.records;
  if (!allRecords?.length) return new Set();
  const maxDate = allRecords.reduce((m, r) => (r.date > m ? r.date : m), "");
  const cutoff = new Date(`${maxDate}T00:00:00`);
  cutoff.setDate(cutoff.getDate() - 7);
  const cutoffStr = formatLocalDate(cutoff);
  return new Set(allRecords.filter((r) => r.date >= cutoffStr).map((r) => r[key]));
}

function statusBadge(isActive) {
  return isActive
    ? `<span class="status-badge status-active">운영중</span>`
    : `<span class="status-badge status-ended">종료</span>`;
}

function renderTables(rows) {
  const activeCampaigns = buildActiveSet("campaign");
  const campaignRows = aggregate(rows, "campaign")
    .filter((row) => row.name.toLowerCase().includes(state.campaignQuery.trim().toLowerCase()))
    .slice(0, 30);
  document.querySelector("#campaignTable").innerHTML = campaignRows.map((row) => `
    <tr>
      <td title="${escapeHtml(row.name)}">${statusBadge(activeCampaigns.has(row.name))} ${escapeHtml(truncate(row.name, 32))}</td>
      <td>${formatMoney(row.cost)}</td>
      <td>${formatMoney(row.revenue)}</td>
      <td>${formatRoas(row.roas)}</td>
      <td>${formatNumber(row.purchases)}</td>
      <td>${formatPercent(row.ctr)}</td>
      <td>${formatMoney(row.cpa)}</td>
    </tr>
  `).join("");

  const activeCreatives = buildActiveSet("creative");
  const creativeRows = aggregate(rows, "creative")
    .filter((row) => row.name.toLowerCase().includes(state.creativeQuery.trim().toLowerCase()))
    .slice(0, 50);
  document.querySelector("#creativeTable").innerHTML = creativeRows.map((row) => `
    <tr>
      <td title="${escapeHtml(row.name)}">${statusBadge(activeCreatives.has(row.name))} ${escapeHtml(truncate(row.name, 30))}</td>
      <td>${formatMoney(row.cost)}</td>
      <td>${formatMoney(row.revenue)}</td>
      <td>${formatRoas(row.roas)}</td>
      <td>${formatNumber(row.clicks)}</td>
      <td>${formatNumber(row.purchases)}</td>
      <td>${formatPercent(row.cvr)}</td>
    </tr>
  `).join("");
}

function renderWeeklyCompare() {
  const weekA = document.querySelector("#weekASelect").value;
  const weekB = document.querySelector("#weekBSelect").value;
  const dimensionRows = state.data.records.filter((row) =>
    Object.entries(state.filters).every(([key, value]) => {
      if (state.homeMedia !== "all" && key === "media") return true;
      if (state.homePromotion !== "all" && key === "promotion") return true;
      return value === "all" || String(row[key]) === String(value);
    })
    && (state.homeMedia === "all" || homeMediaOptions[state.homeMedia]?.matches(row))
    && (state.homePromotion === "all" || row.promotion === state.homePromotion)
  );
  const a = aggregateRows(dimensionRows.filter((row) => weekKey(row.date) === weekA));
  const b = aggregateRows(dimensionRows.filter((row) => weekKey(row.date) === weekB));

  const items = [
    { label: "노출", av: a.impressions, bv: b.impressions, formatter: formatNumber, isPositiveGood: true },
    { label: "클릭", av: a.clicks, bv: b.clicks, formatter: formatNumber, isPositiveGood: true },
    { label: "비용", av: a.cost, bv: b.cost, formatter: formatMoney, isPositiveGood: false },
    { label: "전환", av: a.purchases, bv: b.purchases, formatter: formatNumber, isPositiveGood: true },
    { label: "매출", av: a.revenue, bv: b.revenue, formatter: formatMoney, isPositiveGood: true },
  ];

  document.querySelector("#weeklyCompareCards").innerHTML = items.map(({ label, av, bv, formatter, isPositiveGood }) => {
    const diff = bv - av;
    const rate = av ? diff / av : 0;
    const sign = diff >= 0 ? "+" : "";
    const isUp = diff > 0;
    const isZero = Math.abs(diff) < 0.01;

    let cardClass = "";
    if (!isZero && av) {
      if (isPositiveGood) {
        cardClass = isUp ? "positive" : "negative";
      } else {
        cardClass = isUp ? "warning" : "positive";
      }
    }

    const arrow = isUp ? "↑" : "↓";
    const progressWidth = !isZero && av ? Math.min(Math.abs(rate) * 100, 100).toFixed(0) : 0;

    return `
      <article class="compare-card ${cardClass}">
        <span>${label}</span>
        <strong>${formatter(bv)}</strong>
        <div class="compare-progress">
          <div class="compare-progress-bar" style="width:${progressWidth}%"></div>
        </div>
        <div class="compare-delta">
          ${!isZero && av ? `<span class="compare-arrow">${arrow}</span>` : ""}
          <small>${sign}${formatter(diff)} (${sign}${formatPercent(rate)})</small>
        </div>
      </article>
    `;
  }).join("");
}

function keywordRow(row, columns = "full") {
  if (columns === "revenue") {
    return `<tr><td>${escapeHtml(row.name)}</td><td>${formatMoney(row.revenue)}</td><td>${formatMoney(row.cost)}</td><td>${formatRoas(row.roas)}</td><td>${formatNumber(row.purchases)}</td></tr>`;
  }
  if (columns === "roas") {
    return `<tr><td>${escapeHtml(row.name)}</td><td>${formatRoas(row.roas)}</td><td>${formatMoney(row.revenue)}</td><td>${formatMoney(row.cost)}</td></tr>`;
  }
  return `<tr><td>${escapeHtml(row.name)}</td><td>${formatNumber(row.impressions)}</td><td>${formatNumber(row.clicks)}</td><td>${formatMoney(row.cost)}</td><td>${formatNumber(row.purchases)}</td><td>${formatMoney(row.revenue)}</td><td>${formatRoas(row.roas)}</td></tr>`;
}

function renderKeywordReport(rows) {
  const sourceRows = rows?.length ? rows : filteredKeywordRecords();
  const keywordRows = aggregateByName(sourceRows, keywordName).filter((row) => row.name !== "키워드 없음");
  const revenueTop = [...keywordRows].sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  const roasTop = [...keywordRows].filter((row) => row.cost > 0 && row.revenue > 0).sort((a, b) => b.roas - a.roas).slice(0, 10);
  const query = state.keywordQuery.trim().toLowerCase();
  const detail = keywordRows.filter((row) => row.name.toLowerCase().includes(query)).slice(0, 80);

  document.querySelector("#keywordRevenueTable").innerHTML = revenueTop.map((row) => keywordRow(row, "revenue")).join("") || `<tr><td colspan="5">키워드 데이터가 없습니다.</td></tr>`;
  document.querySelector("#keywordRoasTable").innerHTML = roasTop.map((row) => keywordRow(row, "roas")).join("") || `<tr><td colspan="4">키워드 데이터가 없습니다.</td></tr>`;
  document.querySelector("#keywordDetailTable").innerHTML = detail.map((row) => keywordRow(row)).join("") || `<tr><td colspan="7">키워드 데이터가 없습니다.</td></tr>`;
}

function metricValueRow(label, metrics, isTotal = false) {
  const cpm = metrics.impressions ? (metrics.cost / metrics.impressions) * 1000 : 0;
  return `
    <tr class="${isTotal ? "total-row" : ""}">
      <td>${escapeHtml(label)}</td>
      <td>${formatNumber(metrics.impressions)}</td>
      <td>${formatNumber(metrics.clicks)}</td>
      <td>${formatPercent(metrics.ctr)}</td>
      <td>${formatPlainMoney(metrics.cpc)}</td>
      <td>${formatPlainMoney(cpm)}</td>
      <td>${formatPlainMoney(metrics.cost)}</td>
      <td>${formatNumber(metrics.purchases)}</td>
      <td>${formatPlainMoney(metrics.revenue)}</td>
      <td>${formatPercent(metrics.cvr)}</td>
      <td>${formatPlainMoney(metrics.cpa)}</td>
      <td>${formatRoas(metrics.roas)}</td>
    </tr>
  `;
}

function renderPromotionDetail(rows) {
  const select = document.querySelector("#promotionDetailSelect");
  const promotion = select.value || state.promotionDetail;
  state.promotionDetail = promotion;
  document.querySelector("#promotionDetailTitle").textContent = promotion || "프로모션";

  const promotionRows = rows.filter((row) => row.promotion === promotion);
  const mediaRows = aggregate(promotionRows, "media")
    .sort((a, b) => {
      if (a.name.includes("네이버")) return -1;
      if (b.name.includes("네이버")) return 1;
      if (a.name.includes("메타")) return -1;
      if (b.name.includes("메타")) return 1;
      return b.revenue - a.revenue;
    });
  const total = aggregateRows(promotionRows);

  document.querySelector("#promotionDetailTable").innerHTML = [
    ...mediaRows.map((row) => metricValueRow(row.name, row)),
    metricValueRow("Total", total, true),
  ].join("");
}

function renderCharts(rows) {
  const dateRows = aggregate(rows, "date").sort((a, b) => a.name.localeCompare(b.name)).map((row) => ({ ...row, date: row.name }));

  /* 전주 비교용 날짜 행 */
  const prevRaw = previousPeriodRows();
  const prevDateRows = prevRaw.length
    ? aggregate(prevRaw, "date").sort((a, b) => a.name.localeCompare(b.name)).map((row) => ({ ...row, date: row.name }))
    : null;

  const comparisonRows = aggregate(rows, state.groupBy).slice(0, 13);
  const themeRows = aggregate(rows, "creativeTheme").slice(0, 10);

  const metric = metricMeta[state.metric];
  if (state.currentView === "home") return; // handled by renderChartsForHome

  if (state.currentView === "media") {
    const mediaRows   = aggregate(rows, "media");
    const mrMetrics   = state.mediaReportMetrics;
    const primaryM    = mrMetrics.find((m) => m) ?? "cost";
    const primaryMeta = metricMeta[primaryM] ?? metric;

    /* ── 1. 콤보 트렌드 차트 ── */
    const comboWrap = document.querySelector("#mediaComboWrap");
    if (comboWrap) {
      const selectors = [0, 1, 2].map((i) => {
        const cur   = mrMetrics[i] ?? null;
        const color = COMBO_SLOT_COLORS[i];
        return `<div class="report-combo-selector-item">
          <span class="combo-slot-dot" style="background:${color}"></span>
          <select class="media-report-metric-select report-metric-select" data-media-slot="${i}">
            ${reportMetricOptionsHtml(cur, true)}
          </select>
        </div>`;
      }).join("");
      const activeLabels = mrMetrics.filter((m) => m).map((m) => metricMeta[m]?.label ?? m).join(" · ") || "-";
      comboWrap.innerHTML = `
        <article class="panel chart-panel span-3">
          <header>
            <div>
              <p>Media Trend</p>
              <h2>전체 일자별 트렌드</h2>
              <small class="basis">${escapeHtml(activeLabels)} · 일자별 집계</small>
            </div>
            <div class="report-combo-selectors">${selectors}</div>
          </header>
          <div id="mediaTrendChart" class="chart report-chart report-chart--combo"></div>
        </article>`;
      renderPeriodComboChart(document.querySelector("#mediaTrendChart"), dateRows, mrMetrics, "daily");
      comboWrap.querySelectorAll(".media-report-metric-select").forEach((sel) => {
        sel.addEventListener("change", (e) => {
          state.mediaReportMetrics[Number(e.target.dataset.mediaSlot)] = e.target.value || null;
          renderCharts(filteredRecords());
        });
      });
    }

    /* ── 2. 매체 비교 바 차트 ── */
    document.querySelector("#mediaAnalysisBasis").textContent = `기준: ${primaryMeta.basis}`;
    renderBarChart(document.querySelector("#mediaAnalysisChart"), mediaRows.slice(0, 12), primaryM, {
      horizontal: true, height: 370, width: 840, leftPadding: 190,
      firstLineLimit: 18, secondLineLimit: 22,
    });

    /* ── 3. 매체 기여도 파이 ── */
    renderPieChart(document.querySelector("#mediaShareChart"), mediaRows, primaryM);

    /* ── 4. 매체 상세 테이블 ── */
    renderMediaDetailTable(mediaRows);
    return;
  }

  if (state.currentView === "promotion") {
    const promoRows = state.promotionViewFilter.length
      ? rows.filter((r) => state.promotionViewFilter.includes(r.promotion))
      : rows;
    document.querySelector("#promotionAnalysisBasis").textContent = `기준: ${metric.basis}`;
    renderBarChart(document.querySelector("#promotionAnalysisChart"), aggregate(promoRows, "promotion").slice(0, 15), state.metric, {
      horizontal: true,
      height: 410,
      width: 840,
      leftPadding: 220,
      firstLineLimit: 18,
      secondLineLimit: 22,
    });
    renderPieChart(document.querySelector("#promotionMediaMixChart"), aggregate(promoRows, "media"), state.metric);
    return;
  }

  if (state.currentView === "weekly") {
    document.querySelector("#comparisonTitle").textContent = `${groupMeta[state.groupBy]}별 ${metric.label} 비교`;
    document.querySelector("#comparisonBasis").textContent = `기준: ${metric.basis}`;
    document.querySelector("#matrixBasis").textContent = `기준: ${metric.basis}`;
    renderBarChart(document.querySelector("#comparisonChart"), comparisonRows, state.metric, {
      horizontal: true,
      height: 370,
      width: 840,
      leftPadding: 220,
      firstLineLimit: 18,
      secondLineLimit: 22,
    });
    renderMatrix(rows);
    return;
  }

  if (state.currentView === "daily") {
    document.querySelector("#themeBasis").textContent = `기준: ${metric.basis} · 소재 메시지별 집계`;
    renderDailyComboChart(document.querySelector("#dailyDetailChart"), dateRows, state.metric);
    renderBarChart(document.querySelector("#keywordChart"), themeRows, state.metric, {
      horizontal: true,
      height: 300,
      leftPadding: 150,
      firstLineLimit: 12,
      secondLineLimit: 16,
    });
  }
}

/* ── Filter Drawer ──────────────────────────────────────────── */

let pendingFilters = {};

function openFilterDrawer() {
  pendingFilters = { ...state.filters };
  for (const [id, key] of [
    ["#drawerMediaFilter", "media"],
    ["#promotionFilter", "promotion"],
    ["#objectiveFilter", "objective"],
    ["#targetFilter", "target"],
  ]) {
    const el = document.querySelector(id);
    if (el) {
      el.value = pendingFilters[key] ?? "all";
      updateFilterSelectDisplay(el);
    }
  }
  const drawer = document.querySelector("#filterDrawer");
  drawer.classList.add("is-open");
  drawer.setAttribute("aria-hidden", "false");
}

function closeFilterDrawer() {
  const drawer = document.querySelector("#filterDrawer");
  drawer.classList.remove("is-open");
  drawer.setAttribute("aria-hidden", "true");
}

function applyFilterDrawer() {
  if (pendingFilters.media && pendingFilters.media !== "all") {
    state.homeMedia = "all";
  }
  Object.assign(state.filters, pendingFilters);
  syncHomeMediaControls();
  renderAll();
  closeFilterDrawer();
}

function resetFilterDrawer() {
  for (const key of ["media", "promotion", "objective", "target"]) {
    state.filters[key] = "all";
    pendingFilters[key] = "all";
  }
  const { start, end } = getPresetRange("D30");
  state.range.dateStart = start;
  state.range.dateEnd = end;
  state.pendingRange = { ...state.range };
  state.homeMedia = "all";
  state.homePromotion = "all";
  state.metric = "impressions";
  state.secondaryMetric = null;
  state.activePreset = "D30";
  state.showAnomalyMarkers = false;
  for (const id of ["#drawerMediaFilter", "#promotionFilter", "#objectiveFilter", "#targetFilter"]) {
    const el = document.querySelector(id);
    if (el) {
      el.value = "all";
      updateFilterSelectDisplay(el);
    }
  }
  document.querySelector("#dateStart").value = state.range.dateStart;
  document.querySelector("#dateEnd").value = state.range.dateEnd;
  updateDateRangeText();
  renderDatePicker();
  const anomalyToggle = document.querySelector("#toggleAnomalyBtn");
  if (anomalyToggle) anomalyToggle.checked = state.showAnomalyMarkers;
  syncMetricControls();
  syncHomeMediaControls();
  syncHomePromotionControls();
  renderAll();
  closeFilterDrawer();
}

function renderFilterChips() {
  const chips = document.querySelector("#activeFilterChips");
  const badge = document.querySelector("#filterBadge");
  if (!chips) return;
  const active = Object.entries(state.filters)
    .filter(([k, v]) => Object.keys(FILTER_LABELS).includes(k) && v !== "all")
    .map(([key, value]) => ({ key, value, label: FILTER_LABELS[key], scope: "filter" }));
  if (state.homeMedia !== "all") {
    active.push({ key: "homeMedia", value: state.homeMedia, label: "매체", text: homeMediaOptions[state.homeMedia]?.label ?? state.homeMedia, scope: "home" });
  }
  if (state.homePromotion !== "all") {
    active.push({ key: "homePromotion", value: state.homePromotion, label: "프로모션", text: state.homePromotion, scope: "home" });
  }
  chips.innerHTML = active.map((item) =>
    `<span class="active-chip" data-key="${escapeAttribute(item.key)}" data-scope="${escapeAttribute(item.scope)}">
      <span>${escapeHtml(item.label)}: ${escapeHtml(item.text ?? item.value)}</span>
      <button type="button" aria-label="제거">✕</button>
    </span>`
  ).join("");
  chips.querySelectorAll(".active-chip button").forEach((btn) => {
    btn.addEventListener("click", () => {
      const chip = btn.closest(".active-chip");
      const key = chip.dataset.key;
      if (key === "homeMedia") state.homeMedia = "all";
      else if (key === "homePromotion") state.homePromotion = "all";
      else state.filters[key] = "all";
      syncHomeMediaControls();
      syncHomePromotionControls();
      renderAll();
    });
  });
  const count = active.length;
  if (badge) { badge.textContent = count; badge.hidden = count === 0; }
  document.querySelector("#openFilterDrawer")?.classList.toggle("has-active", count > 0);
}

/* ── CSV 내보내기 ──────────────────────────────────────────── */

function exportCsv() {
  const rows = filteredRecords();
  const headers = ["날짜","매체","프로모션","목적","타겟","캠페인","그룹","소재","노출수","클릭수","비용(VAT+/Fee+)","전환수","매출(원)","CTR","CPC","CVR","CPA","ROAS"];
  const values = (row) => {
    const metrics = enrich({ ...emptyMetrics(), cost: adjustedCost(row), impressions: row.impressions || 0, clicks: row.clicks || 0, purchases: row.purchases || 0, revenue: row.revenue || 0 });
    return [
      row.date, row.media, row.promotion, row.objective, row.target, row.campaign, row.group, row.creative,
      row.impressions, row.clicks, metrics.cost, row.purchases, row.revenue,
      metrics.ctr, metrics.cpc, metrics.cvr, metrics.cpa, metrics.roas,
    ];
  };
  const escape = (v) => { const s = String(v ?? ""); return (s.includes(",") || s.includes('"') || s.includes("\n")) ? `"${s.replace(/"/g,'""')}"` : s; };
  const csv = [headers.join(","), ...rows.map((r) => values(r).map(escape).join(","))].join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: `zinus-${state.range.dateStart || "all"}~${state.range.dateEnd || "all"}.csv` });
  a.click();
  URL.revokeObjectURL(url);
}

/* ── 브랜드검색 뷰 ───────────────────────────────────────────── */

function getBrandRows(rows) {
  const brandSearchCampaign = /^(?:4\.)?\s*\uBE0C\uB79C\uB4DC\s*\uAC80\uC0C9$/i;
  return rows.filter((r) => brandSearchCampaign.test(String(r.campaign || "").trim()));
}

function brandDeviceTag(row) {
  const c = String(row.campaign || "");
  const g = String(row.group || "");
  if (c.includes("_PC") || g.startsWith("PC_") || g.includes("쇼핑연동형 PC") || g.includes("쇼핑연동형_PC")) return "PC";
  if (c.includes("_MO") || g.startsWith("MO_") || g.includes("쇼핑연동형_MO")) return "MO";
  return "공통";
}

function sumBrandMetrics(rows) {
  const t = { impressions: 0, clicks: 0, cost: 0, purchases: 0, revenue: 0 };
  for (const r of rows) {
    t.impressions += r.impressions || 0;
    t.clicks += r.clicks || 0;
    t.cost += r.cost || 0;
    t.purchases += r.purchases || 0;
    t.revenue += r.revenue || 0;
  }
  t.ctr = t.impressions ? t.clicks / t.impressions : 0;
  t.cvr = t.clicks ? t.purchases / t.clicks : 0;
  t.cpa = t.purchases ? t.cost / t.purchases : 0;
  return t;
}

function renderBrandDeviceKpis(pcRows, moRows, allRows) {
  const strip = document.querySelector("#brandKpis");
  if (!strip) return;
  const pc = sumBrandMetrics(pcRows);
  const mo = sumBrandMetrics(moRows);
  const all = sumBrandMetrics(allRows);

  function block(label, t, color) {
    const items = [
      ["노출", formatNumber(t.impressions)],
      ["클릭", formatNumber(t.clicks)],
      ["CTR", formatPercent(t.ctr)],
      ["전환", formatNumber(t.purchases)],
      ["매출", formatCompactMoney(t.revenue) + "원"],
      ["CVR", formatPercent(t.cvr)],
    ];
    return `<div class="brand-device-block" style="border-top:3px solid ${color}">
      <div class="brand-device-tag" style="color:${color}">${escapeHtml(label)}</div>
      ${items.map(([k, v]) => `<div class="brand-kpi-row">
        <span class="brand-kpi-label">${k}</span>
        <span class="brand-kpi-val">${escapeHtml(v)}</span>
      </div>`).join("")}
    </div>`;
  }

  strip.innerHTML = `<div class="brand-device-strip">
    ${block("PC", pc, "#4691c7")}
    ${block("MO", mo, "#00b894")}
    ${block("전체 브랜드검색", all, "#8fa0b0")}
  </div>`;
}

function renderBrandTrendChart(container, allRows, pcRows, moRows, metric) {
  if (!container) return;

  function dateSum(rows) {
    const m = new Map();
    for (const r of rows) {
      if (!m.has(r.date)) m.set(r.date, emptyMetrics());
      addMetrics(m.get(r.date), r);
    }
    return new Map([...m.entries()].map(([date, metrics]) => [date, enrich(metrics)[metric] || 0]));
  }
  const allMap = dateSum(allRows);
  const pcMap  = dateSum(pcRows);
  const moMap  = dateSum(moRows);
  const dates  = [...new Set([...allMap.keys(), ...pcMap.keys(), ...moMap.keys()])].sort();

  if (!dates.length) {
    container.innerHTML = '<div class="empty-chart">데이터 없음</div>';
    return;
  }

  const allVals = dates.map((d) => allMap.get(d) || 0);
  const pcVals  = dates.map((d) => pcMap.get(d)  || 0);
  const moVals  = dates.map((d) => moMap.get(d)  || 0);
  const maxVal  = Math.max(...allVals, 1);

  const W = 760, H = 240, pad = { top: 20, right: 20, bottom: 46, left: 72 };
  const iW = W - pad.left - pad.right, iH = H - pad.top - pad.bottom;
  const n = dates.length;
  const xPos = (i) => pad.left + (n > 1 ? i / (n - 1) : 0.5) * iW;
  const yPos = (v) => pad.top + (1 - v / maxVal) * iH;

  const grids = [0, 0.5, 1].map((r) => {
    const y = pad.top + r * iH;
    return `<line class="grid-line" x1="${pad.left}" y1="${y}" x2="${W - pad.right}" y2="${y}"/>
      <text class="axis" x="${pad.left - 6}" y="${y + 4}" text-anchor="end">${escapeHtml(formatShort(maxVal * (1 - r), metric))}</text>`;
  }).join("");

  const step = Math.max(1, Math.ceil(n / 10));
  const xLabels = dates.filter((_, i) => i % step === 0 || i === n - 1).map((d) => {
    const i = dates.indexOf(d);
    const [, mm, dd] = d.split("-");
    return `<text class="axis date-axis" x="${xPos(i).toFixed(1)}" y="${H - 8}" text-anchor="middle">${parseInt(mm)}/${parseInt(dd)}</text>`;
  }).join("");

  const mkPath = (vals) => vals.map((v, i) => `${i === 0 ? "M" : "L"}${xPos(i).toFixed(1)},${yPos(v).toFixed(1)}`).join("");
  const totalArea = mkPath(allVals) + ` L${xPos(n - 1).toFixed(1)},${(pad.top + iH).toFixed(1)} L${xPos(0).toFixed(1)},${(pad.top + iH).toFixed(1)} Z`;

  const legendY = H - 18;
  const legend = [
    { label: "PC",   color: "#4691c7", dash: "" },
    { label: "MO",   color: "#00b894", dash: "" },
    { label: "전체", color: "#b2bec3", dash: "4 2" },
  ].map((it, i) => {
    const lx = pad.left + i * 68;
    return `<line x1="${lx}" y1="${legendY}" x2="${lx + 18}" y2="${legendY}" stroke="${it.color}" stroke-width="2" ${it.dash ? `stroke-dasharray="${it.dash}"` : ""}/>
      <text class="axis" x="${lx + 22}" y="${legendY + 4}">${it.label}</text>`;
  }).join("");

  container.innerHTML = `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto" role="img" aria-label="브랜드검색 PC/MO 추이">
    ${grids}
    <path d="${totalArea}" fill="rgba(143,160,176,0.07)"/>
    <path d="${mkPath(allVals)}" fill="none" stroke="#b2bec3" stroke-width="1.5" stroke-dasharray="4 2"/>
    <path d="${mkPath(pcVals)}" fill="none" stroke="#4691c7" stroke-width="2.2" stroke-linejoin="round"/>
    <path d="${mkPath(moVals)}" fill="none" stroke="#00b894" stroke-width="2.2" stroke-linejoin="round"/>
    ${xLabels}
    ${legend}
  </svg>`;
}

function renderBrandDetailTable(brandRows) {
  const tbody = document.querySelector("#brandDetailTable");
  if (!tbody) return;

  const groups = new Map();
  for (const r of brandRows) {
    const device = brandDeviceTag(r);
    const groupName = r.group || r.campaign || "브랜드 검색";
    const key = `${groupName}__${device}`;
    if (!groups.has(key)) groups.set(key, { group: groupName, device, impressions: 0, clicks: 0, cost: 0, purchases: 0, revenue: 0 });
    const g = groups.get(key);
    g.impressions += r.impressions || 0;
    g.clicks      += r.clicks      || 0;
    g.cost        += r.cost        || 0;
    g.purchases   += r.purchases   || 0;
    g.revenue     += r.revenue     || 0;
  }

  const tableRows = [...groups.values()]
    .map((g) => ({ ...g, ctr: g.impressions ? g.clicks / g.impressions : 0, cvr: g.clicks ? g.purchases / g.clicks : 0 }))
    .sort((a, b) => b.revenue - a.revenue);

  const total = tableRows.reduce(
    (t, r) => ({ impressions: t.impressions + r.impressions, clicks: t.clicks + r.clicks, purchases: t.purchases + r.purchases, revenue: t.revenue + r.revenue }),
    { impressions: 0, clicks: 0, purchases: 0, revenue: 0 }
  );
  total.ctr = total.impressions ? total.clicks / total.impressions : 0;
  total.cvr = total.clicks ? total.purchases / total.clicks : 0;

  const pill = (device) => {
    const cls = device === "PC" ? "pc" : device === "MO" ? "mo" : "common";
    return `<span class="brand-device-pill ${cls}">${escapeHtml(device)}</span>`;
  };

  tbody.innerHTML =
    tableRows.map((r) => `<tr>
      <td>${escapeHtml(r.group)}</td>
      <td style="text-align:center">${pill(r.device)}</td>
      <td>${escapeHtml(formatNumber(r.impressions))}</td>
      <td>${escapeHtml(formatNumber(r.clicks))}</td>
      <td>${escapeHtml(formatPercent(r.ctr))}</td>
      <td>${escapeHtml(formatNumber(r.purchases))}</td>
      <td>${escapeHtml(formatMoney(r.revenue))}</td>
      <td>${escapeHtml(formatPercent(r.cvr))}</td>
    </tr>`).join("") +
    `<tr class="total-row">
      <td colspan="2"><strong>합계</strong></td>
      <td>${escapeHtml(formatNumber(total.impressions))}</td>
      <td>${escapeHtml(formatNumber(total.clicks))}</td>
      <td>${escapeHtml(formatPercent(total.ctr))}</td>
      <td>${escapeHtml(formatNumber(total.purchases))}</td>
      <td>${escapeHtml(formatMoney(total.revenue))}</td>
      <td>${escapeHtml(formatPercent(total.cvr))}</td>
    </tr>`;
}

/* ── 프로모션 다중 선택 필터 ─────────────────────────────────── */

function renderPromoFilterBar() {
  const chipsEl  = document.querySelector("#promoFilterChips");
  const clearBtn = document.querySelector("#promoClearAll");
  if (!chipsEl) return;

  const sel = state.promotionViewFilter;

  if (sel.length === 0) {
    chipsEl.innerHTML = '<span class="promo-all-chip">전체 프로모션</span>';
  } else {
    chipsEl.innerHTML = sel.map((name) =>
      `<span class="promo-chip">
        <span class="promo-chip-name" title="${escapeAttribute(name)}">${escapeHtml(truncate(name, 22))}</span>
        <button class="promo-chip-remove" data-name="${escapeAttribute(name)}" aria-label="제거">×</button>
      </span>`
    ).join("");
    chipsEl.querySelectorAll(".promo-chip-remove").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        state.promotionViewFilter = state.promotionViewFilter.filter((n) => n !== btn.dataset.name);
        renderAll();
      });
    });
  }
  if (clearBtn) clearBtn.hidden = sel.length === 0;
}

function openPromoDropdown(query) {
  const dropdown = document.querySelector("#promoDropdown");
  if (!dropdown) return;

  const all = uniqueValues("promotion");
  const q   = (query || "").trim().toLowerCase();
  const list = q ? all.filter((p) => p.toLowerCase().includes(q)) : all;

  if (!list.length) {
    dropdown.innerHTML = '<li class="promo-dd-empty">결과 없음</li>';
    dropdown.hidden = false;
    return;
  }

  dropdown.innerHTML = list.map((name) => {
    const checked = state.promotionViewFilter.includes(name);
    return `<li class="promo-dd-item${checked ? " is-checked" : ""}" data-name="${escapeAttribute(name)}">
      <span class="promo-dd-checkbox">${checked ? "✓" : ""}</span>
      <span class="promo-dd-name" title="${escapeAttribute(name)}">${escapeHtml(name)}</span>
    </li>`;
  }).join("");

  dropdown.querySelectorAll(".promo-dd-item").forEach((item) => {
    item.addEventListener("mousedown", (e) => {
      e.preventDefault(); // input blur 방지
      const name = item.dataset.name;
      if (state.promotionViewFilter.includes(name)) {
        state.promotionViewFilter = state.promotionViewFilter.filter((n) => n !== name);
      } else {
        state.promotionViewFilter = [...state.promotionViewFilter, name];
      }
      openPromoDropdown(document.querySelector("#promoSearchInput")?.value ?? "");
      renderAll();
    });
  });

  dropdown.hidden = false;
}

function bindPromoFilter() {
  const input    = document.querySelector("#promoSearchInput");
  const dropdown = document.querySelector("#promoDropdown");
  const clearBtn = document.querySelector("#promoClearAll");

  input?.addEventListener("focus", () => openPromoDropdown(input.value));
  input?.addEventListener("input", () => openPromoDropdown(input.value));
  input?.addEventListener("blur", () => {
    // 약간 딜레이를 줘서 mousedown 이벤트 처리 후 닫기
    setTimeout(() => { if (dropdown) dropdown.hidden = true; }, 150);
  });

  clearBtn?.addEventListener("click", () => {
    state.promotionViewFilter = [];
    if (input) input.value = "";
    if (dropdown) dropdown.hidden = true;
    renderAll();
  });

  // 외부 클릭 시 닫기
  document.addEventListener("click", (e) => {
    if (!e.target.closest("#promoFilterSticky") && dropdown) {
      dropdown.hidden = true;
    }
  });
}

/* ── 소재 갤러리 ───────────────────────────────────────────── */

let _creativesCache = null;   // 로드된 소재 인덱스 캐시

async function loadCreatives() {
  if (_creativesCache !== null) return _creativesCache;
  if (Array.isArray(window.BRAND_CREATIVES)) {
    _creativesCache = window.BRAND_CREATIVES;
    return _creativesCache;
  }
  try {
    const res = await fetch("./creatives/index.json?_=" + Date.now());
    _creativesCache = res.ok ? await res.json() : [];
  } catch {
    _creativesCache = [];
  }
  return _creativesCache;
}

function sumCreativeMetrics(rows, creative) {
  const name = String(creative.name || "");
  const id = String(creative.id || "");
  const device = String(creative.device || "").toUpperCase();
  const t = { impressions: 0, clicks: 0, cost: 0, purchases: 0, revenue: 0 };

  if (creative.metrics) {
    for (const key of Object.keys(t)) t[key] = Number(creative.metrics[key] || 0);
    return enrich(t);
  }

  if (["impressions", "clicks", "cost", "purchases", "revenue"].some((key) => key in creative)) {
    for (const key of Object.keys(t)) t[key] = Number(creative[key] || 0);
    return enrich(t);
  }

  for (const r of rows) {
    const rowCreative = String(r.creative || "");
    const rowId = String(r.creativeId || r.adId || r.id || "");
    const exactMatch = rowCreative && rowCreative === name;
    const idMatch = id && rowId && rowId === id;
    if (!exactMatch && !idMatch) continue;
    t.impressions += r.impressions || 0;
    t.clicks      += r.clicks      || 0;
    t.cost        += r.cost        || 0;
    t.purchases   += r.purchases   || 0;
    t.revenue     += r.revenue     || 0;
  }

  if (t.impressions || t.clicks || t.purchases || t.revenue || t.cost) return enrich(t);

  // 현재 raw 브랜드검색 성과는 소재명이 비어 있어, 소재별 직접 매칭이 없으면 PC/MO 그룹 성과를 연결한다.
  const deviceRows = rows.filter((r) => brandDeviceTag(r) === device);
  return aggregateRows(deviceRows);
}

function renderCreativeGallery(brandRows, creatives) {
  const tbody = document.querySelector("#brandCreativeTable");
  if (!tbody) return;

  if (!creatives.length) {
    tbody.innerHTML = `<tr><td colspan="13">등록된 소재가 없습니다.</td></tr>`;
    return;
  }

  const deviceFilter = state.brandCreativeDevice;
  document.querySelectorAll(".creative-device-btn").forEach((btn) => {
    btn.classList.toggle("is-active", (btn.dataset.device || "all") === deviceFilter);
  });
  const cards = creatives.map((c) => ({
    id: c.id || c.creativeId || "",
    name: c.name || c.creativeName || "소재명 없음",
    device: String(c.device || "").toUpperCase() || "공통",
    file: c.file || (c.capture ? `creatives/${c.capture}` : ""),
    metrics: sumCreativeMetrics(brandRows, {
      ...c,
      id: c.id || c.creativeId || "",
      name: c.name || c.creativeName || "",
      device: String(c.device || "").toUpperCase(),
    }),
  }))
    .filter((c) => deviceFilter === "all" || c.device === deviceFilter)
    .sort((a, b) => {
      const deviceRank = { MO: 0, PC: 1, "공통": 2 };
      return (deviceRank[a.device] ?? 9) - (deviceRank[b.device] ?? 9) || a.name.localeCompare(b.name, "ko");
    });

  const basisEl = document.querySelector("#creativeGalleryBasis");
  if (basisEl) {
    const deviceLabel = deviceFilter === "all" ? "ALL" : deviceFilter;
    basisEl.textContent = `${deviceLabel} 소재 ${cards.length}개 · 성과: PC/MO 그룹 기준 · 디바이스 / 소재명 / 성과 / 캡쳐 순서`;
  }

  if (!cards.length) {
    tbody.innerHTML = `<tr><td colspan="13">선택한 디바이스에 해당하는 소재가 없습니다.</td></tr>`;
    return;
  }

  tbody.innerHTML = cards.map((c) => {
    const m = c.metrics;
    const imgSrc = c.file ? `./${c.file}` : "";
    const deviceClass = c.device === "PC" ? "pc" : c.device === "MO" ? "mo" : "common";
    const caption = `${c.name}${c.device ? ` (${c.device})` : ""}`;
    const previewAttrs = imgSrc
      ? `data-preview-img="${escapeAttribute(imgSrc)}" data-preview-caption="${escapeAttribute(caption)}"`
      : "";

    return `<tr class="creative-performance-row">
      <td><span class="brand-device-pill ${deviceClass}">${escapeHtml(c.device)}</span></td>
      <td>
        <button type="button" class="creative-name-button" ${previewAttrs}>
          <span>${escapeHtml(c.name)}</span>
          <small>${escapeHtml(c.id)}</small>
        </button>
      </td>
      <td>${escapeHtml(formatNumber(m.impressions))}</td>
      <td>${escapeHtml(formatNumber(m.clicks))}</td>
      <td>${escapeHtml(formatMoney(m.cost))}</td>
      <td>${escapeHtml(formatPercent(m.ctr))}</td>
      <td>${escapeHtml(formatMoney(m.cpc))}</td>
      <td>${escapeHtml(formatNumber(m.purchases))}</td>
      <td>${escapeHtml(formatPercent(m.cvr))}</td>
      <td>${escapeHtml(formatMoney(m.cpa))}</td>
      <td>${escapeHtml(formatMoney(m.revenue))}</td>
      <td>${escapeHtml(formatRoas(m.roas))}</td>
      <td>
        ${imgSrc
          ? `<button type="button" class="creative-capture-button" ${previewAttrs}>보기</button>`
          : `<span class="creative-no-capture">없음</span>`}
      </td>
    </tr>`;
  }).join("");

  tbody.querySelectorAll(".creative-name-button[data-preview-img]").forEach((el) => {
    el.addEventListener("mouseenter", (event) => showCreativePreview(event.currentTarget.dataset.previewImg, event.currentTarget.dataset.previewCaption, event));
    el.addEventListener("mousemove", moveCreativePreview);
    el.addEventListener("mouseleave", hideCreativePreview);
  });
  tbody.querySelectorAll(".creative-name-button[data-preview-img], .creative-capture-button[data-preview-img]").forEach((el) => {
    el.addEventListener("click", (event) => {
      event.preventDefault();
      openCreativeModal(event.currentTarget.dataset.previewImg, event.currentTarget.dataset.previewCaption);
    });
  });
}

function openCreativeModal(src, caption) {
  const modal   = document.querySelector("#creativeModal");
  const img     = document.querySelector("#creativeModalImg");
  const capEl   = document.querySelector("#creativeModalCaption");
  if (!modal || !img) return;
  img.src = src;
  if (capEl) capEl.textContent = caption || "";
  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden", "false");
}

function closeCreativeModal() {
  const modal = document.querySelector("#creativeModal");
  if (!modal) return;
  modal.classList.remove("is-open");
  modal.setAttribute("aria-hidden", "true");
  const img = document.querySelector("#creativeModalImg");
  if (img) img.src = "";
}

let creativePreviewEl = null;

function ensureCreativePreview() {
  if (creativePreviewEl) return creativePreviewEl;
  creativePreviewEl = document.createElement("div");
  creativePreviewEl.className = "creative-hover-preview";
  creativePreviewEl.innerHTML = '<img alt="소재 미리보기" /><div class="creative-hover-caption"></div>';
  document.body.appendChild(creativePreviewEl);
  return creativePreviewEl;
}

function moveCreativePreview(event) {
  if (!creativePreviewEl) return;
  const offset = 18;
  const maxX = window.innerWidth - creativePreviewEl.offsetWidth - 16;
  const maxY = window.innerHeight - creativePreviewEl.offsetHeight - 16;
  creativePreviewEl.style.left = `${Math.min(event.clientX + offset, Math.max(16, maxX))}px`;
  creativePreviewEl.style.top = `${Math.min(event.clientY + offset, Math.max(16, maxY))}px`;
}

function showCreativePreview(src, caption, event) {
  if (!src) return;
  const preview = ensureCreativePreview();
  const img = preview.querySelector("img");
  const cap = preview.querySelector(".creative-hover-caption");
  img.src = src;
  cap.textContent = caption || "";
  preview.classList.add("is-visible");
  moveCreativePreview(event);
}

function hideCreativePreview() {
  if (creativePreviewEl) creativePreviewEl.classList.remove("is-visible");
}

function bindCreativeGallery() {
  document.querySelectorAll(".creative-device-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.brandCreativeDevice = btn.dataset.device || "all";
      document.querySelectorAll(".creative-device-btn").forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      renderAll();
    });
  });
  // 모달 닫기
  document.querySelector("#creativeModal .creative-modal-backdrop")?.addEventListener("click", closeCreativeModal);
  document.querySelector(".creative-modal-close")?.addEventListener("click", closeCreativeModal);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeCreativeModal(); });
  // 소재 인덱스 변경 감지용 무효화 메서드 노출
  window.reloadCreatives = () => { _creativesCache = null; renderAll(); };
}

function renderBrandView(rows) {
  const metric  = state.brandMetric;
  const brandRows = getBrandRows(rows);
  const kpiEl = document.querySelector("#brandKpis");
  if (!brandRows.length) {
    if (kpiEl) kpiEl.innerHTML = '<p style="color:var(--muted);padding:24px;text-align:center">브랜드검색 데이터 없음</p>';
    return;
  }
  const pcRows = brandRows.filter((r) => brandDeviceTag(r) === "PC");
  const moRows = brandRows.filter((r) => brandDeviceTag(r) === "MO");
  renderBrandDeviceKpis(pcRows, moRows, brandRows);
  renderBrandTrendChart(document.querySelector("#brandTrendChart"), brandRows, pcRows, moRows, metric);
  const basisEl = document.querySelector("#brandTrendBasis");
  if (basisEl) basisEl.textContent = `기준: ${metricMeta[metric]?.label ?? metric} · 일자별 집계`;
  const groupRows = aggregate(
    brandRows.map((row) => ({
      ...row,
      brandGroup: `${brandDeviceTag(row)} · ${row.group || row.campaign || "브랜드 검색"}`,
    })),
    "brandGroup"
  ).slice(0, 8);
  const groupBasisEl = document.querySelector("#brandGroupBasis");
  if (groupBasisEl) groupBasisEl.textContent = `기준: ${metricMeta[metric]?.basis ?? metric} · 그룹별 집계`;
  renderBarChart(document.querySelector("#brandGroupChart"), groupRows, metric, {
    horizontal: true,
    height: 300,
    width: 600,
    leftPadding: 210,
    firstLineLimit: 18,
    secondLineLimit: 20,
  });
  renderBrandDetailTable(brandRows);
  // 소재 갤러리 (비동기 로드 후 렌더)
  loadCreatives().then((creatives) => renderCreativeGallery(brandRows, creatives));
}

function renderAll() {
  const rows = filteredRecords();
  const activeScopeLabels = [];
  if (state.homeMedia !== "all") activeScopeLabels.push(homeMediaOptions[state.homeMedia]?.label ?? "");
  if (state.homePromotion !== "all") activeScopeLabels.push(state.homePromotion);
  const activeScopeLabel = activeScopeLabels.length ? ` · ${activeScopeLabels.join(" · ")}` : "";
  document.querySelector("#sourceDate").textContent = `${state.range.dateStart || "-"} ~ ${state.range.dateEnd || "-"}${activeScopeLabel}`;
  document.querySelector("#rowCount").textContent = `${formatNumber(rows.length)}개 집계 / 원본 ${formatNumber(state.data.rowCount)}행`;
  if (state.currentView === "home") {
    renderKpis(rows);
    renderHomeWidgets(rows);
    renderChartsForHome(rows);
  } else if (["daily", "weekly", "monthly"].includes(state.currentView)) {
    renderPeriodReport(state.currentView, rows);
  } else if (state.currentView === "media") {
    renderCharts(rows);
  } else if (state.currentView === "promotion") {
    renderPromoFilterBar();
    renderCharts(rows);
  } else if (state.currentView === "keyword") {
    renderKeywordReport(filteredKeywordRecords());
  } else if (state.currentView === "brand") {
    renderBrandView(rows);
  }
  renderFilterChips();
}

function setView(view) {
  state.currentView = view;
  document.querySelectorAll(".side-nav-button[data-view]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.view === view);
  });
  document.querySelectorAll(".view-section").forEach((section) => {
    section.classList.toggle("is-active", section.dataset.viewPanel === view);
  });
  const [title, description] = viewMeta[view] ?? viewMeta.home;
  const activeScopeLabels = [];
  if (state.homeMedia !== "all") activeScopeLabels.push(homeMediaOptions[state.homeMedia]?.label ?? "");
  if (state.homePromotion !== "all") activeScopeLabels.push(state.homePromotion);
  const activeScopeLabel = activeScopeLabels.length ? ` - ${activeScopeLabels.join(" / ")}` : "";
  document.querySelector("#viewTitle").textContent = `${title}${activeScopeLabel}`;
  document.querySelector("#viewDescription").textContent = description;
  syncHomeMediaControls();
  syncHomePromotionControls();
}

function bindControls() {
  populateMetricControls();
  populateFilter("#drawerMediaFilter", "media", "매체");
  populateFilter("#promotionFilter", "promotion", "프로모션");
  populateFilter("#objectiveFilter", "objective", "목적");
  populateFilter("#targetFilter", "target", "타겟");
  renderMediaQuickFilter();
  populateRangeControls();
  populatePromotionDetailSelect();
  setupPromotionModal();
  populateWeekSelects();
  bindPromoFilter();
  bindCreativeGallery();

  document.querySelectorAll("[data-primary-metric-select]").forEach((select) => {
    select.addEventListener("change", (event) => {
      state.metric = event.target.value;
      syncMetricControls();
      renderAll();
    });
  });

  document.querySelector("#secondaryMetricSelect")?.addEventListener("change", (event) => {
    state.secondaryMetric = event.target.value || null;
    syncMetricControls();
    renderAll();
  });

  document.querySelectorAll(".metric-button").forEach((button) => {
    button.addEventListener("click", () => {
      state.metric = button.dataset.metric;
      syncMetricControls();
      renderAll();
    });
  });

  document.querySelectorAll(".efficiency-button").forEach((button) => {
    button.addEventListener("click", () => {
      const metric = button.dataset.secondaryMetric;
      state.secondaryMetric = state.secondaryMetric === metric ? null : metric;
      syncMetricControls();
      renderAll();
    });
  });

  document.querySelector("#brandMetricSelect")?.addEventListener("change", (e) => {
    state.brandMetric = e.target.value;
    renderAll();
  });

  // 드로어 이벤트
  const anomalyToggle = document.querySelector("#toggleAnomalyBtn");
  if (anomalyToggle) anomalyToggle.checked = state.showAnomalyMarkers;
  document.querySelector("#openFilterDrawer").addEventListener("click", openFilterDrawer);
  document.querySelector("#closeFilterDrawer").addEventListener("click", closeFilterDrawer);
  document.querySelector("#filterDrawerOverlay").addEventListener("click", closeFilterDrawer);
  document.querySelector("#applyFiltersBtn").addEventListener("click", applyFilterDrawer);
  document.querySelector("#resetFiltersBtn").addEventListener("click", resetFilterDrawer);
  document.querySelector("#exportCsvBtn").addEventListener("click", exportCsv);

  document.querySelector("#mediaQuickFilter")?.addEventListener("click", (event) => {
    const button = event.target.closest(".media-quick-btn");
    if (!button) return;
    state.homeMedia = button.dataset.homeMedia || "all";
    clearDrawerMediaFilter();
    syncHomeMediaControls();
    renderAll();
  });

  document.querySelector("#toggleAnomalyBtn")?.addEventListener("change", (e) => {
    state.showAnomalyMarkers = e.target.checked;
    renderAll();
  });

  for (const [id, key] of [
    ["#drawerMediaFilter", "media"],
    ["#promotionFilter", "promotion"],
    ["#objectiveFilter", "objective"],
    ["#targetFilter", "target"],
  ]) {
    document.querySelector(id).addEventListener("change", (event) => {
      pendingFilters[key] = event.target.value;
      updateFilterSelectDisplay(event.target);
    });
  }

  document.querySelector("#campaignSearch")?.addEventListener("input", (event) => {
    state.campaignQuery = event.target.value;
    renderAll();
  });

  document.querySelector("#creativeSearch")?.addEventListener("input", (event) => {
    state.creativeQuery = event.target.value;
    renderAll();
  });

  document.querySelector("#promotionDetailSelect")?.addEventListener("change", (event) => {
    state.promotionDetail = event.target.value;
    renderAll();
  });

  document.querySelector("#keywordSearch").addEventListener("input", (event) => {
    state.keywordQuery = event.target.value;
    renderAll();
  });

  for (const id of ["#weekASelect", "#weekBSelect"]) {
    document.querySelector(id)?.addEventListener("change", () => renderAll());
  }

  document.querySelectorAll(".side-nav-button[data-view]").forEach((button) => {
    button.addEventListener("click", () => {
      setView(button.dataset.view);
      renderAll();
    });
  });

  document.querySelectorAll(".summary-media-button").forEach((button) => {
    button.addEventListener("click", () => {
      state.homeMedia = button.dataset.homeMedia;
      setView("home");
      syncHomeMediaControls();
      renderAll();
    });
  });

  for (const [id, key] of [
    ["#dateStart", "dateStart"],
    ["#dateEnd", "dateEnd"],
  ]) {
    document.querySelector(id)?.addEventListener("change", (event) => {
      state.pendingRange[key] = event.target.value;
      renderDatePicker();
    });
  }

  document.querySelector("#dateRangeTrigger")?.addEventListener("click", (event) => {
    event.stopPropagation();
    const panel = document.querySelector("#datePickerPanel");
    if (panel?.classList.contains("is-open")) closeDatePicker();
    else openDatePicker();
  });

  document.querySelector("#datePickerPanel")?.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  document.querySelector("#datePickerMonths")?.addEventListener("click", (event) => {
    const nav = event.target.closest("[data-calendar-nav]");
    if (nav) {
      shiftDatePickerMonth(Number(nav.dataset.calendarNav || 0));
      return;
    }
    const day = event.target.closest("[data-date]");
    if (!day || day.disabled) return;
    const value = day.dataset.date;
    if (datePickerSelecting === "start" || !state.pendingRange.dateStart || state.pendingRange.dateEnd) {
      setPendingDateRange(value, "");
      datePickerSelecting = "end";
      state.activePreset = null;
    } else {
      setPendingDateRange(state.pendingRange.dateStart, value);
      datePickerSelecting = "start";
      state.activePreset = null;
    }
  });

  document.querySelector("#applyDateRange")?.addEventListener("click", applyPendingDateRange);
  document.querySelector("#datePickerReset")?.addEventListener("click", () => setDatePickerPreset("all"));

  document.querySelectorAll(".preset-button").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".preset-button").forEach((b) => b.classList.remove("is-active"));
      button.classList.add("is-active");
      setDatePickerPreset(button.dataset.preset);
    });
  });

  document.addEventListener("click", (event) => {
    const panel = document.querySelector("#datePickerPanel");
    if (!panel?.classList.contains("is-open")) return;
    if (event.target.closest(".date-picker-shell")) return;
    closeDatePicker();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeDatePicker();
  });
}

function bindTooltip() {
  const tooltip = document.createElement("div");
  tooltip.className = "dashboard-tooltip";
  document.body.appendChild(tooltip);

  const move = (event) => {
    const target = event.target.closest?.("[data-tooltip]");
    if (!target) {
      tooltip.classList.remove("is-visible");
      return;
    }

    tooltip.innerHTML = escapeHtml(target.dataset.tooltip).replace(/&#10;|\n/g, "<br>");
    const offset = 14;
    const maxX = window.innerWidth - tooltip.offsetWidth - 16;
    const maxY = window.innerHeight - tooltip.offsetHeight - 16;
    tooltip.style.left = `${Math.min(event.clientX + offset, Math.max(16, maxX))}px`;
    tooltip.style.top = `${Math.min(event.clientY + offset, Math.max(16, maxY))}px`;
    tooltip.classList.add("is-visible");
  };

  document.addEventListener("mousemove", move);
  document.addEventListener("mouseleave", () => tooltip.classList.remove("is-visible"));
}

function syncMetricControls() {
  document.querySelectorAll("[data-primary-metric-select]").forEach((select) => {
    select.value = state.metric;
  });
  const secondaryMetricSelect = document.querySelector("#secondaryMetricSelect");
  if (secondaryMetricSelect) secondaryMetricSelect.value = state.secondaryMetric || "";
  document.querySelectorAll(".metric-button").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.metric === state.metric);
  });
  document.querySelectorAll(".efficiency-button").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.secondaryMetric === state.secondaryMetric);
  });
}

function syncHomeMediaControls() {
  document.querySelectorAll(".summary-media-button").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.homeMedia === state.homeMedia);
  });
  document.querySelectorAll(".media-quick-btn").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.homeMedia === state.homeMedia);
  });
}

function syncHomePromotionControls() {
  const badge = document.querySelector("#promotionSelectBadge");
  if (badge) {
    if (state.homePromotion !== "all") {
      badge.textContent = truncate(state.homePromotion, 14);
      badge.style.display = "";
    } else {
      badge.textContent = "";
      badge.style.display = "none";
    }
  }
  document.querySelectorAll(".promotion-modal-item").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.promotion === state.homePromotion);
  });
  const allBtn = document.querySelector(".promotion-modal-all");
  if (allBtn) allBtn.classList.toggle("is-active", state.homePromotion === "all");
}

async function init() {
  if (window.DASHBOARD_DATA) {
    state.data = window.DASHBOARD_DATA;
  } else {
    const response = await fetch("./data/dashboard-data.json");
    state.data = await response.json();
  }

  state.promotionIndex = buildPromotionIndex();

  bindControls();
  updatePresetLabels();
  bindTooltip();
  syncMetricControls();
  syncHomeMediaControls();
  syncHomePromotionControls();
  renderAll();
}

init().catch((error) => {
  document.body.innerHTML = `<main class="error"><h1>대시보드를 불러오지 못했습니다.</h1><pre>${escapeHtml(error.message)}</pre></main>`;
});
