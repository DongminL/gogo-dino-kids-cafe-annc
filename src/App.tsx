import React, { useState, useCallback, useEffect } from "react";
import "./App.scss";
import type { Schedule } from "./types/schedule";
import { ANNOUNCEMENTS_BY_CATEGORY, CATEGORY_LABELS, STORAGE_KEY } from "./constants";
import { loadSettings } from "./utils";
import { useKoreanClock } from "./hooks/useKoreanClock";
import { useAudioPlayer } from "./hooks/useAudioPlayer";
import { useScheduler } from "./hooks/useScheduler";
import { AppHeader } from "./components/AppHeader/AppHeader";
import { CategorySection } from "./components/CategorySection/CategorySection";

function App() {
  const currentTime = useKoreanClock();
  const { playingId, progress, volume, play, stop, seek, setVolume } = useAudioPlayer();
  const [schedules, setSchedules] = useState<Record<string, Schedule>>(loadSettings);
  const [openSettingsId, setOpenSettingsId] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(schedules));
  }, [schedules]);

  const updateSchedule = useCallback((id: string, update: Partial<Schedule>) => {
    setSchedules((prev) => ({ ...prev, [id]: { ...prev[id], ...update } }));
  }, []);

  const toggleSettings = useCallback((id: string) => {
    setOpenSettingsId((prev) => (prev === id ? null : id));
  }, []);

  useScheduler(currentTime, schedules, play);

  const categories = Object.keys(CATEGORY_LABELS) as (keyof typeof CATEGORY_LABELS)[];

  return (
    <div className="app">
      <AppHeader currentTime={currentTime} volume={volume} onVolumeChange={setVolume} />

      <main className="app-main">
        {categories.map((cat) => (
          <CategorySection
            key={cat}
            category={cat}
            announcements={ANNOUNCEMENTS_BY_CATEGORY[cat]}
            schedules={schedules}
            playingId={playingId}
            progress={progress}
            openSettingsId={openSettingsId}
            onPlay={play}
            onStop={stop}
            onSeek={seek}
            onToggleSettings={toggleSettings}
            onScheduleChange={updateSchedule}
          />
        ))}
      </main>

      <footer className="app-footer">AI Voice: Supertone 제공</footer>
    </div>
  );
}

export default App;
