import { useState, useRef, useEffect } from 'react'
import type { Message, ModelProvider, ApiUsageData } from '../types/ai-types'
import { loadUsageData } from '../utils/ai-tracker'
import { AI_PROVIDERS } from '../services/ai-providers'
import type { Document as NoteDocument } from '../../../../core/types/notes'

export function useAiAgent(documents: NoteDocument[]) {
    const [provider, setProvider] = useState<ModelProvider>('gemini')
    const [usageData, setUsageData] = useState<ApiUsageData>(loadUsageData)
    const [messages, setMessages] = useState<Message[]>([
        {
            id: '1',
            role: 'assistant',
            content: '¡Hola! Soy tu **AI Agent**. ¿En qué puedo ayudarte hoy?',
            timestamp: new Date()
        }
    ])
    const [input, setInput] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [copiedId, setCopiedId] = useState<string | null>(null)
    const scrollEndRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages, isLoading])

    const handleSend = async () => {
        if (!input.trim() || isLoading) return

        const userMsgText = input.trim()
        setInput('')

        const relevantDocs = documents.slice(0, 5)
        const sources = relevantDocs.map(d => d.title)

        const userMsg: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: userMsgText,
            timestamp: new Date(),
            sources: sources.length > 0 ? sources : undefined
        }

        setMessages(prev => [...prev, userMsg])
        setIsLoading(true)

        try {
            const contextStr = relevantDocs.map(d => `[Documento: ${d.title}]\n${d.content || ''}`).join('\n\n')
            const handler = AI_PROVIDERS[provider]
            
            const { text, usageData: updatedUsage } = await handler({
                userMsgText,
                contextStr,
                geminiKey: localStorage.getItem('nout_gemini_key'),
                openAiKey: localStorage.getItem('nout_openai_key')
            })

            setUsageData(updatedUsage)
            setMessages(prev => [...prev, {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: text,
                timestamp: new Date()
            }])
        } catch (err: any) {
            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: 'assistant',
                content: `Error: ${err.message || 'No se pudo conectar con el proveedor.'}`,
                timestamp: new Date()
            }])
        } finally {
            setIsLoading(false)
        }
    }

    const copyToClipboard = (text: string, id: string) => {
        navigator.clipboard.writeText(text)
        setCopiedId(id)
        setTimeout(() => setCopiedId(null), 2000)
    }

    const clearChat = () => {
        setMessages([{
            id: Date.now().toString(),
            role: 'assistant',
            content: 'Chat reiniciado. ¿En qué te puedo ayudar ahora?',
            timestamp: new Date()
        }])
    }

    return {
        provider,
        setProvider,
        usageData,
        messages,
        input,
        setInput,
        isLoading,
        copiedId,
        scrollEndRef,
        handleSend,
        copyToClipboard,
        clearChat
    }
}
