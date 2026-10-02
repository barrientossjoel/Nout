import { useState, useEffect } from 'react';
import { getPublicDocument } from '../actions/actions';
import { CanvasView } from '../features/canvas/canvas-view';
import { Editor } from '../components/editor/editor';
import { PdfView } from '../features/pdf/pdf-view';
import type { Document } from '../../core/types/notes';

interface Props {
    documentId: string;
}

export default function SharedDocumentView({ documentId }: Props) {
    const [doc, setDoc] = useState<Document | null>(null);
    const [error, setError] = useState(false);

    useEffect(() => {
        getPublicDocument(documentId)
            .then(setDoc)
            .catch(() => setError(true));
    }, [documentId]);

    if (!doc && !error) {
        return (
            <div className="flex items-center justify-center h-screen bg-background text-muted-foreground text-sm">
                Cargando...
            </div>
        );
    }

    if (error || !doc) {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-background gap-3">
                <p className="text-muted-foreground text-sm">Documento no disponible o acceso denegado.</p>
                <a href="/" className="text-primary text-sm hover:underline">? Volver al inicio</a>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen bg-background text-foreground">
            <header className="h-12 shrink-0 border-b border-border flex items-center justify-between px-4">
                <div className="flex items-center gap-3 min-w-0">
                    <a href="/" className="font-bold text-sm shrink-0 hover:opacity-70 transition-opacity">Nout</a>
                    <span className="text-border">|</span>
                    <span className="text-sm font-medium truncate">{doc.title || 'Sin titulo'}</span>
                    <span className="text-[10px] text-muted-foreground border border-border rounded px-1.5 py-0.5 shrink-0">Solo lectura</span>
                </div>
                <a href="/login" className="text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0">
                    Iniciar sesion
                </a>
            </header>

            <main className="flex-1 overflow-hidden">
                {doc.type === 'canvas' ? (
                    <CanvasView document={doc} documents={[doc]} onUpdateDocument={() => {}} readOnly />
                ) : doc.type === 'pdf' ? (
                    <PdfView document={doc} documents={[doc]} />
                ) : (
                    <div className="h-full overflow-y-auto px-6 py-10 max-w-3xl mx-auto">
                        <h1 className="text-3xl font-bold mb-8">{doc.title}</h1>
                        <Editor content={doc.content || ''} onChange={() => {}} editable={false} documentId={doc.id} />
                    </div>
                )}
            </main>
        </div>
    );
}
