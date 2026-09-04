/**
 * 起卦历史 —— 仅存放在浏览器 localStorage，不上送服务端。
 */

export interface HistoryEntry {
  id: string;
  castAt: string;
  question: string;
  benName: string;
  benSymbol: string;
  benBinary: string;
  bianName?: string;
  bianBinary?: string;
  moving: number[];
}

const KEY = "qliuyao:history";
const MAX = 30;

function isHistoryEntry(value: unknown): value is HistoryEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Partial<HistoryEntry>;
  return typeof entry.id === "string" && typeof entry.castAt === "string" &&
    Number.isFinite(Date.parse(entry.castAt)) && typeof entry.question === "string" &&
    typeof entry.benName === "string" && typeof entry.benSymbol === "string" &&
    typeof entry.benBinary === "string" && /^[01]{6}$/.test(entry.benBinary) &&
    (entry.bianName === undefined || typeof entry.bianName === "string") &&
    (entry.bianBinary === undefined || (typeof entry.bianBinary === "string" && /^[01]{6}$/.test(entry.bianBinary))) &&
    Array.isArray(entry.moving) && entry.moving.every((index) => Number.isInteger(index) && index >= 0 && index < 6) &&
    new Set(entry.moving).size === entry.moving.length;
}

export function loadHistory(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isHistoryEntry).slice(0, MAX) : [];
  } catch {
    return [];
  }
}

export function saveHistory(entry: HistoryEntry): void {
  if (typeof window === "undefined") return;
  try {
    const cur = loadHistory();
    const next = [entry, ...cur.filter((e) => e.id !== entry.id)].slice(0, MAX);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* quota / disabled — silent */
  }
}

export function clearHistory(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* silent */
  }
}
