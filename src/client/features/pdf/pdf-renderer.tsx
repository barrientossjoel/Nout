'use client'

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react'
import * as pdfjs from 'pdfjs-dist'
import 'pdfjs-dist/web/pdf_viewer.css'
import { Button } from '../../components/ui/button'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Loader2, AlertCircle, Highlighter } from 'lucide-react'
import { cn } from '../../lib/utils/utils'

// PDF.js worker setup
const pdfWorkerUrl = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
).toString()
pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

// ─── Module-level caches (persist for the lifetime of the browser tab) ────────

/** Parsed PDF documents, keyed by URL. Capped to avoid unbounded memory growth. */
const MAX_DOC_CACHE_SIZE = 10
const pdfDocCache = new Map<string, pdfjs.PDFDocumentProxy>()

function setCachedDoc(url: string, doc: pdfjs.PDFDocumentProxy) {
    if (pdfDocCache.size >= MAX_DOC_CACHE_SIZE) {
        const oldest = pdfDocCache.keys().next().value
        if (oldest !== undefined) pdfDocCache.delete(oldest)
    }
    pdfDocCache.set(url, doc)
}

/** Maximum ImageBitmap entries per document before FIFO eviction. */
const MAX_BITMAP_CACHE_SIZE = 50

interface CachedPage {
    bitmap: ImageBitmap
    width: number
    height: number
    cssWidth: number
    cssHeight: number
}

/**
 * Rendered pixel output per page, keyed by PDFDocumentProxy.
 * WeakMap so entries are eligible for GC when the document leaves pdfDocCache.
 * Inner key: `${pageNumber}:${scale.toFixed(2)}:${invert ? 1 : 0}`
 */
const pageRenderCache = new WeakMap<pdfjs.PDFDocumentProxy, Map<string, CachedPage>>()

function getPageCache(pdf: pdfjs.PDFDocumentProxy): Map<string, CachedPage> {
    if (!pageRenderCache.has(pdf)) pageRenderCache.set(pdf, new Map())
    return pageRenderCache.get(pdf)!
}

function setCachedPage(cache: Map<string, CachedPage>, key: string, page: CachedPage) {
    if (cache.size >= MAX_BITMAP_CACHE_SIZE) {
        const oldestKey = cache.keys().next().value
        if (oldestKey !== undefined) {
            cache.get(oldestKey)?.bitmap.close() // Release GPU texture
            cache.delete(oldestKey)
        }
    }
    cache.set(key, page)
}

/**
 * Exact pixel heights per page, keyed by PDFDocumentProxy.
 * Inner key: `${scale.toFixed(2)}:${pageNumber}` (scale-aware).
 * Only numbers — trivial memory, no eviction needed.
 */
const pageHeightCache = new WeakMap<pdfjs.PDFDocumentProxy, Map<string, number>>()

function getHeightCache(pdf: pdfjs.PDFDocumentProxy): Map<string, number> {
    if (!pageHeightCache.has(pdf)) pageHeightCache.set(pdf, new Map())
    return pageHeightCache.get(pdf)!
}

/**
 * Pre-fetches viewport dimensions for ALL pages via PDF.js metadata — no rendering.
 * Yields every 10 pages so it doesn't starve the visible page render queue.
 */
async function prewarmPageHeights(
    pdf: pdfjs.PDFDocumentProxy,
    hCache: Map<string, number>,
    scaleKey: string,
    renderScale: number,
    alive: { current: boolean }
) {
    for (let i = 1; i <= pdf.numPages; i++) {
        if (!alive.current) return
        const key = `${scaleKey}:${i}`
        if (!hCache.has(key)) {
            try {
                const page = await pdf.getPage(i)
                const viewport = page.getViewport({ scale: renderScale })
                if (alive.current) hCache.set(key, viewport.height)
            } catch { /* ignore individual page errors */ }
        }
        if (i % 10 === 0) await new Promise<void>(r => setTimeout(r, 0))
    }
}

/**
 * Passed to the virtualizer instance to disable its ResizeObserver-driven scroll
 * position adjustment. By default, when an item is measured and its actual size
 * differs from the estimate, TanStack Virtual adjusts scrollTop to compensate.
 * For a PDF viewer this causes backward drift on remount because unvisited pages
 * above the viewport have estimates that are slightly larger than actual, creating
 * a negative cumulative delta. Disabling adjustment avoids this; the prewarm
 * ensures estimates are accurate enough that adjustment is not needed anyway.
 */
