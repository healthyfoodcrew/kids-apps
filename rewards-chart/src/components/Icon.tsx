// Simple line icons. Job icons are picked from this list in the parent Jobs screen.
export const JOB_ICONS: Record<string, { label: string; d: string }> = {
  bed: { label: 'Bed', d: 'M3 18v-7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v7 M3 14h18 M7 9V6h4v3' },
  shirt: { label: 'Clothes', d: 'M8 4l-5 3 2 4 3-1v10h8V10l3 1 2-4-5-3a4 4 0 0 1-8 0z' },
  teeth: { label: 'Teeth', d: 'M12 3v4 M12 17v4 M3 12h4 M17 12h4 M6 6l2 2 M16 16l2 2 M6 18l2-2 M16 8l2-2' },
  bowl: { label: 'Bowl', d: 'M3 11h18a9 9 0 0 1-18 0z M8 7c0-2 2-2 2-4 M13 7c0-2 2-2 2-4' },
  bag: { label: 'School bag', d: 'M6 8h12l-1 12H7z M9 8V6a3 3 0 0 1 6 0v2' },
  lunch: { label: 'Lunchbox', d: 'M4 9h16v10H4z M9 9V6h6v3 M4 13h16' },
  dish: { label: 'Dishwasher', d: 'M4 3h16v18H4z M4 8h16 M8 5.5h.01 M12 14a3 3 0 1 0 0 .01' },
  clothes: { label: 'Drawers', d: 'M3 5h18v14H3z M3 12h18 M10 8.5h4 M10 15.5h4' },
  roll: { label: 'Toilet paper', d: 'M8 4h10a3 5 0 0 1 0 10H8 M8 4a3 5 0 0 0 0 10 M8 14v6h10v-6' },
  bin: { label: 'Rubbish', d: 'M4 7h16 M10 4h4 M6 7l1 13h10l1-13 M10 11v6 M14 11v6' },
  table: { label: 'Table', d: 'M3 9h18 M5 9v10 M19 9v10 M8 5h8' },
  shoe: { label: 'Shoes', d: 'M3 16v-5l4-1 3 3h6a5 5 0 0 1 5 5H3z M3 19h18' },
  washing: { label: 'Washing', d: 'M3 6h18 M7 6v6l-2 3h4l-2-3 M14 6v8 M12 14h4v4h-4z' },
  book: { label: 'Reading', d: 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z M4 19V5 M8 7h7' },
  pet: { label: 'Pet', d: 'M8 13a4 4 0 0 0 8 0c0-2-2-3-4-3s-4 1-4 3z M6 9a1.5 1.5 0 1 0 0-.01 M18 9a1.5 1.5 0 1 0 0-.01 M9.5 6a1.5 1.5 0 1 0 0-.01 M14.5 6a1.5 1.5 0 1 0 0-.01' },
  plant: { label: 'Water plants', d: 'M12 21v-8 M12 13c0-4 3-6 7-6 0 4-3 6-7 6z M12 15c0-3-2-5-6-5 0 3 2 5 6 5z' },
  broom: { label: 'Sweep', d: 'M14 3l-4 9 M6 12h8l2 9H4z M8 16v5 M12 16v5' },
  car: { label: 'Car', d: 'M3 16v-4l2-5h14l2 5v4z M3 16v2h3v-2 M18 16v2h3v-2 M7 12h.01 M17 12h.01' },
  water: { label: 'Water bowl', d: 'M12 3c3 4 6 7.5 6 11a6 6 0 0 1-12 0c0-3.5 3-7 6-11z M9.5 14.5a2.5 2.5 0 0 0 2.5 2.5' },
  star: { label: 'Star', d: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z' },
};

export const UI_ICONS = {
  check: 'M5 12l5 5 9-10',
  lock: 'M6 11h12v9H6z M8 11V8a4 4 0 0 1 8 0v3',
  unlock: 'M8 11V8a4 4 0 0 1 7.5-2 M6 11h12v9H6z',
  switch: 'M7 7h13 M16 3l4 4-4 4 M17 17H4 M8 13l-4 4 4 4',
  gamepad: 'M6 9h12a4 4 0 0 1 4 4v1a3 3 0 0 1-5.2 2L15 14H9l-1.8 2A3 3 0 0 1 2 14v-1a4 4 0 0 1 4-4z M7 12v3 M5.5 13.5h3 M16 12.5h.01 M18 14h.01',
  plus: 'M12 5v14 M5 12h14',
  minus: 'M5 12h14',
  close: 'M6 6l12 12 M18 6L6 18',
  back: 'M15 5l-7 7 7 7',
  home: 'M4 11l8-7 8 7v9H4z',
  list: 'M9 5h10 M9 12h10 M9 19h10 M4 5h.01 M4 12h.01 M4 19h.01',
  wallet: 'M3 7h18v10H3z M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6A7 7 0 0 0 5 12a7 7 0 0 0 .1 1.2l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2L10 21h4l.5-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6A7 7 0 0 0 19 12z',
  edit: 'M4 20h4L19 9l-4-4L4 16z M14 6l4 4',
  trash: 'M4 7h16 M10 4h4 M6 7l1 13h10l1-13',
  up: 'M12 19V5 M5 12l7-7 7 7',
  down: 'M12 5v14 M5 12l7 7 7-7',
  clock: 'M12 7v5l3 2 M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
  plusminus: 'M12 4v8 M8 8h8 M8 18h8',
  logout: 'M15 4h4v16h-4 M10 8l-4 4 4 4 M6 12h10',
};

interface IconProps {
  d?: string;
  name?: string;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export function Icon({ d, name, size = 24, strokeWidth = 2, className }: IconProps) {
  const path = d ?? (name ? JOB_ICONS[name]?.d ?? JOB_ICONS.star.d : JOB_ICONS.star.d);
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path d={path} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function StarIcon({ size = 24, color = '#FFC94A' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d={JOB_ICONS.star.d} fill={color} />
    </svg>
  );
}
