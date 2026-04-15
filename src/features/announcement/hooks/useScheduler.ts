import { useEffect, useRef } from "react";
import type { AnnouncementDef } from "@/features/announcement/types/announcement";
import type { Schedule, AnnouncementTimeRangeSettings, DayType } from "@/features/announcement/types/schedule";
import { ANNOUNCEMENT_DEFS } from "@/constants";

export function shouldFire(schedule: Schedule, hh: number, mm: number): boolean {
  if (!schedule.enabled) return false;
  // Parse schedule time (expected "HH:mm")
  const type = schedule.type;
  const timeStr = schedule.time || "00:00";
  const [sh, sm] = timeStr.split(":").map(Number);

  if (type === "once") {
    return hh === sh && mm === sm;
  }
  if (type === "odd-hour") {
    return mm === sm && hh % 2 === 1;
  }
  if (type === "even-hour") {
    return mm === sm && hh % 2 === 0;
  }
  if (schedule.type === "interval" && schedule.intervalMinutes > 0) {
    const totalMins = hh * 60 + mm;
    return totalMins > 0 && totalMins % schedule.intervalMinutes === 0;
  }
  return false;
}

export function getDayType(date: Date): DayType {
  const day = date.getDay(); // 0=일, 6=토
  return day === 0 || day === 6 ? "holiday" : "weekday";
}

export function isInTimeRange(start: string, end: string, hh: number, mm: number): boolean {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const current = hh * 60 + mm;
  return current >= sh * 60 + sm && current <= eh * 60 + em;
}

const SCHEDULE_PRIORITY: Record<string, number> = {
  once: 0,
  "odd-hour": 0,
  "even-hour": 0,
  interval: 1,
};

export function useScheduler(
  currentTime: Date,
  schedules: Record<string, Schedule>,
  timeRangeSettings: AnnouncementTimeRangeSettings,
  effectiveDayType: DayType,
  onFire: (ann: AnnouncementDef, priority: number) => void
): void {
  const schedulesRef = useRef(schedules);
  useEffect(() => {
    schedulesRef.current = schedules;
  }, [schedules]);

  const timeRangeSettingsRef = useRef(timeRangeSettings);
  useEffect(() => {
    timeRangeSettingsRef.current = timeRangeSettings;
  }, [timeRangeSettings]);

  const effectiveDayTypeRef = useRef(effectiveDayType);
  useEffect(() => {
    effectiveDayTypeRef.current = effectiveDayType;
  }, [effectiveDayType]);

  const onFireRef = useRef(onFire);
  useEffect(() => {
    onFireRef.current = onFire;
  }, [onFire]);

  const triggeredRef = useRef<Set<string>>(new Set());
  const lastDayRef = useRef<string>("");

  useEffect(() => {
    const hh = currentTime.getHours();
    const mm = currentTime.getMinutes();
    const ss = currentTime.getSeconds();

    if (ss !== 0) return;

    if (timeRangeSettingsRef.current.enabled) {
      const range = timeRangeSettingsRef.current[effectiveDayTypeRef.current];
      if (!isInTimeRange(range.start, range.end, hh, mm)) return;
    }

    const dayStr = `${currentTime.getFullYear()}-${currentTime.getMonth()}-${currentTime.getDate()}`;
    if (lastDayRef.current !== dayStr) {
      triggeredRef.current = new Set();
      lastDayRef.current = dayStr;
    }

    ANNOUNCEMENT_DEFS.forEach((ann) => {
      const schedule = schedulesRef.current[ann.id];
      if (!schedule) return;

      const triggerKey = `${ann.id}-${dayStr}-${hh}:${String(mm).padStart(2, "0")}`;
      if (triggeredRef.current.has(triggerKey)) return;

      if (shouldFire(schedule, hh, mm)) {
        triggeredRef.current.add(triggerKey);
        const priority = SCHEDULE_PRIORITY[schedule.type] ?? 1;
        onFireRef.current(ann, priority);
      }
    });
  }, [currentTime]);
}
