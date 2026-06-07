/** 观测日记热力图：单日格子 */
export interface ObservationDiaryDay {
  date: string
  count: number
  level: number
  /** 未来日期，不参与统计展示 */
  future: boolean
}

/** 观测日记热力图：按周列 */
export interface ObservationDiaryWeek {
  week_index: number
  days: ObservationDiaryDay[]
}

/** 月份标签（对齐到周列） */
export interface ObservationDiaryMonthLabel {
  label: string
  week_index: number
}

export interface ObservationDiary {
  weeks: ObservationDiaryWeek[]
  month_labels: ObservationDiaryMonthLabel[]
  weekday_labels: string[]
  total_records: number
  active_days: number
  max_daily_count: number
}

/** 展示的自然月数量（含当前月） */
export const DIARY_MONTHS_TO_SHOW = 6
/** 单列宽度：格子 20rpx + 间距 6rpx */
export const DIARY_WEEK_COL_WIDTH = 26
export const DIARY_WEEKDAY_COL_WIDTH = 36

const WEEKDAY_LABELS = ['', '一', '', '三', '', '五', '']

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

function parseDateKey(key: string): Date {
  const parts = key.split('-').map(Number)
  return new Date(parts[0], parts[1] - 1, parts[2])
}

function startOfWeekSunday(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - d.getDay())
  return d
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function countLevel(count: number, maxCount: number): number {
  if (count <= 0) return 0
  if (maxCount <= 1) return 1
  const ratio = count / maxCount
  if (ratio <= 0.25) return 1
  if (ratio <= 0.5) return 2
  if (ratio <= 0.75) return 3
  return 4
}

function buildMonthLabels(weeks: ObservationDiaryWeek[]): ObservationDiaryMonthLabel[] {
  const labels: ObservationDiaryMonthLabel[] = []
  let lastMonth = -1

  weeks.forEach((week) => {
    const firstValidDay = week.days.find((day) => !day.future)
    if (!firstValidDay) return

    const month = parseDateKey(firstValidDay.date).getMonth()
    if (month === lastMonth) return

    lastMonth = month
    labels.push({
      label: `${month + 1}月`,
      week_index: week.week_index,
    })
  })

  return labels
}

function countWeeksBetween(start: Date, end: Date): number {
  const msPerWeek = 7 * 24 * 60 * 60 * 1000
  return Math.floor((end.getTime() - start.getTime()) / msPerWeek) + 1
}

/** 根据提交时间列表生成近 6 个月（含当前月）的观测日记热力图 */
export function buildObservationDiary(submittedAtList: string[]): ObservationDiary {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const rangeMonthStart = startOfMonth(today)
  rangeMonthStart.setMonth(rangeMonthStart.getMonth() - (DIARY_MONTHS_TO_SHOW - 1))

  const countByDate = new Map<string, number>()
  let totalRecords = 0
  const activeDaySet = new Set<string>()

  submittedAtList.forEach((iso) => {
    if (!iso) return
    const date = new Date(iso)
    if (Number.isNaN(date.getTime())) return

    const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    if (dayStart.getTime() < rangeMonthStart.getTime() || dayStart.getTime() > today.getTime()) {
      return
    }

    const key = toDateKey(dayStart)
    countByDate.set(key, (countByDate.get(key) || 0) + 1)
    activeDaySet.add(key)
    totalRecords += 1
  })

  let maxDailyCount = 0
  countByDate.forEach((count) => {
    if (count > maxDailyCount) maxDailyCount = count
  })

  const gridStart = startOfWeekSunday(rangeMonthStart)
  const endWeekStart = startOfWeekSunday(today)
  const weekCount = countWeeksBetween(gridStart, endWeekStart)

  const weeks: ObservationDiaryWeek[] = []

  for (let weekIndex = 0; weekIndex < weekCount; weekIndex += 1) {
    const days: ObservationDiaryDay[] = []

    for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
      const cellDate = new Date(gridStart)
      cellDate.setDate(gridStart.getDate() + weekIndex * 7 + dayIndex)
      const future = cellDate.getTime() > today.getTime()
      const beforeRange = cellDate.getTime() < rangeMonthStart.getTime()
      const date = toDateKey(cellDate)
      const count = future || beforeRange ? 0 : countByDate.get(date) || 0

      days.push({
        date,
        count,
        level: future || beforeRange ? 0 : countLevel(count, maxDailyCount),
        future: future || beforeRange,
      })
    }

    weeks.push({ week_index: weekIndex, days })
  }

  return {
    weeks,
    month_labels: buildMonthLabels(weeks),
    weekday_labels: WEEKDAY_LABELS,
    total_records: totalRecords,
    active_days: activeDaySet.size,
    max_daily_count: maxDailyCount,
  }
}

export function formatDiaryDateLabel(dateKey: string): string {
  const parts = dateKey.split('-')
  if (parts.length !== 3) return dateKey
  return `${Number(parts[1])}月${Number(parts[2])}日`
}

export function getDiaryChartWidth(weekCount: number): number {
  return DIARY_WEEKDAY_COL_WIDTH + weekCount * DIARY_WEEK_COL_WIDTH
}

export function getDiaryScrollIntoViewId(weekCount: number): string {
  if (weekCount <= 0) return ''
  return `diary-week-${weekCount - 1}`
}
