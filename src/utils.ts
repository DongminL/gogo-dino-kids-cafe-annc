import type { Schedule } from "./types/schedule";
import { ANNOUNCEMENT_DEFS, STORAGE_KEY } from "./constants";

export function getKoreanTime(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
}

export function formatTime(date: Date): string {
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  const s = String(date.getSeconds()).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

export function formatDuration(seconds: number): string {
  if (!isFinite(seconds) || isNaN(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function getScheduleLabel(schedule: Schedule): string {
  if (!schedule.enabled || schedule.type === "none") return "자동 재생 꺼짐";
  switch (schedule.type) {
    case "once":
      return `${schedule.time} 자동 재생`;
    case "odd-hour":
      return "홀수 시각 정각 자동 재생";
    case "even-hour":
      return "짝수 시각 정각 자동 재생";
    case "interval":
      return `${schedule.intervalMinutes}분마다 자동 재생`;
    default:
      return "";
  }
}

export function loadSettings(): Record<string, Schedule> {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return Object.fromEntries(ANNOUNCEMENT_DEFS.map((d) => [d.id, { ...d.defaultSchedule }]));
}
