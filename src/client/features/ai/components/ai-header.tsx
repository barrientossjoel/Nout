import React from 'react'
import { Button } from "../../../components/ui/button"
import { Sparkles, Trash2, PanelLeftClose, PanelRightClose } from "lucide-react"
import type { ModelProvider, ApiUsageData, UsageRecord } from "../types/ai-types"
import { GEMINI_DAILY_TOKEN_LIMIT } from "../utils/ai-tracker"

interface AiHeaderProps {
    provider: ModelProvider
    onSelectProvider: (p: ModelProvider) => void
    usageData: ApiUsageData
    onClearChat: () => void
    showSidebar?: boolean
    onToggleSidebar?: () => void
}

const MODEL_OPTIONS: { id: ModelProvider; name: string; free: boolean }[] = [
    { id: 'gemini', name: 'Google Gemini', free: true },
    { id: 'ollama', name: 'Ollama Local', free: true },
    { id: 'openai', name: 'ChatGPT (OpenAI)', free: false },
    { id: 'claude', name: 'Claude (Anthropic)', free: false },
]

const BADGE_RENDERERS: Record<ModelProvider, (rec: UsageRecord) => React.ReactNode> = {
    gemini: (rec) => {
        const remainingTokens = Math.max(0, GEMINI_DAILY_TOKEN_LIMIT - rec.totalTokens)
        const remainingPct = Math.round((remainingTokens / GEMINI_DAILY_TOKEN_LIMIT) * 100)
        return (
            <span className="text-[10px] font-mono text-muted-foreground bg-muted/60 px-2 py-0.5 rounded border border-border/50 hidden md:inline-flex items-center gap-1.5" title={`Usado hoy: ${rec.totalTokens} tokens (${rec.requests} peticiones)`}>
                <span className="text-foreground font-medium">Uso hoy: {rec.totalTokens.toLocaleString()} tok</span>
                <span className="text-muted-foreground/60">•</span>
                <span className="text-emerald-500 font-semibold">Quedan: {remainingTokens.toLocaleString()} ({remainingPct}%)</span>
            </span>
        )
    },
    openai: (rec) => (
        <span className="text-[10px] font-mono text-muted-foreground bg-muted/60 px-2 py-0.5 rounded border border-border/50 hidden md:inline-flex items-center gap-1.5">
            <span>Usado: {rec.totalTokens.toLocaleString()} tok</span>
            <span className="text-muted-foreground/60">•</span>
            <span className="text-blue-400">Gasto est: ${rec.estimatedCostUsd.toFixed(4)} USD</span>
        </span>
    ),
    ollama: (rec) => (
        <span className="text-[10px] font-mono text-muted-foreground bg-muted/60 px-2 py-0.5 rounded border border-border/50 hidden md:inline">
            Usado hoy: {rec.totalTokens.toLocaleString()} tok (100% Local / $0)
        </span>
    ),
    claude: () => (
        <span className="text-[10px] font-mono text-muted-foreground bg-muted/60 px-2 py-0.5 rounded border border-border/50 hidden md:inline">
            Pay-as-you-go
        </span>
    )
}

export const AiHeader: React.FC<AiHeaderProps> = ({
    provider,
    onSelectProvider,
    usageData,
    onClearChat,
    showSidebar,
    onToggleSidebar
}) => {
    return (
        <div className="h-11 border-b border-border flex items-center justify-between px-3 shrink-0 bg-muted/20 gap-2">
            <div className="flex items-center gap-2">
                {onToggleSidebar && (
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={onToggleSidebar}
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                    >
                        {showSidebar ? <PanelLeftClose className="h-4 w-4" /> : <PanelRightClose className="h-4 w-4" />}
                    </Button>
                )}
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="font-semibold text-xs hidden sm:inline">AI Agents</span>

                <select
                    value={provider}
                    onChange={(e) => onSelectProvider(e.target.value as ModelProvider)}
                    className="bg-background border border-border/60 rounded-md text-[11px] px-2 py-1 font-medium focus:outline-none focus:ring-1 focus:ring-primary/40 text-foreground cursor-pointer"
                >
                    {MODEL_OPTIONS.map(m => (
                        <option key={m.id} value={m.id}>
                            {m.name} {m.free ? '(Gratis)' : ''}
                        </option>
                    ))}
                </select>

                {BADGE_RENDERERS[provider](usageData[provider] || { totalTokens: 0, requests: 0, estimatedCostUsd: 0, date: '', promptTokens: 0, completionTokens: 0 })}
            </div>

            <div className="flex items-center gap-1">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onClearChat}
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    title="Limpiar conversación"
                >
                    <Trash2 className="h-3.5 w-3.5" />
                </Button>
            </div>
        </div>
    )
}
