import { useEffect, useRef } from "react";
import type { AnnouncementDef } from "../types/announcement";
import type { Schedule } from "../types/schedule";
import { ANNOUNCEMENT_DEFS } from "../constants";

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

export function useScheduler(
  currentTime: Date,
  schedules: Record<string, Schedule>,
  onFire: (ann: AnnouncementDef) => void
): void {
  const schedulesRef = useRef(schedules);
  useEffect(() => {
    schedulesRef.current = schedules;
  }, [schedules]);

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
        onFireRef.current(ann);
      }
    });
  }, [currentTime]);
}
