export interface GoogleCalendarEvent {
  title: string
  details?: string
  date: Date
  location?: string
}

const GCAL_URL_KEY = 'nout_gcal_ical_url'

export function getSavedGCalUrl(): string | null {
  return typeof window !== 'undefined' ? localStorage.getItem(GCAL_URL_KEY) : null
}

export function saveGCalUrl(url: string): void {
  typeof window !== 'undefined' && localStorage.setItem(GCAL_URL_KEY, url)
}

/** Generates a web URL to open Google Calendar and create an event directly */
export function createGoogleCalendarUrl(event: GoogleCalendarEvent): string {
  const start = event.date.toISOString().replace(/-|:|\.\d\d\d/g, '')
  const end = new Date(event.date.getTime() + 3600000).toISOString().replace(/-|:|\.\d\d\d/g, '')
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${start}/${end}`,
    details: event.details || 'Creado desde nOut',
    location: event.location || '',
  })
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}
