export type ModelProvider = 'gemini' | 'openai' | 'claude' | 'ollama'

export interface Message {
    id: string
    role: 'user' | 'assistant' | 'system'
    content: string
    timestamp: Date
    sources?: string[]
}

export interface ModelOption {
    id: ModelProvider
    name: string
    free: boolean
}

export interface UsageRecord {
    date: string // YYYY-MM-DD
    requests: number
    promptTokens: number
    completionTokens: number
    totalTokens: number
    estimatedCostUsd: number
}

export interface ApiUsageData {
    gemini: UsageRecord
    openai: UsageRecord
    ollama: UsageRecord
    claude: UsageRecord
}
