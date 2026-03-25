import React, { useState, useCallback, useEffect } from "react";
import "./App.scss";
import type { Schedule } from "@/types/schedule";
import { ANNOUNCEMENT_DEFS, ANNOUNCEMENTS_BY_CATEGORY, CATEGORY_LABELS, STORAGE_KEY } from "@/constants";
import { loadSettings, formatTime } from "@/utils";
import { useKoreanClock } from "@/hooks/useKoreanClock";
import { useAudioPlayer } from "@/features/announcement/hooks/useAudioPlayer";
import { useScheduler } from "@/features/announcement/hooks/useScheduler";
import { useBgMusic } from "@/features/bg-music/hooks/useBgMusic";
import { CategorySection } from "@/features/announcement/components/CategorySection/CategorySection";
import { BgMusicPanel } from "@/features/bg-music/components/BgMusicPanel/BgMusicPanel";
import { GlobalBottomBar } from "@/components/GlobalBottomBar/GlobalBottomBar";
import { ScheduleSettings } from "@/features/announcement/components/ScheduleSettings/ScheduleSettings";
import { UpdateNotification } from "@/components/UpdateNotification/UpdateNotification";
import { useUpdater } from "@/hooks/useUpdater";
import {
  Megaphone,
  Music,
  Gamepad2,
  LogOut,
  Utensils,
  ListMusic,
  PlusCircle,
  ChevronRight,
  Disc,
  Clock
} from "lucide-react";

