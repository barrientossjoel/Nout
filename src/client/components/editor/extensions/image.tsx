import { ReactNodeViewRenderer, NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import Image from '@tiptap/extension-image'
import { useState } from 'react'
import { ImageFullscreenButton, ImageFullscreenModal } from '../../ui/image-fullscreen-modal'
import { cn } from '../../../lib/utils/utils'

function ImageView({ node, selected }: NodeViewProps) {
    const [isFullscreen, setIsFullscreen] = useState(false)
    const src = (node.attrs.src as string | undefined) ?? ''
    const alt = node.attrs.alt as string | undefined
    const title = node.attrs.title as string | undefined

    if (!src) return null

    return (
        <NodeViewWrapper className="relative inline-block my-3 group max-w-full leading-none">
            <div
                onDoubleClick={(e) => {
                    e.stopPropagation()
                    setIsFullscreen(true)
                }}
                className={cn(
                    "relative inline-block overflow-hidden rounded-xl border border-border/40 transition-all cursor-pointer",
                    selected && "ring-2 ring-primary"
                )}
            >
                <img
                    src={src}
                    alt={alt}
                    title={title}
                    className="max-w-full h-auto block select-none rounded-xl"
                    draggable={false}
                />
                <ImageFullscreenButton onClick={() => setIsFullscreen(true)} />
            </div>
            {isFullscreen && (
                <ImageFullscreenModal
                    src={src}
                    alt={alt || title}
                    onClose={() => setIsFullscreen(false)}
                />
            )}
        </NodeViewWrapper>
    )
}

export const CustomImageExtension = Image.extend({
    addNodeView() {
        return ReactNodeViewRenderer(ImageView)
    },
})

