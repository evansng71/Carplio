export function ymd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseYmd(s: string) {
  return new Date(`${s}T12:00:00`);
}

export function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  }).replace(':', 'h');
}

export function fmtDayLong(iso: string) {
  const d = parseYmd(iso);
  const s = d.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function weekDays(around: Date) {
  const start = new Date(around);
  const dow = (start.getDay() + 6) % 7; // Monday=0
  start.setDate(start.getDate() - dow);
  start.setHours(12, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

export function monthGrid(year: number, month: number) {
  // month 0-indexed
  const first = new Date(year, month, 1, 12);
  const startOffset = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(1 - startOffset);
  const cells: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    cells.push(d);
  }
  return cells;
}

export const DAY_SHORT = ['LUN.', 'MAR.', 'MER.', 'JEU.', 'VEN.', 'SAM.', 'DIM.'];

export const LEAVE_LABEL: Record<string, string> = {
  conges: 'Congés payés',
  rtt: 'RTT',
  recuperation: 'Récupération',
  maladie: 'Maladie',
  sans_solde: 'Sans solde',
};

export type DayMarker = {
  date: string;
  assignmentCount: number;
  provisional?: boolean;
  code?: string | null;
  codes?: string[];
};

export type Assignment = {
  id: string;
  startsAt: string;
  endsAt: string;
  status?: string;
  notes?: string | null;
  mission: {
    id: string;
    number: string;
    title: string;
    origin?: string | null;
    destination?: string | null;
    originAddress?: string | null;
    destinationAddress?: string | null;
    garageDepartureAt?: string | null;
    presentationAt?: string | null;
    returnGarageAt?: string | null;
    passengers?: number;
    order?: { customer?: { name: string } };
  };
  vehicle?: {
    plate?: string | null;
    fleetNumber?: string | null;
  } | null;
};