function App() {
  const currentTime = useKoreanClock();
  const { playingId, progress, volume: anncVolume, play, stop, seek, setVolume: setAnncVolume } = useAudioPlayer();
  const [schedules, setSchedules] = useState<Record<string, Schedule>>(loadSettings);
  const [openSettingsId, setOpenSettingsId] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<string>("all-announcements");

  const bgMusic = useBgMusic();
  const updater = useUpdater();

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

  const handleNavigateToPlayingPlaylist = useCallback(() => {
    if (bgMusic.playingPlaylistId) {
      bgMusic.setCurrentPlaylist(bgMusic.playingPlaylistId);
      setActiveTab(`playlist-${bgMusic.playingPlaylistId}`);
    } else {
      bgMusic.setCurrentPlaylist(null);
      setActiveTab("all-bg-music");
    }
  }, [bgMusic]);

  let activeTitle = "";
  let content = null;

  if (activeTab === "all-announcements") {
    activeTitle = "전체 안내 방송";
    content = (
      <div className="all-categories-container">
        {categories.map(cat => (
          <div key={cat} className="category-group">
            <h2 className="category-title">{CATEGORY_LABELS[cat]}</h2>
            <CategorySection
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
            />
          </div>
        ))}
      </div>
    );
  } else if (categories.includes(activeTab as any)) {
    activeTitle = `안내 방송 > ${CATEGORY_LABELS[activeTab as keyof typeof CATEGORY_LABELS]}`;
    content = (
      <CategorySection
        category={activeTab as keyof typeof CATEGORY_LABELS}
        announcements={ANNOUNCEMENTS_BY_CATEGORY[activeTab as keyof typeof CATEGORY_LABELS]}
        schedules={schedules}
        playingId={playingId}
        progress={progress}
        openSettingsId={openSettingsId}
        onPlay={play}
        onStop={stop}
        onSeek={seek}
        onToggleSettings={toggleSettings}
      />
    );
  } else if (activeTab === "all-bg-music" || activeTab.startsWith("playlist-")) {
    const pId = activeTab === "all-bg-music" ? null : activeTab.replace("playlist-", "");
    const playlist = bgMusic.playlists.find(p => p.id === pId);

    activeTitle = playlist ? `배경 음악 > ${playlist.name}` : "배경 음악 목록";

    content = (
      <BgMusicPanel
        tracks={bgMusic.tracks}
        playlists={bgMusic.playlists}
        currentPlaylistId={pId}
        currentPlaylist={playlist || null}
        playingPlaylistId={bgMusic.playingPlaylistId}
        currentTrackIndex={bgMusic.currentTrackIndex}
        isPlaying={bgMusic.isPlaying}
        autoplay={bgMusic.autoplay}
        loopAll={bgMusic.loopAll}
        onAddTrack={handleAddTrack}
        onRemoveTrack={bgMusic.removeTrack}
        onCreatePlaylist={(name) => {
          bgMusic.createPlaylist(name);
          // Optional: automatically select it
        }}
        onDeletePlaylist={(id) => {
          bgMusic.deletePlaylist(id);
          if (activeTab === `playlist-${id}`) setActiveTab("all-bg-music");
        }}
        onSetCurrentPlaylist={(id) => {
          if (id === bgMusic.currentPlaylistId) {
            bgMusic.setCurrentPlaylist(null);
            setActiveTab("all-bg-music");
          } else {
            bgMusic.setCurrentPlaylist(id);
            if (id) setActiveTab(`playlist-${id}`);
            else setActiveTab("all-bg-music");
          }
        }}
        onSetLoop={bgMusic.setLoop}
        onAddToPlaylist={bgMusic.addTrackToPlaylist}
        onRemoveFromPlaylist={bgMusic.removeTrackFromPlaylist}
        onReorderTrack={bgMusic.reorderTrack}
        onSetPlaylistTracks={bgMusic.setPlaylistTracks}
        onPlay={bgMusic.play}
        onSetAutoplay={bgMusic.setAutoplay}
      />
    );
  }

  // Set initial playlist if bgmusic selected and no playlist, but side menu handles click

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <img src="logo.png" alt="고고 다이노" className="logo" />
        </div>
        <nav className="sidebar-nav">
          <div className="nav-group">
            <button
              className={`nav-group-title-btn ${activeTab === 'all-announcements' ? 'active' : ''}`}
              onClick={() => setActiveTab('all-announcements')}
            >
              <Megaphone size={18} />
              <span>안내 방송</span>
            </button>
            <div className="nav-items-container">
              {categories.map((cat) => (
                <button
                  key={cat}
                  className={`nav-item ${activeTab === cat ? 'active' : ''}`}
                  onClick={() => setActiveTab(cat)}
                >
                  <div className="nav-icon-wrapper">
                    {cat === 'attraction' && <Gamepad2 size={16} />}
                    {cat === 'closing' && <LogOut size={16} />}
                    {cat === 'table' && <Utensils size={16} />}
                  </div>
                  <span className="nav-label">{CATEGORY_LABELS[cat]}</span>
                  <ChevronRight className="chevron" size={14} />
                </button>
              ))}
            </div>
          </div>
          <div className="nav-group">
            <button
              className={`nav-group-title-btn ${activeTab === 'all-bg-music' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('all-bg-music');
                bgMusic.setCurrentPlaylist(null);
              }}
            >
              <Music size={18} />
              <span>배경 음악</span>
            </button>
            <div className="nav-items-container">
              {bgMusic.playlists.map(p => (
                <button
                  key={p.id}
                  className={`nav-item ${activeTab === `playlist-${p.id}` ? 'active' : ''}`}
                  onClick={() => {
                    if (activeTab === `playlist-${p.id}`) {
                      setActiveTab("all-bg-music");
                    } else {
                      setActiveTab(`playlist-${p.id}`);
                      bgMusic.setCurrentPlaylist(p.id);
                    }
                  }}
                >
                  <div className="nav-icon-wrapper">
                    <ListMusic size={16} />
                  </div>
                  <span className="nav-label">{p.name}</span>
                  {bgMusic.isPlaying && bgMusic.playingPlaylistId === p.id ? (
                    <div className="playing-indicator">
                      <Disc className="rotating-disc" size={14} />
                    </div>
                  ) : (
                    <ChevronRight className="chevron" size={14} />
                  )}
                </button>
              ))}
              {bgMusic.playlists.length === 0 && activeTab !== 'all-bg-music' && (
                <button
                  className={`nav-item ${activeTab === 'playlist-empty' ? 'active' : ''}`}
                  onClick={() => setActiveTab('all-bg-music')}
                >
                  <div className="nav-icon-wrapper">
                    <PlusCircle size={16} />
                  </div>
                  <span className="nav-label">새 플레이리스트</span>
                </button>
              )}
            </div>
          </div>
        </nav>
      </aside>

      {/* Main Content */}
      <div className="main-area">
        <header className="main-header">
          <h1>{activeTitle || "배경 음악"}</h1>
          <div className="current-time">
            <Clock size={20} className="clock-icon" />
            <span>{formatTime(currentTime)}</span>
          </div>
        </header>
        <main className="content-area">
          {content || (bgMusic.playlists.length === 0 ? (
            <BgMusicPanel
              tracks={bgMusic.tracks}
              playlists={bgMusic.playlists}
              currentPlaylistId={null}
              currentPlaylist={null}
              currentTrackIndex={bgMusic.currentTrackIndex}
              isPlaying={bgMusic.isPlaying}
              autoplay={bgMusic.autoplay}
              loopAll={bgMusic.loopAll}
              onAddTrack={handleAddTrack}
              onRemoveTrack={bgMusic.removeTrack}
              onCreatePlaylist={(name) => {
                bgMusic.createPlaylist(name);
                // When created, it will automatically populate playlist list, but we don't know the ID yet.
              }}
              onDeletePlaylist={bgMusic.deletePlaylist}
              onSetCurrentPlaylist={bgMusic.setCurrentPlaylist}
              onSetLoop={bgMusic.setLoop}
              onAddToPlaylist={bgMusic.addTrackToPlaylist}
              onRemoveFromPlaylist={bgMusic.removeTrackFromPlaylist}
              onReorderTrack={bgMusic.reorderTrack}
              onSetPlaylistTracks={bgMusic.setPlaylistTracks}
              onPlay={bgMusic.play}
              onSetAutoplay={bgMusic.setAutoplay}
            />
          ) : null)}
        </main>
      </div>

      <GlobalBottomBar
        currentTrack={bgMusic.currentTrack}
        isPlaying={bgMusic.isPlaying}
        progress={bgMusic.progress}
        anncVolume={anncVolume}
        bgmVolume={bgMusic.volume}
        autoplay={bgMusic.autoplay}
        loop={bgMusic.currentPlaylist ? bgMusic.currentPlaylist.loop : bgMusic.loopAll}
        onPrev={bgMusic.prev}
        onTogglePlay={bgMusic.togglePlay}
        onNext={bgMusic.next}
        onSeek={bgMusic.seek}
        onSetAnncVolume={setAnncVolume}
        onSetBgmVolume={bgMusic.setVolume}
        onToggleAutoplay={() => bgMusic.setAutoplay(!bgMusic.autoplay)}
        onToggleLoop={() => bgMusic.setLoop(bgMusic.playingPlaylistId, !(bgMusic.currentPlaylist ? bgMusic.currentPlaylist.loop : bgMusic.loopAll))}
        onNavigateToPlayingPlaylist={handleNavigateToPlayingPlaylist}
      />

      {openSettingsId && (
        <ScheduleSettings
          announcementTitle={ANNOUNCEMENT_DEFS.find(a => a.id === openSettingsId)?.title || ""}
          schedule={schedules[openSettingsId]}
          onChange={(update) => updateSchedule(openSettingsId, update)}
          onClose={() => setOpenSettingsId(null)}
        />
      )}

      <UpdateNotification
        status={updater.status}
        updateInfo={updater.updateInfo}
        downloadProgress={updater.downloadProgress}
        errorMessage={updater.errorMessage}
        onDownload={updater.downloadUpdate}
        onInstall={updater.installUpdate}
        onDismiss={updater.dismiss}
      />
    </div>
  );
}

export default App;
