import type { ApiUsageData, UsageRecord, ModelProvider } from '../types/ai-types'

const STORAGE_KEY = 'nout_ai_usage_v2'
export const GEMINI_DAILY_TOKEN_LIMIT = 1500000
export const GEMINI_DAILY_REQ_LIMIT = 1500

const getTodayString = (): string => new Date().toISOString().split('T')[0]

const createEmptyRecord = (date: string): UsageRecord => ({
    date,
    requests: 0,
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    estimatedCostUsd: 0
})

const COST_CALCULATORS: Record<ModelProvider, (p: number, c: number) => number> = {
    openai: (p, c) => (p * 0.15 + c * 0.60) / 1_000_000,
    gemini: () => 0,
    ollama: () => 0,
    claude: () => 0
}

export function loadUsageData(): ApiUsageData {
    const today = getTodayString()
    const defaultData: ApiUsageData = {
        gemini: createEmptyRecord(today),
        openai: createEmptyRecord(today),
        ollama: createEmptyRecord(today),
        claude: createEmptyRecord(today)
    }

    if (typeof window === 'undefined') return defaultData

    try {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (!stored) return defaultData
        const parsed = JSON.parse(stored) as ApiUsageData
        return parsed.gemini?.date === today ? parsed : defaultData
    } catch {
        return defaultData
    }
}

export function saveUsageData(data: ApiUsageData): void {
    if (typeof window === 'undefined') return
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch (e) {
        console.error('Error saving AI usage data', e)
    }
}

export function trackUsage(
    provider: ModelProvider,
    promptTokens: number,
    completionTokens: number
): ApiUsageData {
    const data = loadUsageData()
    const record = data[provider] ?? createEmptyRecord(getTodayString())

    record.requests += 1
    record.promptTokens += promptTokens
    record.completionTokens += completionTokens
    record.totalTokens += promptTokens + completionTokens
    record.estimatedCostUsd += COST_CALCULATORS[provider](promptTokens, completionTokens)

    data[provider] = record
    saveUsageData(data)
    return data
}
