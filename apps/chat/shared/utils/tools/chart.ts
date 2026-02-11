import { tool } from 'ai'
import { z } from 'zod'
import type { UIToolInvocation } from 'ai'

export type ChartUIToolInvocation = UIToolInvocation<typeof chartTool>

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

/**
 * Fill in missing dates with zero values for all series keys.
 * Uses startDate/endDate when provided. If not provided and there are fewer
 * than 3 data points, defaults to a 30-day range ending today.
 */
function fillDateGaps(options: {
  data: Record<string, string | number>[]
  xKey: string
  seriesKeys: string[]
  startDate?: string
  endDate?: string
}): Record<string, string | number>[] {
  const { data, xKey, seriesKeys, startDate, endDate } = options
  if (data.length === 0) return data

  // Check if xKey values look like dates
  const allDates = data.every(d => DATE_REGEX.test(String(d[xKey])))
  if (!allDates) return data

  // Build a map of existing data by date
  const dataMap = new Map<string, Record<string, string | number>>()
  for (const point of data) {
    dataMap.set(String(point[xKey]), point)
  }

  const dates = data.map(d => String(d[xKey])).sort()

  // Determine range: explicit params > data range (if enough points) > 30-day fallback
  let end: Date
  if (endDate && DATE_REGEX.test(endDate)) {
    end = new Date(endDate)
  } else if (data.length >= 3) {
    end = new Date(dates[dates.length - 1]!)
  } else {
    end = new Date() // today
  }

  let start: Date
  if (startDate && DATE_REGEX.test(startDate)) {
    start = new Date(startDate)
  } else if (data.length >= 3) {
    start = new Date(dates[0]!)
  } else {
    // Default to 30 days before end
    start = new Date(end)
    start.setDate(start.getDate() - 29)
  }

  // Generate all dates in range and fill gaps with zeros
  const filled: Record<string, string | number>[] = []
  const current = new Date(start)

  while (current <= end) {
    const dateStr = current.toISOString().split('T')[0]!
    const existing = dataMap.get(dateStr)

    if (existing) {
      filled.push(existing)
    } else {
      const zeroPoint: Record<string, string | number> = { [xKey]: dateStr }
      for (const key of seriesKeys) {
        zeroPoint[key] = 0
      }
      filled.push(zeroPoint)
    }

    current.setDate(current.getDate() + 1)
  }

  return filled
}

export const chartTool = tool({
  description: 'Create a line chart visualization with one or multiple data series. Use this tool to display time-series data, trends, or comparisons between different metrics over time. Missing dates between startDate and endDate are automatically filled with zeros.',
  inputSchema: z.object({
    title: z.string().optional().describe('Title of the chart'),
    data: z.array(z.record(z.string(), z.union([z.string(), z.number()]))).min(1).describe('REQUIRED: Array of data points (minimum 1 point). Each object must contain the xKey property and all series keys'),
    xKey: z.string().describe('The property name in data objects to use for x-axis values (e.g., "month", "date")'),
    series: z.array(z.object({
      key: z.string().describe('The property name in data objects for this series (must exist in all data points)'),
      name: z.string().describe('Display name for this series in the legend'),
      color: z.string().describe('Hex color code for this line (e.g., "#3b82f6" for blue, "#10b981" for green)')
    })).min(1).describe('Array of series configurations (minimum 1 series). Each series represents one line on the chart'),
    xLabel: z.string().optional().describe('Optional label for x-axis'),
    yLabel: z.string().optional().describe('Optional label for y-axis'),
    startDate: z.string().optional().describe('Start date of the chart range (YYYY-MM-DD). When provided with date-based xKey, all dates from startDate to endDate will be filled with zeros if missing. ALWAYS provide this for time-series charts.'),
    endDate: z.string().optional().describe('End date of the chart range (YYYY-MM-DD). Defaults to today if not provided. ALWAYS provide this for time-series charts.'),
  }),
  execute: async ({ title, data, xKey, series, xLabel, yLabel, startDate, endDate }) => {
    await new Promise(resolve => setTimeout(resolve, 1500))

    const seriesKeys = series.map(s => s.key)
    const filledData = fillDateGaps({ data, xKey, seriesKeys, startDate, endDate })

    return {
      title,
      data: filledData,
      xKey,
      series,
      xLabel,
      yLabel
    }
  }
})
