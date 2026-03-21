import React, { useState, useCallback, useEffect } from "react";
import "./App.scss";
import type { Schedule } from "./types/schedule";
import { ANNOUNCEMENTS_BY_CATEGORY, CATEGORY_LABELS, STORAGE_KEY } from "./constants";
import { loadSettings } from "./utils";
import { useKoreanClock } from "./hooks/useKoreanClock";
import { useAudioPlayer } from "./hooks/useAudioPlayer";
import { useScheduler } from "./hooks/useScheduler";
import { useBgMusic } from "./hooks/useBgMusic";
import { AppHeader } from "./components/AppHeader/AppHeader";
import { CategorySection } from "./components/CategorySection/CategorySection";
import { BgMusicPanel } from "./components/BgMusicPanel/BgMusicPanel";

type Tab = "announcements" | "bgmusic";

function App() {
  const currentTime = useKoreanClock();
  const { playingId, progress, volume, play, stop, seek, setVolume } = useAudioPlayer();
  const [schedules, setSchedules] = useState<Record<string, Schedule>>(loadSettings);
  const [openSettingsId, setOpenSettingsId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("announcements");

  const bgMusic = useBgMusic();

  // Fade background music when announcement plays/stops
  useEffect(() => {
    if (playingId) {
      bgMusic.fadeOut();
    } else {
      bgMusic.fadeIn();
    }
  }, [playingId]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const handleAddTrack = useCallback(
    (file: File) => bgMusic.addTrack(file, bgMusic.currentPlaylistId ?? undefined),
    [bgMusic]
  );

  return (
    <div className="app">
      <AppHeader currentTime={currentTime} volume={volume} onVolumeChange={setVolume} />

      <div className="app-tabs">
        <button
          className={`app-tab${activeTab === "announcements" ? " app-tab--active" : ""}`}
          onClick={() => setActiveTab("announcements")}
        >
          안내 방송
        </button>
        <button
          className={`app-tab${activeTab === "bgmusic" ? " app-tab--active" : ""}`}
          onClick={() => setActiveTab("bgmusic")}
        >
          배경 음악
          {bgMusic.isPlaying && <span className="app-tab__playing-dot" />}
        </button>
      </div>

      <main className="app-main">
        {activeTab === "announcements" ? (
          categories.map((cat) => (
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
          ))
        ) : (
          <BgMusicPanel
            tracks={bgMusic.tracks}
            playlists={bgMusic.playlists}
            currentPlaylistId={bgMusic.currentPlaylistId}
            currentPlaylist={bgMusic.currentPlaylist}
            currentTrack={bgMusic.currentTrack}
            currentTrackIndex={bgMusic.currentTrackIndex}
            isPlaying={bgMusic.isPlaying}
            volume={bgMusic.volume}
            autoplay={bgMusic.autoplay}
            onAddTrack={handleAddTrack}
            onRemoveTrack={bgMusic.removeTrack}
            onCreatePlaylist={bgMusic.createPlaylist}
            onDeletePlaylist={bgMusic.deletePlaylist}
            onSetCurrentPlaylist={bgMusic.setCurrentPlaylist}
            onSetLoop={bgMusic.setLoop}
            onAddToPlaylist={bgMusic.addTrackToPlaylist}
            onRemoveFromPlaylist={bgMusic.removeTrackFromPlaylist}
            onReorderTrack={bgMusic.reorderTrack}
            progress={bgMusic.progress}
            onPlay={bgMusic.play}
            onTogglePlay={bgMusic.togglePlay}
            onNext={bgMusic.next}
            onPrev={bgMusic.prev}
            onSeek={bgMusic.seek}
            onSetVolume={bgMusic.setVolume}
            onSetAutoplay={bgMusic.setAutoplay}
          />
        )}
      </main>
    </div>
  );
}

export default App;
