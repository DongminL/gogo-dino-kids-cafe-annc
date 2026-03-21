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
  if (!schedule.enabled) return "자동 재생 꺼짐";
  switch (schedule.type) {
    case "once":
      return `${schedule.time} 자동 재생`;
    case "odd-hour": {
      const min = schedule.time ? schedule.time.split(":")[1] : "00";
      return `홀수 시각 ${min === "00" ? "정각" : `${min}분`} 자동 재생`;
    }
    case "even-hour": {
      const min = schedule.time ? schedule.time.split(":")[1] : "00";
      return `짝수 시각 ${min === "00" ? "정각" : `${min}분`} 자동 재생`;
    }
    case "interval":
      return `${schedule.intervalMinutes}분마다 자동 재생`;
    default:
      return "";
  }
}

export function loadSettings(): Record<string, Schedule> {
  const defaults = Object.fromEntries(ANNOUNCEMENT_DEFS.map((d) => [d.id, { ...d.defaultSchedule }]));
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Migrate "none" type to "once" (if any)
      Object.keys(parsed).forEach(id => {
        if (parsed[id].type === "none") {
          parsed[id].type = ("once" as any);
        }
      });
      return { ...defaults, ...parsed };
    }
  } catch {}
  return defaults;
}
