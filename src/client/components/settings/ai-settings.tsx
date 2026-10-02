'use client'

import React, { useEffect, useState } from 'react'
import { Button } from "../../components/ui/button"
import { Input } from "../../components/ui/input"
import { useLanguage } from "../../context/LanguageContext"
import { Brain, Key, Eye, EyeOff, Save, Trash2, Database, AlertCircle } from "lucide-react"

import { loadUsageData, GEMINI_DAILY_TOKEN_LIMIT, GEMINI_DAILY_REQ_LIMIT } from "../../features/ai/utils/ai-tracker"

export function AiSettings() {
    const { t } = useLanguage()
    
    // Fallback translations if they don't exist yet
    const _t = (key: string, fallback: string) => {
        const res = t(key as any)
        return (res && res !== key) ? res : fallback
    }

    const [openAiKey, setOpenAiKey] = useState('')
    const [geminiKey, setGeminiKey] = useState('')
    const [showOpenAi, setShowOpenAi] = useState(false)
    const [showGemini, setShowGemini] = useState(false)
    const [saved, setSaved] = useState(false)
    const [usageData, setUsageData] = useState(() => loadUsageData())

    useEffect(() => {
        // Load keys and usage from localStorage on mount
        const storedOpenAi = localStorage.getItem('nout_openai_key')
        const storedGemini = localStorage.getItem('nout_gemini_key')
        if (storedOpenAi) setOpenAiKey(storedOpenAi)
        if (storedGemini) setGeminiKey(storedGemini)
        setUsageData(loadUsageData())
    }, [])

    const handleSave = () => {
        openAiKey.trim() ? localStorage.setItem('nout_openai_key', openAiKey.trim()) : localStorage.removeItem('nout_openai_key')
        geminiKey.trim() ? localStorage.setItem('nout_gemini_key', geminiKey.trim()) : localStorage.removeItem('nout_gemini_key')
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
    }

    const clearKeys = () => {
        setOpenAiKey('')
        setGeminiKey('')
        localStorage.removeItem('nout_openai_key')
        localStorage.removeItem('nout_gemini_key')
    }

    const geminiRec = usageData.gemini || { totalTokens: 0, requests: 0 }
    const geminiRem = Math.max(0, GEMINI_DAILY_TOKEN_LIMIT - geminiRec.totalTokens)
    const geminiPct = Math.min(100, Math.round((geminiRec.totalTokens / GEMINI_DAILY_TOKEN_LIMIT) * 100))

    const openAiRec = usageData.openai || { totalTokens: 0, estimatedCostUsd: 0 }

    return (
        <div className="space-y-[clamp(1.5rem,4vw,2.5rem)] animate-in fade-in duration-300">
            <div>
                <h3 className="text-[clamp(1.125rem,2.5vw,1.25rem)] font-medium text-foreground mb-[clamp(0.75rem,2vw,1rem)] flex items-center gap-2">
                    <Brain className="h-5 w-5 text-primary" />
                    {_t('aiAgentConfiguration', 'Configuración de Agentes IA')}
                </h3>
                <p className="text-[13px] text-muted-foreground mb-4">
                    {_t('aiAgentDesc', 'Configura tus claves de API para la IA. Se guardan localmente en tu navegador para máxima privacidad.')}
                </p>

                <div className="rounded-lg border border-border overflow-hidden bg-card divide-y divide-border">
                    {/* Gemini Key */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between p-[clamp(1rem,2vw,1.25rem)] gap-4">
                        <div className="flex flex-col min-w-0 sm:w-1/3">
                            <span className="text-[clamp(13px,1.5vw,14px)] font-medium text-foreground flex items-center gap-2">
                                <Key className="h-4 w-4" /> Google Gemini API
                            </span>
                            <span className="text-[clamp(11px,1.2vw,12px)] text-muted-foreground mt-1">
                                {_t('geminiDesc', 'Para chat y generación rápida. Capa gratuita disponible.')}
                            </span>
                        </div>
                        <div className="flex-1 flex items-center gap-2 relative">
                            <Input 
                                type={showGemini ? "text" : "password"} 
                                value={geminiKey}
                                onChange={(e) => setGeminiKey(e.target.value)}
                                placeholder="AIzaSy..." 
                                className="flex-1 bg-background/50 font-mono text-xs pr-10"
                            />
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                className="absolute right-1 h-7 w-7 text-muted-foreground hover:text-foreground"
                                onClick={() => setShowGemini(!showGemini)}
                            >
                                {showGemini ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                        </div>
                    </div>

                    {/* OpenAI Key */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between p-[clamp(1rem,2vw,1.25rem)] gap-4">
                        <div className="flex flex-col min-w-0 sm:w-1/3">
                            <span className="text-[clamp(13px,1.5vw,14px)] font-medium text-foreground flex items-center gap-2">
                                <Key className="h-4 w-4" /> OpenAI API Key
                            </span>
                            <span className="text-[clamp(11px,1.2vw,12px)] text-muted-foreground mt-1">
                                {_t('openAiDesc', 'Para modelos de ChatGPT. Cobro según uso.')}
                            </span>
                        </div>
                        <div className="flex-1 flex items-center gap-2 relative">
                            <Input 
                                type={showOpenAi ? "text" : "password"} 
                                value={openAiKey}
                                onChange={(e) => setOpenAiKey(e.target.value)}
                                placeholder="sk-..." 
                                className="flex-1 bg-background/50 font-mono text-xs pr-10"
                            />
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                className="absolute right-1 h-7 w-7 text-muted-foreground hover:text-foreground"
                                onClick={() => setShowOpenAi(!showOpenAi)}
                            >
                                {showOpenAi ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                        </div>
                    </div>
                </div>

                <div className="mt-4 flex items-center justify-between">
                    <Button variant="ghost" size="sm" onClick={clearKeys} className="text-destructive hover:bg-destructive/10 hover:text-destructive">
                        <Trash2 className="h-4 w-4 mr-2" />
                        {_t('clearKeys', 'Borrar Claves')}
                    </Button>
                    <Button variant="default" size="sm" onClick={handleSave}>
                        {saved ? <Save className="h-4 w-4 mr-2" /> : null}
                        {saved ? _t('saved', '¡Guardado!') : _t('saveChanges', 'Guardar Cambios')}
                    </Button>
                </div>
            </div>

            <div>
                <h3 className="text-[clamp(1.125rem,2.5vw,1.25rem)] font-medium text-foreground mb-[clamp(0.75rem,2vw,1rem)] flex items-center gap-2">
                    <Database className="h-5 w-5 text-primary" />
                    {_t('ragSettings', 'Seguimiento de Uso y Consumo de hoy')}
                </h3>

                <div className="rounded-lg border border-border p-4 bg-muted/20 space-y-4">
                    {/* Gemini Live Usage Progress */}
                    <div className="p-3 bg-background/60 rounded-md border border-border/50 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-emerald-500">Google Gemini (Gratis)</span>
                            <span className="font-mono text-[11px] text-muted-foreground">
                                Usado: <strong>{geminiRec.totalTokens.toLocaleString()}</strong> / {GEMINI_DAILY_TOKEN_LIMIT.toLocaleString()} tokens ({geminiPct}%)
                            </span>
                        </div>
                        {/* Progress Bar */}
                        <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                            <div 
                                className="h-full bg-emerald-500 transition-all duration-300" 
                                style={{ width: `${geminiPct}%` }}
                            />
                        </div>
                        <div className="flex justify-between text-[11px] font-mono text-muted-foreground">
                            <span>Peticiones hoy: {geminiRec.requests} / {GEMINI_DAILY_REQ_LIMIT}</span>
                            <span className="text-emerald-400 font-semibold">Quedan: {geminiRem.toLocaleString()} tokens ({100 - geminiPct}%)</span>
                        </div>
                    </div>

                    {/* OpenAI Usage Box */}
                    <div className="p-3 bg-background/60 rounded-md border border-border/50 space-y-1">
                        <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-blue-500">OpenAI (ChatGPT)</span>
                            <span className="font-mono text-[11px] text-blue-400 font-semibold">
                                Gasto est: ${openAiRec.estimatedCostUsd.toFixed(4)} USD
                            </span>
                        </div>
                        <p className="text-[11px] font-mono text-muted-foreground">
                            Tokens consumidos hoy: {openAiRec.totalTokens.toLocaleString()}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
