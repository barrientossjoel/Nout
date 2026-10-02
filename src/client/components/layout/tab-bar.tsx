'use client'

import React from 'react'
import { X, FileText, LayoutDashboard, Calendar, Trash2, Frame, Copy, Plus, Network, Bot } from 'lucide-react'
import { cn } from '../../lib/utils/utils'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { Button } from '../ui/button'
import type { Document } from '../../../core/types/notes'

interface TabBarProps {
    paneId: string
    tabs: string[]
    activeTabId: string | null
    previewTabId?: string | null
    documents: Document[]
    onSelectTab: (id: string) => void
    onPinTab?: (id: string) => void
    onCloseTab: (id: string) => void
    onMoveTab: (tabId: string, sourcePaneId: string, targetPaneId: string, index?: number) => void
}

export function TabBar({ paneId, tabs, activeTabId, previewTabId, documents, onSelectTab, onPinTab, onCloseTab, onMoveTab }: TabBarProps) {
    const handleDragStart = (e: React.DragEvent, tabId: string) => {
        e.dataTransfer.setData('tabId', tabId)
        e.dataTransfer.setData('sourcePaneId', paneId)
        e.dataTransfer.effectAllowed = 'move'
    }

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
    }

    const handleDrop = (e: React.DragEvent, targetIndex?: number) => {
        e.preventDefault()
        const tabId = e.dataTransfer.getData('tabId')
        const sourcePaneId = e.dataTransfer.getData('sourcePaneId')

        if (tabId) {
            onMoveTab(tabId, sourcePaneId, paneId, targetIndex)
        }
    }

    const isMobile = useMediaQuery('(max-width: 768px)')

    if (isMobile) {
        return null;
    }

    // Deduplicate tabs to prevent React key collision warnings and rendering issues
    const uniqueTabs = Array.from(new Set(tabs))

    return (
        <div
            className="flex items-center bg-background border-b overflow-x-auto no-scrollbar min-h-[36px]"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e)}
        >
            {uniqueTabs.map((tabId, index) => {
                const doc = documents.find(d => d.id === tabId)
                const isActive = tabId === activeTabId

                const SYSTEM_TABS: Record<string, { title: string, icon: React.ElementType }> = {
                    'dashboard': { title: 'Dashboard', icon: LayoutDashboard },
                    'calendar': { title: 'Calendar', icon: Calendar },
                    'trash': { title: 'Trash', icon: Trash2 },
                    'graph': { title: 'Graph', icon: Network },
                    'ai': { title: 'AI Assistant', icon: Bot },
                }

                const systemTab = SYSTEM_TABS[tabId]
                const title = systemTab ? systemTab.title : (doc?.title || "Untitled")
                const Icon = systemTab ? systemTab.icon : (doc?.type === 'canvas' ? Frame : FileText)

                return (
                    <div
                        key={tabId}
                        draggable="true"
                        onDragStart={(e) => handleDragStart(e, tabId)}
                        onDragOver={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                        }}
                        onDrop={(e) => {
                            e.stopPropagation()
                            handleDrop(e, index)
                        }}
                        onDoubleClick={(e) => {
                            e.stopPropagation()
                            onPinTab?.(tabId)
                        }}
                        className={cn(
                            "group flex items-center gap-2 px-2 py-1.5 text-xs max-w-[180px] border-r border-border cursor-pointer select-none transition-colors min-w-[100px] relative",
                            isActive ? "bg-muted/30 font-medium border-b-[1.5px] border-b-muted-foreground/40" : "bg-muted/10 font-normal hover:bg-muted/20",
                            tabId === previewTabId && "italic"
                        )}
                        onClick={(e) => {
                            e.stopPropagation()
                            onSelectTab(tabId)
                        }}
                        onMouseDown={(e) => {
                            if (e.button === 1) { // Middle click
                                e.preventDefault()
                                e.stopPropagation()
                                onCloseTab(tabId)
                            }
                        }}
                    >
                        <Icon className="h-3 w-3 text-muted-foreground shrink-0" />
                        <span className="truncate flex-1">{title}</span>
                        <button
                            className={cn(
                                "opacity-0 group-hover:opacity-100 hover:bg-muted-foreground/20 rounded p-0.5 transition-all outline-none",
                                isActive && "opacity-100"
                            )}
                            onClick={(e) => {
                                e.stopPropagation()
                                onCloseTab(tabId)
                            }}
                        >
                            <X className="h-3 w-3" />
                        </button>
                    </div>
                )
            })}
        </div>
    )
}
