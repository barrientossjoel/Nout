'use client'

import React, { useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Maximize2, X, Minimize2 } from 'lucide-react'
import { cn } from '../../lib/utils/utils'

export interface ImageFullscreenButtonProps {
    onClick: (e: React.MouseEvent) => void
    className?: string
}

/**
 * Floating button that appears at the bottom-right corner of an image on hover.
 */
export function ImageFullscreenButton({ onClick, className }: ImageFullscreenButtonProps) {
    return (
        <button
            type="button"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
                e.stopPropagation()
                onClick(e)
            }}
            className={cn(
                "absolute bottom-2.5 right-2.5 z-20 h-9 w-9 flex items-center justify-center rounded-xl",
                "bg-black/60 hover:bg-black/85 backdrop-blur-md text-white/90 hover:text-white",
                "border border-white/10 shadow-lg opacity-0 group-hover:opacity-100 group-focus-within:opacity-100",
                "transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer pointer-events-auto",
                className
            )}
            title="Ampliar a pantalla completa"
            aria-label="Ampliar a pantalla completa"
        >
            <Maximize2 className="h-4 w-4" />
        </button>
    )
}

export interface ImageFullscreenModalProps {
    src: string
    alt?: string
    onClose: () => void
}

/**
 * Fullscreen lightbox modal for viewing images in maximum size.
 * Can be closed via:
 * 1. Close button (top right)
 * 2. Escape key
 * 3. Clicking outside the image on the backdrop
 */
export function ImageFullscreenModal({ src, alt, onClose }: ImageFullscreenModalProps) {
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (e.key === 'Escape') {
            e.stopPropagation()
            onClose()
        }
    }, [onClose])

    useEffect(() => {
        const prevOverflow = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        window.addEventListener('keydown', handleKeyDown)

        return () => {
            document.body.style.overflow = prevOverflow
            window.removeEventListener('keydown', handleKeyDown)
        }
    }, [handleKeyDown])

    if (typeof document === 'undefined') return null

    return createPortal(
        <div
            role="dialog"
            aria-modal="true"
            aria-label={alt || "Vista ampliada de la imagen"}
            className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-4 md:p-8 animate-in fade-in duration-200 select-none cursor-zoom-out"
            onClick={onClose}
        >
            {/* Top action controls */}
            <div className="absolute top-4 right-4 z-50 flex items-center gap-2 pointer-events-auto">
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation()
                        onClose()
                    }}
                    className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-md border border-white/10 transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-lg"
                    title="Salir de pantalla completa (Esc)"
                    aria-label="Salir de pantalla completa"
                >
                    <Minimize2 className="h-5 w-5" />
                </button>
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation()
                        onClose()
                    }}
                    className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-md border border-white/10 transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-lg"
                    title="Cerrar (Esc)"
                    aria-label="Cerrar"
                >
                    <X className="h-5 w-5" />
                </button>
            </div>

            {/* Centered Image Container */}
            <div
                className="relative max-w-[95vw] max-h-[90vh] flex flex-col items-center justify-center cursor-default pointer-events-auto"
                onClick={(e) => e.stopPropagation()}
            >
                <img
                    src={src}
                    alt={alt || "Fullscreen view"}
                    className="max-w-[95vw] max-h-[90vh] object-contain rounded-xl shadow-2xl animate-in zoom-in-95 duration-200"
                    draggable={false}
                />
                {alt && (
                    <div className="mt-3 px-3.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-white/85 text-xs truncate max-w-[80vw] border border-white/10 shadow-sm">
                        {alt}
                    </div>
                )}
            </div>
        </div>,
        document.body
    )
}
