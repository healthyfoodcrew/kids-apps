// Pictures for calendar events (simple line icons drawn in code).
export const EVENT_ICONS: Record<string, { d: string; label: string }> = {
  star: { label: 'Special', d: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z' },
  ball: { label: 'Sport', d: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M12 7l4 3-1.5 5h-5L8 10z M12 3v4 M21 10h-5 M3 10h5 M9.5 15l-3 4 M14.5 15l3 4' },
  swim: { label: 'Swimming', d: 'M2 18c2 1.5 4 1.5 6 0s4-1.5 6 0 4 1.5 6 0 M2 14c2 1.5 4 1.5 6 0s4-1.5 6 0 4 1.5 6 0 M9 11l3-5 4 2 M16 4.5a1.5 1.5 0 1 0 0 .01' },
  cake: { label: 'Party', d: 'M4 21h16 M5 21v-8h14v8 M5 16c2 1.5 4 1.5 7 0s5-1.5 7 0 M12 13V9 M12 6.5c-1-1-1-2.5 0-3.5 1 1 1 2.5 0 3.5' },
  home: { label: 'Visitors', d: 'M3 11l9-7 9 7 M5 10v10h14V10 M10 20v-6h4v6' },
  bus: { label: 'School trip', d: 'M5 4h14v12H5z M5 11h14 M7 19v-3 M17 19v-3 M8 14h.01 M16 14h.01' },
  book: { label: 'School', d: 'M4 5a2 2 0 0 1 2-2h14v15H6a2 2 0 0 0-2 2z M4 20a2 2 0 0 0 2 2h14 M8 7h8' },
  music: { label: 'Music', d: 'M9 18V5l11-2v13 M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0z M20 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z' },
  tooth: { label: 'Dentist', d: 'M7 3c-2.5 0-4 2-4 4.5 0 3 1.5 4 2 7 .5 3 1 6.5 2.5 6.5S9.5 17 12 17s3 4 4.5 4S18.5 17.5 19 14.5c.5-3 2-4 2-7C21 5 19.5 3 17 3c-2 0-3 1-5 1S9 3 7 3z' },
  doctor: { label: 'Doctor', d: 'M9 3h6v6h6v6h-6v6H9v-6H3V9h6z' },
  sun: { label: 'Day out', d: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z M12 2v2 M12 20v2 M4.9 4.9l1.4 1.4 M17.7 17.7l1.4 1.4 M2 12h2 M20 12h2 M4.9 19.1l1.4-1.4 M17.7 6.3l1.4-1.4' },
  plane: { label: 'Holiday', d: 'M2 16l20-6-3-2-7 2-5-5-2 1 3 5-4 1-2-2-1 1z M3 21h18' },
};

export function EventIcon({ name, size = 22, color = 'currentColor' }: { name: string; size?: number; color?: string }) {
  const d = (EVENT_ICONS[name] ?? EVENT_ICONS.star).d;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}