const noScrollAdjust = () => false

// ─── PdfRenderer ────────────────────────────────────────────────────────────

import { updateDocument } from '../../actions/actions'

interface PdfRendererProps {
    documentId: string
    url: string
    invertColors: boolean
    scale: number
    scrollPosition?: string | null
    onAddHighlight?: (text: string, page: number) => void
    onPdfInit?: (pdf: pdfjs.PDFDocumentProxy) => void
}

const SCROLL_KEY = (url: string) => `pdf-scroll:${url}`

export const PdfRenderer = forwardRef<any, PdfRendererProps>(({ documentId, url, invertColors, scale, scrollPosition, onAddHighlight, onPdfInit }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null)
    const [selection, setSelection] = useState<{ text: string, page: number, rect: DOMRect } | null>(null)

    // Read saved scroll offset ONCE at component init.
    // Prioritize server-side scrollPosition, fall back to localStorage.
    const savedScrollOffset = useRef<{ top: number, left: number }>((function () {
        if (scrollPosition) {
            try {
                const parsed = JSON.parse(scrollPosition)
                if (typeof parsed === 'object' && parsed !== null) return parsed
            } catch (e) { }
        }
        const saved = localStorage.getItem(SCROLL_KEY(url))
        if (saved && saved.startsWith('{')) {
            try { return JSON.parse(saved) } catch (e) { }
        }
        return { top: parseFloat(saved ?? '0'), left: 0 }
    })())

    // Initialize pdf synchronously from cache to avoid an extra render cycle on remount.
    const [pdf, setPdf] = useState<pdfjs.PDFDocumentProxy | null>(
        () => pdfDocCache.get(url) ?? null
    )
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(() => !pdfDocCache.has(url))
    // Ensures we only restore scroll once per mount even if pdf/loading flips multiple times.
    const scrollRestored = useRef(false)

    useEffect(() => {
        if (pdf) return // Already cached

        let active = true
        setError(null)
        setLoading(true)

        const load = async () => {
            try {
                const doc = await pdfjs.getDocument(url).promise
                if (!active) return
                setCachedDoc(url, doc)
                setPdf(doc)
                setLoading(false)
                if (onPdfInit) onPdfInit(doc)
            } catch (err: any) {
                if (!active) return
                console.error('Error loading PDF:', err)
                setError(err.message || 'Failed to load PDF')
                setLoading(false)
            }
        }

        load()
        return () => { active = false }
    }, [url])

    // ── Virtualizer ──────────────────────────────────────────────────────────
    const heightCache = pdf ? getHeightCache(pdf) : null
    const scaleKey = scale.toFixed(2)

    const rowVirtualizer = useVirtualizer({
        count: pdf ? pdf.numPages : 0,
        getScrollElement: () => containerRef.current,
        estimateSize: (index) => {
            // Use exact height from prewarm/render cache, falling back to any known
            // page height (most PDFs have uniform sizes) or a safe default.
            const exact = heightCache?.get(`${scaleKey}:${index + 1}`)
            if (exact) return exact
            const anyKnown = heightCache?.values().next().value
            return anyKnown ?? 1200 * scale
        },
        overscan: 2,
        // Pre-positions the virtualizer so the correct pages are rendered on mount.
        initialOffset: savedScrollOffset.current.top,
    })

    useImperativeHandle(ref, () => ({
        scrollToPage: (pageNumber: number) => {
            if (!containerRef.current || !rowVirtualizer) return
            rowVirtualizer.scrollToIndex(pageNumber - 1, { align: 'start' })
        }
    }))

        // Disable TanStack Virtual's default ResizeObserver scroll compensation.
        // See `noScrollAdjust` comment above for full explanation.
        ; (rowVirtualizer as any).shouldAdjustScrollPositionOnItemSizeChange = noScrollAdjust

    // Background prewarm: fetch all page heights via getViewport (no rendering).
    // Cancelled on unmount; heights persist in the module-level WeakMap cache.
    useEffect(() => {
        if (!pdf) return
        const alive = { current: true }
        prewarmPageHeights(pdf, getHeightCache(pdf), scaleKey, scale * 1.5, alive)
        return () => { alive.current = false }
    }, [pdf, scale])

    // Auto-focus so keyboard scrolling works immediately
    useEffect(() => {
        if (!loading && !error) containerRef.current?.focus()
    }, [loading, error])

    // Restore scroll position once the PDF is fully loaded and the container is
    // scrollable. We use setTimeout over rAF because React StrictMode's effect
    // double-invoke cancels rAFs via cleanup before they run. The cleanup resets
    // scrollRestored so the second StrictMode invocation still applies the scroll.
    useEffect(() => {
        if (loading || !pdf || scrollRestored.current) return

        const { top, left } = savedScrollOffset.current
        if (!top && !left) { scrollRestored.current = true; return }

        scrollRestored.current = true

        // 50ms is enough for the virtualizer to commit its total-size element.
        // We capture containerRef (not .current) so the timeout reads the
        // latest DOM node even if it swaps between now and when it fires.
        const timer = setTimeout(() => {
            const el = containerRef.current
            if (!el) return
            if (top) el.scrollTop = top
            if (left) el.scrollLeft = left
        }, 50)

        return () => {
            clearTimeout(timer)
            // Reset so StrictMode's second invocation (or genuine re-mount) can retry
            scrollRestored.current = false
        }
    }, [loading, pdf])

    // Detect text selection
    const handleMouseUp = useCallback(() => {
        const sel = window.getSelection()
        if (!sel || sel.isCollapsed || !containerRef.current) {
            setSelection(null)
            return
        }

        const text = sel.toString().trim()
        if (!text) {
            setSelection(null)
            return
        }

        // Find which page the selection is in
        let node: Node | null = sel.anchorNode
        let pageNumber = 0
        while (node && node !== containerRef.current) {
            if (node instanceof HTMLElement && node.dataset.pageNumber) {
                pageNumber = parseInt(node.dataset.pageNumber)
                break
            }
            node = node.parentNode
        }

        if (pageNumber) {
            const range = sel.getRangeAt(0)
            const rects = range.getClientRects()
            if (rects.length > 0) {
                // Use the first rect to position the button
                const rect = rects[0]
                setSelection({ text, page: pageNumber, rect: rect })
            }
        }
    }, [])

    useEffect(() => {
        document.addEventListener('mouseup', handleMouseUp)
        return () => document.removeEventListener('mouseup', handleMouseUp)
    }, [handleMouseUp])

    // ── Scroll persistence ───────────────────────────────────────────────────
    // Debounced during active scrolling; synchronous on unmount (panel move).
    const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

    const saveScrollPos = useCallback(() => {
        if (containerRef.current) {
            const pos = {
                top: containerRef.current.scrollTop,
                left: containerRef.current.scrollLeft
            }
            const posString = JSON.stringify(pos)
            localStorage.setItem(SCROLL_KEY(url), posString)

            // Sync to server
            updateDocument(documentId, { scrollPosition: posString }).catch(console.error)
        }
    }, [url, documentId])

    const handleScroll = useCallback(() => {
        if (saveTimer.current) clearTimeout(saveTimer.current)
        saveTimer.current = setTimeout(saveScrollPos, 500)
    }, [saveScrollPos])

    // Synchronous save on unmount ensures position is captured even if the user
    // moves the panel before the 300ms debounce fires.
    useEffect(() => () => {
        if (saveTimer.current) clearTimeout(saveTimer.current)
        saveScrollPos()
    }, [saveScrollPos])

    // React cleanup effects don't run reliably during F5 / tab close because
    // the browser starts unloading before React finishes teardown. A synchronous
    // beforeunload handler is the only reliable way to capture the position.
    useEffect(() => {
        window.addEventListener('beforeunload', saveScrollPos)
        return () => window.removeEventListener('beforeunload', saveScrollPos)
    }, [saveScrollPos])

    // ── Zoom Scroll Re-centering ─────────────────────────────────────────────
    useEffect(() => {
        const handleZoomChange = (e: CustomEvent<{ factor: number }>) => {
            const container = containerRef.current
            if (!container) return

            // Record current center point percentages before the scale changes
            const centerLeftPct = (container.scrollLeft + container.clientWidth / 2) / container.scrollWidth
            const centerTopPct = (container.scrollTop + container.clientHeight / 2) / container.scrollHeight

            // Post-render effect: once the scale changes and DOM updates, re-apply the position
            // The requestAnimationFrame chain guarantees we wait for the browser layout
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    if (!containerRef.current) return
                    const c = containerRef.current
                    c.scrollLeft = (centerLeftPct * c.scrollWidth) - (c.clientWidth / 2)
                    c.scrollTop = (centerTopPct * c.scrollHeight) - (c.clientHeight / 2)
                })
            })
        }

        window.addEventListener(`zoom-change:${url}`, handleZoomChange as EventListener)
        return () => window.removeEventListener(`zoom-change:${url}`, handleZoomChange as EventListener)
    }, [url])

    // ── Render ───────────────────────────────────────────────────────────────

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground animate-in fade-in">
                <Loader2 className="h-8 w-8 animate-spin" />
                <p className="text-sm font-medium">Loading document...</p>
            </div>
        )
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-destructive p-8 text-center animate-in zoom-in-95">
                <AlertCircle className="h-12 w-12" />
                <div className="space-y-1">
                    <p className="font-semibold text-lg">Failed to render PDF</p>
                    <p className="text-sm opacity-80">{error}</p>
                </div>
            </div>
        )
    }

    return (
        <div
            ref={containerRef}
            tabIndex={0}
            onScroll={handleScroll}
            className="flex-1 overflow-auto scrollbar-thin scrollbar-thumb-border/30 hover:scrollbar-thumb-border/50 focus:outline-none outline-none"
            style={{ height: '100%' }}
        >
            <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
                {rowVirtualizer.getVirtualItems().map((virtualItem) => (
                    <div
                        key={virtualItem.key}
                        ref={rowVirtualizer.measureElement}
                        data-index={virtualItem.index}
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            minWidth: '100%',
                            width: 'max-content',
                            transform: `translateY(${virtualItem.start}px)`,
                        }}
                        className="flex flex-col items-center px-4"
                    >
                        <PageCanvas
                            pdf={pdf!}
                            pageNumber={virtualItem.index + 1}
                            invert={invertColors}
                            scale={scale}
                        />
                    </div>
                ))}
            </div>

            {/* Floating Highlight Button */}
            {selection && (
                <div
                    className="fixed z-[100] animate-in fade-in zoom-in-95 duration-200"
                    style={{
                        top: selection.rect.top - 40,
                        left: selection.rect.left + selection.rect.width / 2,
                        transform: 'translateX(-50%)'
                    }}
                >
                    <Button
                        size="sm"
                        className="h-8 gap-2 shadow-xl bg-primary text-primary-foreground hover:bg-primary/90"
                        onClick={(e: React.MouseEvent) => {
                            e.stopPropagation()
                            onAddHighlight?.(selection.text, selection.page)
                            setSelection(null)
                            window.getSelection()?.removeAllRanges()
                        }}
                    >
                        <Highlighter className="h-4 w-4" />
                        <span>Highlight</span>
                    </Button>
                </div>
            )}
        </div>
    )
})

