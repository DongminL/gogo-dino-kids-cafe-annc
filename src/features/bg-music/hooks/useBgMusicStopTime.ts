import { useEffect, useRef } from "react";
import type { AnnouncementTimeRangeSettings } from "@/features/announcement/types/schedule";
import { shouldFire } from "@/features/announcement/hooks/useScheduler";

export function useBgMusicStopTime(
  currentTime: Date,
  timeRangeSettings: AnnouncementTimeRangeSettings,
  isPlaying: boolean,
  pause: () => void
): void {
  const firedKeyRef = useRef<string>("");

  useEffect(() => {
    if (!isPlaying) return;

    const key = `${currentTime.getFullYear()}-${currentTime.getMonth()}-${currentTime.getDate()} ${currentTime.getHours()}:${currentTime.getMinutes()}`;
    if (firedKeyRef.current === key) return;

    const fire = shouldFire(
      {
        type: "once",
        time: timeRangeSettings.bgMusicStopTime,
        intervalMinutes: 0,
        enabled: timeRangeSettings.bgMusicStopEnabled,
      },
      currentTime.getHours(),
      currentTime.getMinutes()
    );
    if (fire) {
      firedKeyRef.current = key;
      pause();
    }
  }, [currentTime, timeRangeSettings, isPlaying, pause]);
}
