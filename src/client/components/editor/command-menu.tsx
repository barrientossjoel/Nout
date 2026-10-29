'use client'

import { useEffect, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { FileText, Heading1, Heading2, Heading3, List, ListOrdered, CheckSquare, Quote, Code, Image as ImageIcon, Music, Pencil } from 'lucide-react'
import { cn } from '../../lib/utils/utils'
import type { Document } from '../../../core/types/notes'

interface CommandMenuProps {
    isOpen: boolean
    position: { top: number; left: number }
    query: string
    type: 'slash' | 'mention'
    documents: Document[]
    onSelect: (value: string, type: 'slash' | 'mention') => void
    onClose: () => void
}

export function CommandMenu({ isOpen, position, query, type, documents, onSelect, onClose }: CommandMenuProps) {
    const [selectedIndex, setSelectedIndex] = useState(0)
    const [adjustedPosition, setAdjustedPosition] = useState(position)
    const menuRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!isOpen || !menuRef.current) return

        const menuRect = menuRef.current.getBoundingClientRect()
        const viewportHeight = window.innerHeight
        const viewportWidth = window.innerWidth

        let newTop = position.top
        let newLeft = position.left

        // Vertical adjustment (Flip if no space below)
        if (newTop + menuRect.height > viewportHeight) {
            newTop = position.top - menuRect.height - 24 // 24 is line height approx
        }

        // Horizontal adjustment (Keep within bounds)
        if (newLeft + menuRect.width > viewportWidth) {
            newLeft = viewportWidth - menuRect.width - 10
        }
        if (newLeft < 10) {
            newLeft = 10
        }

        setAdjustedPosition({ top: newTop, left: newLeft })
    }, [isOpen, position])

    const slashCommands = [
        { label: 'Heading 1', value: '# ', icon: Heading1 },
        { label: 'Heading 2', value: '## ', icon: Heading2 },
        { label: 'Heading 3', value: '### ', icon: Heading3 },
        { label: 'Bullet List', value: '- ', icon: List },
        { label: 'Numbered List', value: '1. ', icon: ListOrdered },
        { label: 'Check List', value: '- [ ] ', icon: CheckSquare },
        { label: 'Quote', value: '> ', icon: Quote },
        { label: 'Code Block', value: '```\n\n```', icon: Code },
        { label: 'Image', value: 'image', icon: ImageIcon },
        { label: 'Drawing', value: 'drawing', icon: Pencil },
        { label: 'Audio', value: 'audio', icon: Music },
        { label: 'Table', value: 'table', icon: FileText },
    ]


    const items = type === 'slash'
        ? slashCommands.filter(item => item.label.toLowerCase().includes(query.toLowerCase()))
        : documents
            .filter(doc => doc.title.toLowerCase().includes(query.toLowerCase()))
            .map(doc => ({ label: doc.title, value: `[${doc.title}](${doc.id})`, icon: FileText }))

    useEffect(() => {
        setSelectedIndex(0)
    }, [query, type])

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen) return

            if (e.key === 'ArrowDown') {
                e.preventDefault()
                setSelectedIndex(prev => (prev + 1) % items.length)
            } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setSelectedIndex(prev => (prev - 1 + items.length) % items.length)
            } else if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault()
                if (items[selectedIndex]) {
                    onSelect(items[selectedIndex].value, type)
                }
            } else if (e.key === 'Escape') {
                e.preventDefault()
                onClose()
            }
        }

        document.addEventListener('keydown', handleKeyDown)
        return () => document.removeEventListener('keydown', handleKeyDown)
    }, [isOpen, items, selectedIndex, onSelect, type, onClose])

    if (!isOpen) return null
    if (items.length === 0) return null

    return createPortal(
        <div
            ref={menuRef}
            className="fixed z-[9999] w-64 bg-[#1e1e1e]/95 backdrop-blur-xl text-popover-foreground shadow-2xl border border-white/10 rounded-md overflow-hidden"
            style={{ top: adjustedPosition.top, left: adjustedPosition.left }}
        >
            <div className="p-1">
                {items.map((item, index) => (
                    <div
                        key={item.label + index}
                        className={cn(
                            "flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm cursor-pointer select-none",
                            index === selectedIndex ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"
                        )}
                        onClick={() => onSelect(item.value, type)}
                    >
                        <item.icon className="h-4 w-4 opacity-70" />
                        <span>{item.label}</span>
                    </div>
                ))}
            </div>
        </div>,
        document.body
    )
}
