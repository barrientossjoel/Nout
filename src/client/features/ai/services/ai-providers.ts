import type { ModelProvider, ApiUsageData } from '../types/ai-types'
import { trackUsage } from '../utils/ai-tracker'

export interface ProviderCallParams {
    userMsgText: string
    contextStr: string
    geminiKey: string | null
    openAiKey: string | null
}

export interface ProviderResponse {
    text: string
    usageData: ApiUsageData
}

export type AiProviderHandler = (params: ProviderCallParams) => Promise<ProviderResponse>

export const AI_PROVIDERS: Record<ModelProvider, AiProviderHandler> = {
    gemini: async ({ userMsgText, contextStr, geminiKey }) => {
        if (!geminiKey) throw new Error('Falta tu clave API de Google Gemini en Ajustes.')
        const fullPrompt = contextStr ? `Contexto:\n${contextStr}\n\nPregunta: ${userMsgText}` : userMsgText
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: fullPrompt }] }] })
        })
        if (!res.ok) {
            const err = await res.json().catch(() => ({}))
            throw new Error(err.error?.message || `Error Gemini API (${res.status})`)
        }
        const data = await res.json()
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "Sin respuesta recibida de Gemini."
        const pTokens = data.usageMetadata?.promptTokenCount || Math.ceil(fullPrompt.length / 4)
        const cTokens = data.usageMetadata?.candidatesTokenCount || Math.ceil(text.length / 4)
        return { text, usageData: trackUsage('gemini', pTokens, cTokens) }
    },

    openai: async ({ userMsgText, contextStr, openAiKey }) => {
        if (!openAiKey) throw new Error('Falta tu clave API de OpenAI en Ajustes.')
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${openAiKey}`
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: 'Eres un asistente de notas profesional.' },
                    { role: 'user', content: contextStr ? `Contexto:\n${contextStr}\n\nPregunta: ${userMsgText}` : userMsgText }
                ]
            })
        })
        if (!res.ok) throw new Error(`Error OpenAI API (${res.status})`)
        const data = await res.json()
        const text = data.choices?.[0]?.message?.content || "Sin respuesta recibida de OpenAI."
        const pTokens = data.usage?.prompt_tokens || Math.ceil(userMsgText.length / 4)
        const cTokens = data.usage?.completion_tokens || Math.ceil(text.length / 4)
        return { text, usageData: trackUsage('openai', pTokens, cTokens) }
    },

    ollama: async ({ userMsgText, contextStr }) => {
        try {
            const res = await fetch('http://localhost:11434/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'llama3',
                    prompt: contextStr ? `Contexto:\n${contextStr}\n\nPregunta: ${userMsgText}` : userMsgText,
                    stream: false
                })
            })
            if (!res.ok) throw new Error("No se pudo conectar con Ollama en http://localhost:11434.")
            const data = await res.json()
            const text = data.response || "Respuesta recibida de Ollama."
            const pTokens = Math.ceil(userMsgText.length / 4)
            const cTokens = data.eval_count || Math.ceil(text.length / 4)
            return { text, usageData: trackUsage('ollama', pTokens, cTokens) }
        } catch {
            throw new Error("Ollama local no está respondiendo en http://localhost:11434. Asegúrate de ejecutar 'ollama serve'.")
        }
    },

    claude: async () => {
        throw new Error('El proveedor Claude requiere configuración de API Key.')
    }
}