PdfRenderer.displayName = 'PdfRenderer'

// ─── PageCanvas ──────────────────────────────────────────────────────────────

interface PageCanvasProps {
    pdf: pdfjs.PDFDocumentProxy
    pageNumber: number
    invert: boolean
    scale: number
}

function PageCanvas({ pdf, pageNumber, invert, scale }: PageCanvasProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const textLayerRef = useRef<HTMLDivElement>(null)

    const cacheKey = `${pageNumber}:${scale.toFixed(2)}`
    const pageCache = getPageCache(pdf)

    // Start "ready" immediately if the bitmap is already cached → no spinner on remount
    const [ready, setReady] = useState(() => pageCache.has(cacheKey))

    // useLayoutEffect: fires before paint.
    // Cache HIT → drawImage() is synchronous → user sees the page on the very first frame.
    // Cache MISS → kicks off async PDF.js render (fires after paint, like useEffect).
    useLayoutEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return

        let cancelled = false
        let renderTask: pdfjs.RenderTask | null = null

        const renderCanvasAndText = async () => {
            // ── Canvas Rendering ────────────────────────────────────────────────
            if (pageCache.has(cacheKey)) {
                const { bitmap, width, height, cssWidth, cssHeight } = pageCache.get(cacheKey)!
                canvas.width = width
                canvas.height = height
                canvas.style.width = `${cssWidth}px`
                canvas.style.height = `${cssHeight}px`
                canvas.getContext('2d', { alpha: true })?.drawImage(bitmap, 0, 0)
                getHeightCache(pdf).set(`${scale.toFixed(2)}:${pageNumber}`, cssHeight)
                if (!ready) setReady(true)
            } else {
                try {
                    const page = await pdf.getPage(pageNumber)
                    if (cancelled) return

                    const cssViewport = page.getViewport({ scale })
                    const pixelRatio = window.devicePixelRatio || 1
                    const renderViewport = page.getViewport({ scale: scale * pixelRatio })
                    const ctx = canvas.getContext('2d', { alpha: true })
                    if (!ctx) return

                    canvas.height = renderViewport.height
                    canvas.width = renderViewport.width
                    canvas.style.width = `${cssViewport.width}px`
                    canvas.style.height = `${cssViewport.height}px`

                    renderTask = page.render({
                        canvasContext: ctx,
                        canvas,
                        viewport: renderViewport,
                    })

                    await renderTask.promise
                    if (cancelled) return

                    const bitmap = await createImageBitmap(canvas)
                    if (!cancelled) {
                        setCachedPage(pageCache, cacheKey, {
                            bitmap,
                            width: canvas.width,
                            height: canvas.height,
                            cssWidth: cssViewport.width,
                            cssHeight: cssViewport.height
                        })
                        getHeightCache(pdf).set(`${scale.toFixed(2)}:${pageNumber}`, cssViewport.height)
                        setReady(true)
                    }
                } catch (err: any) {
                    if (err.name === 'RenderingCancelledException') return
                    console.error(`Error rendering page ${pageNumber}:`, err)
                }
            }

            // ── Text Layer Rendering (Always render if not cancelled) ──────────
            if (textLayerRef.current && !cancelled) {
                try {
                    const page = await pdf.getPage(pageNumber)
                    if (cancelled) return
                    const cssViewport = page.getViewport({ scale })
                    const textContent = await page.getTextContent()
                    if (cancelled) return

                    textLayerRef.current.innerHTML = ''
                    textLayerRef.current.style.width = `${cssViewport.width}px`
                    textLayerRef.current.style.height = `${cssViewport.height}px`
                    textLayerRef.current.style.setProperty('--scale-factor', cssViewport.scale.toString())
                    textLayerRef.current.style.setProperty('--total-scale-factor', cssViewport.scale.toString())

                    const textLayer = new pdfjs.TextLayer({
                        textContentSource: textContent,
                        container: textLayerRef.current,
                        viewport: cssViewport,
                    })
                    await textLayer.render()
                } catch (err) {
                    console.error('Text layer error:', err)
                }
            }
        }

        renderCanvasAndText()

        return () => {
            cancelled = true
            renderTask?.cancel()
        }
    }, [pdf, pageNumber, scale, cacheKey, pageCache])

    // Known height used for the loading placeholder so measureElement always gets
    // the correct size, avoiding layout shifts when the canvas finishes rendering.
    const knownHeight = getHeightCache(pdf).get(`${scale.toFixed(2)}:${pageNumber}`)

    return (
        <div className="relative mx-auto w-max mb-4 shadow-sm bg-white shrink-0">
            {!ready && (
                <div
                    className="absolute inset-0 flex items-center justify-center bg-muted/10 animate-pulse"
                    style={{ minHeight: knownHeight ? `${knownHeight}px` : `${1200 * scale}px` }}
                >
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/30" />
                </div>
            )}
            <canvas
                ref={canvasRef}
                className={cn('block', invert ? 'invert hue-rotate-180 contrast-[0.92] brightness-[1.3]' : '')}
            />
            <div
                ref={textLayerRef}
                className="textLayer"
                data-page-number={pageNumber}
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    opacity: 1, // Usually pdf_viewer.css hides it by default unless configured
                    lineHeight: 1,
                    zIndex: 1
                }}
            />
            <div className={cn(
                'absolute top-2 right-2 px-2 py-0.5 rounded text-[10px] font-mono',
                'pointer-events-none select-none opacity-40 hover:opacity-100 transition-opacity',
                invert ? 'bg-white/10 text-white' : 'bg-black/5 text-muted-foreground'
            )}>
                PAGE {pageNumber}
            </div>
        </div>
    )
}
