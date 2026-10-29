import React, { useState } from 'react'
import { DayPicker } from 'react-day-picker'
import 'react-day-picker/dist/style.css'
import { format, isSameDay } from 'date-fns'
import { cn } from '../../lib/utils/utils'
import type { Document as NoteDocument } from '../../../core/types/notes'
import { Button } from '../../components/ui/button'
import { PanelLeft, PanelTop, MessageSquare, ExternalLink } from 'lucide-react'
import { createGoogleCalendarUrl } from '../../../core/services/google-calendar'

interface CalendarViewProps {
  documents: NoteDocument[]
  onOpenDocument?: (id: string) => void
  showSidebar?: boolean
  onToggleSidebar?: () => void
  showTabs?: boolean
  onToggleTabs?: () => void
  showNotes?: boolean
  onToggleNotes?: () => void
}

export function CalendarView({
  documents,
  onOpenDocument,
  showSidebar,
  onToggleSidebar,
  showTabs,
  onToggleTabs,
  showNotes,
  onToggleNotes
}: CalendarViewProps) {
  const [selected, setSelected] = useState<Date>(new Date())

  const notesForDay = React.useMemo(() => (
    selected
      ? documents.filter(doc => {
          const dateStr = doc.updatedAt || doc.createdAt || doc.date
          return dateStr ? isSameDay(new Date(dateStr), selected) : false
        })
      : []
  ), [documents, selected])

  return (
    <div className="flex flex-col h-full bg-muted/50 animate-in fade-in duration-300">
      {/* Header */}
      <div className="h-16 flex items-center justify-between px-4 bg-transparent sticky top-0 z-10 shrink-0">
        <div className="flex items-center gap-2">
          {onToggleSidebar && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleSidebar}
              title={showSidebar ? "Close Sidebar" : "Open Sidebar"}
              className="bg-transparent"
            >
              <PanelLeft className="h-4 w-4" />
            </Button>
          )}
          <h2 className="text-xl font-semibold tracking-tight">Calendar</h2>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open('https://calendar.google.com', '_blank')}
            className="text-xs h-8 gap-1.5"
            title="Abrir Google Calendar"
          >
            <span>Google Calendar</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
          {onToggleTabs && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleTabs}
              title={showTabs ? "Hide Tabs" : "Show Tabs"}
              className={cn(!showTabs && "text-muted-foreground/50")}
            >
              <PanelTop className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-md mx-auto w-full space-y-8">
          <div className="flex items-center justify-between items-baseline">

            {selected && (
              <p className="text-sm text-muted-foreground font-medium">
                {format(selected, 'PPP')}
              </p>
            )}
          </div>

          <div className="bg-transparent border border-border/40 rounded-lg p-4 flex justify-center">
            <DayPicker
              mode="single"
              selected={selected}
              onSelect={(date) => date && setSelected(date)}
              className="border-none"
              classNames={{
                day_today: "font-bold text-primary",
                day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
              }}
            />
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Notes for this day
            </h3>
            <div className="space-y-2">
              {notesForDay.length > 0 ? (
                notesForDay.map(doc => {
                  const dateStr = doc.updatedAt || doc.createdAt || doc.date || new Date().toISOString();
                  return (
                    <div
                      key={doc.id}
                      className="p-3 border border-border/40 rounded-md bg-transparent hover:bg-accent/50 cursor-pointer transition-colors group"
                      onClick={() => onOpenDocument?.(doc.id)}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">{doc.title || "Untitled"}</span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const snippet = typeof doc.content === 'string' ? doc.content.slice(0, 150) : '';
                              const url = createGoogleCalendarUrl({
                                title: doc.title || 'Nota de nOut',
                                date: selected,
                                details: snippet,
                              });
                              window.open(url, '_blank');
                            }}
                            className="p-1 rounded-md text-muted-foreground hover:text-primary transition-colors text-[10px] flex items-center gap-1"
                            title="Agendar en Google Calendar"
                          >
                            <span>GCal</span>
                            <ExternalLink className="w-3 h-3" />
                          </button>
                          <span className="text-[10px] text-muted-foreground group-hover:text-foreground">
                            {format(new Date(dateStr), 'p')}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-sm text-muted-foreground border-t border-border/40 pt-4">
                  No notes found for this date.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
