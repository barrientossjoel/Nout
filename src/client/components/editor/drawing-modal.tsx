'use client'

import React, { useRef, useState, useEffect } from 'react'
import { Pencil, Eraser, Undo2, Trash2, Check } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog'
import { Button } from '../ui/button'
import { cn } from '../../lib/utils/utils'
import { triggerHaptic } from '../../lib/utils/haptics'

type DrawingTool = 'pen' | 'eraser'

interface DrawingModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onInsert: (dataUrl: string) => void
}

const COLORS = [
  '#000000',
  '#ffffff',
  '#3b82f6',
  '#ef4444',
  '#22c55e',
  '#f59e0b',
  '#8b5cf6',
] as const

const STROKE_WIDTHS = [
  { label: 'Fino', value: 2 },
  { label: 'Medio', value: 5 },
  { label: 'Grueso', value: 10 },
] as const

const TOOL_CONFIG: Record<DrawingTool, (color: string) => { stroke: string; composite: GlobalCompositeOperation }> = {
  pen: (color) => ({ stroke: color, composite: 'source-over' }),
  eraser: () => ({ stroke: 'rgba(0,0,0,1)', composite: 'destination-out' }),
}

export function DrawingModal({ open, onOpenChange, onInsert }: DrawingModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [tool, setTool] = useState<DrawingTool>('pen')
  const [color, setColor] = useState<string>('#3b82f6')
  const [strokeWidth, setStrokeWidth] = useState<number>(5)
  const isDrawingRef = useRef(false)
  const historyRef = useRef<ImageData[]>([])

  const withCanvas = (action: (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => void) => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d', { willReadFrequently: true })
    ctx && canvas && action(ctx, canvas)
  }

  const getCanvasPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    return rect ? { x: e.clientX - rect.left, y: e.clientY - rect.top } : { x: 0, y: 0 }
  }

  useEffect(() => {
    open && withCanvas((ctx, canvas) => {
      const rect = canvas.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
      ctx.scale(dpr, dpr)
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      historyRef.current = [ctx.getImageData(0, 0, canvas.width, canvas.height)]
    })
  }, [open])

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    withCanvas((ctx, canvas) => {
      canvas.setPointerCapture(e.pointerId)
      isDrawingRef.current = true
      const { x, y } = getCanvasPos(e)
      const { stroke, composite } = TOOL_CONFIG[tool](color)

      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.strokeStyle = stroke
      ctx.lineWidth = strokeWidth
      ctx.globalCompositeOperation = composite
    })
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    isDrawingRef.current && withCanvas((ctx) => {
      const { x, y } = getCanvasPos(e)
      ctx.lineTo(x, y)
      ctx.stroke()
    })
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    isDrawingRef.current && withCanvas((ctx, canvas) => {
      isDrawingRef.current = false
      ctx.closePath()
      historyRef.current = [...historyRef.current.slice(-19), ctx.getImageData(0, 0, canvas.width, canvas.height)]
    })
  }

  const handleUndo = () => {
    historyRef.current.length > 1 && withCanvas((ctx) => {
      triggerHaptic('light')
      historyRef.current.pop()
      const prev = historyRef.current[historyRef.current.length - 1]
      prev && ctx.putImageData(prev, 0, 0)
    })
  }

  const handleClear = () => {
    withCanvas((ctx, canvas) => {
      triggerHaptic('light')
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      historyRef.current = [ctx.getImageData(0, 0, canvas.width, canvas.height)]
    })
  }

  const handleSave = () => {
    withCanvas((_, canvas) => {
      triggerHaptic('selection')
      onInsert(canvas.toDataURL('image/png'))
      onOpenChange(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[clamp(320px,94vw,650px)] max-h-[90vh] p-4 flex flex-col rounded-2xl border border-border shadow-2xl bg-card">
        <DialogHeader className="flex flex-row items-center justify-between pb-2 border-b border-border/50">
          <DialogTitle className="text-base font-semibold">Dibujo a mano alzada</DialogTitle>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleUndo}
              className="h-8 px-2 gap-1 text-xs"
              title="Deshacer"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleClear}
              className="h-8 px-2 gap-1 text-xs text-destructive hover:text-destructive"
              title="Borrar todo"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </DialogHeader>

        {/* Drawing canvas area */}
        <div className="flex-1 w-full min-h-[300px] h-[45vh] rounded-xl border border-border/70 bg-background/50 overflow-hidden relative touch-none select-none my-2 cursor-crosshair">
          <canvas
            ref={canvasRef}
            className="w-full h-full block"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          />
        </div>

        {/* Toolbar: tools, colors, stroke sizes */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/50">
          {/* Tool mode */}
          <div className="flex items-center gap-1 bg-secondary/60 p-0.5 rounded-lg">
            {(['pen', 'eraser'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => { triggerHaptic('selection'); setTool(t); }}
                className={cn(
                  "p-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1",
                  tool === t ? "bg-card text-foreground shadow-xs font-semibold" : "text-muted-foreground"
                )}
              >
                {t === 'pen' ? <Pencil className="w-3.5 h-3.5" /> : <Eraser className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">{t === 'pen' ? 'Lápiz' : 'Borrador'}</span>
              </button>
            ))}
          </div>

          {/* Color palette */}
          {tool === 'pen' && (
            <div className="flex items-center gap-1.5">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => { triggerHaptic('selection'); setColor(c); }}
                  className={cn(
                    "w-5 h-5 rounded-full border border-black/20 dark:border-white/20 transition-transform active:scale-90",
                    color === c && "ring-2 ring-primary ring-offset-2 ring-offset-card scale-110"
                  )}
                  style={{ backgroundColor: c }}
                  aria-label={`Color ${c}`}
                />
              ))}
            </div>
          )}

          {/* Stroke Width */}
          <div className="flex items-center gap-1 bg-secondary/60 p-0.5 rounded-lg">
            {STROKE_WIDTHS.map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() => { triggerHaptic('selection'); setStrokeWidth(s.value); }}
                className={cn(
                  "px-2 py-1 rounded-md text-[11px] font-medium transition-all",
                  strokeWidth === s.value ? "bg-card text-foreground shadow-xs font-semibold" : "text-muted-foreground"
                )}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Save / Cancel buttons */}
          <div className="flex items-center gap-2 ml-auto">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs h-8"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              className="text-xs h-8 gap-1 bg-primary text-primary-foreground shadow-xs"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Insertar</span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
