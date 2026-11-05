import React, { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ImageFullscreenButton, ImageFullscreenModal } from '../../../components/ui/image-fullscreen-modal'

interface MarkdownPreviewProps {
    title?: string
    content: string
}

function MarkdownImage({ src, alt }: { src?: string; alt?: string }) {
    const [isFullscreen, setIsFullscreen] = useState(false)
    if (!src) return null

    return (
        <span className="relative inline-block my-2 group max-w-full leading-none">
            <img
                src={src}
                alt={alt}
                className="max-w-full h-auto rounded-lg border border-border/40 block"
            />
            <ImageFullscreenButton onClick={() => setIsFullscreen(true)} />
            {isFullscreen && (
                <ImageFullscreenModal
                    src={src}
                    alt={alt}
                    onClose={() => setIsFullscreen(false)}
                />
            )}
        </span>
    )
}

export const MemoizedMarkdownPreview = React.memo(({ title, content }: MarkdownPreviewProps) => {
    let cleanContent = content;
    const t = title?.trim();
    if (t) {
        const lines = cleanContent.split('\n');
        const firstLine = lines[0].trim();
        const headerMatch = firstLine.match(/^#+\s*(.*)$/);
        const firstLineText = headerMatch ? headerMatch[1].trim() : firstLine;
        if (firstLineText.toLowerCase() === t.toLowerCase()) {
            cleanContent = lines.slice(1).join('\n').trim() || "Empty document";
        }
    }
    return (
        <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
                img: ({ src, alt }) => <MarkdownImage src={src} alt={alt} />
            }}
        >
            {cleanContent}
        </ReactMarkdown>
    );
});

MemoizedMarkdownPreview.displayName = 'MemoizedMarkdownPreview';
