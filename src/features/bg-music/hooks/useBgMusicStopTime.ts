import { useEffect, useRef } from "react";
import type { AnnouncementTimeRangeSettings } from "@/features/announcement/types/schedule";

export function useBgMusicStopTime(
  currentTime: Date,
  timeRangeSettings: AnnouncementTimeRangeSettings,
  isPlaying: boolean,
  pause: () => void
): void {
  const firedKeyRef = useRef<string>("");

  useEffect(() => {
    if (!isPlaying) return;
    if (currentTime.getSeconds() !== 0) return; // gate to once per minute, matching useScheduler
    if (!timeRangeSettings.bgMusicStopEnabled) return;

    // Dedup so a manual restart within the same minute is not auto-stopped again
    const key = `${currentTime.getFullYear()}-${currentTime.getMonth()}-${currentTime.getDate()} ${currentTime.getHours()}:${currentTime.getMinutes()}`;
    if (firedKeyRef.current === key) return;

    const [sh, sm] = timeRangeSettings.bgMusicStopTime.split(":").map(Number);
    if (currentTime.getHours() === sh && currentTime.getMinutes() === sm) {
      firedKeyRef.current = key;
      pause();
    }
  }, [currentTime, timeRangeSettings, isPlaying, pause]);
}
