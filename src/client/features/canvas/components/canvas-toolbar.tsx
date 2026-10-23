'use client'

import React from 'react'
import {
    MousePointer2, ArrowRight, Pencil, Eraser, Type, Table, Image, FileText, Square, Circle, Trash2
} from 'lucide-react'
import { cn } from '../../../lib/utils/utils'
import { Button } from '../../../components/ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "../../../components/ui/dropdown-menu"

interface CanvasToolbarProps {
    isMobile: boolean
    activeTool: 'select' | 'pencil' | 'eraser' | 'arrow' | 'shape-rectangle' | 'shape-circle'
    setActiveTool: (tool: 'select' | 'pencil' | 'eraser' | 'arrow' | 'shape-rectangle' | 'shape-circle') => void
    pencilColor: string
    setPencilColor: (color: string) => void
    pencilWidth: number
    setPencilWidth: (width: number) => void
    selectionSize: number
    onAddNote: () => void
    onAddTable: () => void
    onAddShape: (shape: 'rectangle' | 'circle') => void
    onInitiateAddImage: () => void
    onImportDocument: () => void
    onDeleteSelection: () => void
}

const PENCIL_COLORS = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#000000']

export function CanvasToolbar({
    isMobile,
    activeTool,
    setActiveTool,
    pencilColor,
    setPencilColor,
    pencilWidth,
    setPencilWidth,
    selectionSize,
    onAddNote,
    onAddTable,
    onAddShape,
    onInitiateAddImage,
    onImportDocument,
    onDeleteSelection,
}: CanvasToolbarProps) {
    const isArrow = activeTool === 'arrow'
    const isPencil = activeTool === 'pencil'
    const isEraser = activeTool === 'eraser'

    const containerClasses = isMobile
        ? "fixed bottom-4 left-1/2 -translate-x-1/2 flex flex-row items-center gap-1 px-2.5 py-1.5 bg-card/95 backdrop-blur-md border border-border/80 shadow-2xl z-50 rounded-2xl max-w-[96vw] overflow-x-auto no-scrollbar pointer-events-auto"
        : "flex gap-1 p-1 bg-secondary shadow-lg items-center flex-row rounded-full px-2 h-12 pointer-events-auto"

    const dividerClasses = isMobile
        ? "h-6 w-px bg-border/40 mx-1 shrink-0"
        : "h-8 w-px bg-border/20 mx-1"

    const dropdownSide = 'top'
    const dropdownAlign = 'center'

    const pencilDropdown = (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className={cn("h-9 w-9 rounded-full hover:bg-background/50", isPencil && "bg-primary/20 text-primary")}
                    title="Pencil Tool"
                >
                    <Pencil className="h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
                align={dropdownAlign}
                side={dropdownSide}
                className={cn(
                    "rounded-xl p-3 bg-secondary shadow-lg border-none w-48",
                    isMobile ? "ml-2" : "mb-2"
                )}
            >
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium">Color</span>
                        <div className="flex gap-1">
                            {PENCIL_COLORS.map(c => (
                                <button
                                    key={c}
                                    className={cn(
                                        "w-4 h-4 rounded-full border border-white/20",
                                        pencilColor === c && "ring-2 ring-primary ring-offset-1 ring-offset-secondary"
                                    )}
                                    style={{ backgroundColor: c }}
                                    onClick={() => {
                                        setPencilColor(c)
                                        setActiveTool('pencil')
                                    }}
                                />
                            ))}
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium">Thickness</span>
                            <span className="text-[10px] text-muted-foreground">{pencilWidth}px</span>
                        </div>
                        <input
                            type="range"
                            min="1"
                            max="20"
                            value={pencilWidth}
                            onChange={(e) => {
                                setPencilWidth(parseInt(e.target.value))
                                setActiveTool('pencil')
                            }}
                            className="w-full h-1.5 bg-background rounded-lg appearance-none cursor-pointer accent-primary"
                        />
                    </div>
                    <Button
                        className={cn("w-full h-8 text-xs rounded-lg", isPencil ? "bg-primary" : "bg-muted")}
                        onClick={() => setActiveTool(isPencil ? 'select' : 'pencil')}
                    >
                        {isPencil ? 'Drawing Active' : 'Activate Pencil'}
                    </Button>
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    )

    const shapeDropdown = (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full hover:bg-background/50" title="Add Shape">
                    <Square className="h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
                align={dropdownAlign}
                side={dropdownSide}
                className={cn(
                    "rounded-xl p-1 bg-secondary shadow-lg border-none",
                    isMobile ? "ml-2" : "mb-2"
                )}
            >
                <DropdownMenuItem onClick={() => onAddShape('rectangle')} className="rounded-lg gap-2 cursor-pointer focus:bg-background/50">
                    <Square className="h-4 w-4" /><span>Rectangle</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onAddShape('circle')} className="rounded-lg gap-2 cursor-pointer focus:bg-background/50">
                    <Circle className="h-4 w-4" /><span>Circle</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )

    const mainContent = (
        <>
            <Button
                variant="ghost"
                size="icon"
                className={cn("h-9 w-9 rounded-full", activeTool === 'select' ? "bg-primary/20 text-primary" : "opacity-50")}
                onClick={() => setActiveTool('select')}
                title="Select Tool"
            >
                <MousePointer2 className="h-4 w-4" />
            </Button>

            <Button
                variant="ghost"
                size="icon"
                className={cn("h-9 w-9 rounded-full hover:bg-background/50", isArrow && "bg-primary/20 text-primary")}
                onClick={() => setActiveTool(isArrow ? 'select' : 'arrow')}
                title="Add Arrow"
            >
                <ArrowRight className="h-4 w-4" />
            </Button>

            {pencilDropdown}

            <Button
                variant="ghost"
                size="icon"
                className={cn("h-9 w-9 rounded-full hover:bg-background/50", isEraser && "bg-primary/20 text-primary")}
                onClick={() => setActiveTool(isEraser ? 'select' : 'eraser')}
                title="Eraser Tool"
            >
                <Eraser className="h-4 w-4" />
            </Button>

            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full hover:bg-background/50" onClick={onAddNote} title="Add Text Note">
                <Type className="h-4 w-4" />
            </Button>

            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full hover:bg-background/50" onClick={onAddTable} title="Add Table">
                <Table className="h-4 w-4" />
            </Button>

            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full hover:bg-background/50" onClick={onInitiateAddImage} title="Add Image">
                <Image className="h-4 w-4" />
            </Button>

            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full hover:bg-background/50" onClick={onImportDocument} title="Import Document">
                <FileText className="h-4 w-4" />
            </Button>

            {shapeDropdown}

            <div className={dividerClasses} />

            <Button
                variant="ghost"
                size="icon"
                className={cn("h-9 w-9 rounded-full hover:bg-background/50 hover:text-destructive", selectionSize === 0 && "opacity-50 pointer-events-none")}
                onClick={onDeleteSelection}
                title="Delete Selection"
            >
                <Trash2 className="h-4 w-4" />
            </Button>
        </>
    )

    if (isMobile) {
        return (
            <div className={containerClasses}>
                {mainContent}
            </div>
        )
    }

    return (
        <div className="absolute bottom-6 inset-x-0 flex justify-center pointer-events-none z-50">
            <div className="pr-40 pointer-events-none flex justify-center">
                <div className={containerClasses}>
                    {mainContent}
                </div>
            </div>
        </div>
    )
}
