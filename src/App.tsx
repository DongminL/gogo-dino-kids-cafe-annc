import React, { useState, useCallback, useEffect } from "react";
import clsx from "clsx";
import styles from "./App.module.scss";
import type { Schedule } from "@/features/announcement/types/schedule";
import type { AnnouncementTimeRangeSettings, DayType } from "@/features/announcement/types/schedule";
import { ANNOUNCEMENT_DEFS, ANNOUNCEMENTS_BY_CATEGORY, CATEGORY_LABELS, STORAGE_KEY, TIME_RANGE_STORAGE_KEY } from "@/constants";
import { loadSettings, formatTime, loadTimeRangeSettings } from "@/utils";
import { useKoreanClock } from "@/hooks/useKoreanClock";
import { useAudioPlayer } from "@/features/announcement/hooks/useAudioPlayer";
import { useScheduler, getDayType } from "@/features/announcement/hooks/useScheduler";
import { useBgMusic } from "@/features/bg-music/hooks/useBgMusic";
import { CategorySection } from "@/features/announcement/components/CategorySection/CategorySection";
import { BgMusicPanel } from "@/features/bg-music/components/BgMusicPanel/BgMusicPanel";
import { GlobalBottomBar } from "@/components/GlobalBottomBar/GlobalBottomBar";
import { ScheduleSettings } from "@/features/announcement/components/ScheduleSettings/ScheduleSettings";
import { AnnouncementTimeRangeSettings as TimeRangeSettingsModal } from "@/features/announcement/components/AnnouncementTimeRangeSettings/AnnouncementTimeRangeSettings";
import { UpdateNotification } from "@/components/UpdateNotification/UpdateNotification";
import { SupportModal } from "@/components/SupportModal/SupportModal";
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
  CalendarClock,
  BookOpen,
  MessageSquare,
} from "lucide-react";

function App() {
  const currentTime = useKoreanClock();
  const { playingId, progress, volume: anncVolume, play, stop, seek, setVolume: setAnncVolume } = useAudioPlayer();
  const [schedules, setSchedules] = useState<Record<string, Schedule>>(loadSettings);
  const [openSettingsId, setOpenSettingsId] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<string>("all-announcements");

  const [timeRangeSettings, setTimeRangeSettings] = useState<AnnouncementTimeRangeSettings>(loadTimeRangeSettings);
  const [dayTypeOverride, setDayTypeOverride] = useState<DayType | null>(null);
  const [showTimeRangeSettings, setShowTimeRangeSettings] = useState(false);
  const [showSupportModal, setShowSupportModal] = useState<"guide" | "feedback" | null>(null);

  const detectedDayType = getDayType(currentTime);
  const effectiveDayType: DayType = dayTypeOverride ?? detectedDayType;

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

  useEffect(() => {
    localStorage.setItem(TIME_RANGE_STORAGE_KEY, JSON.stringify(timeRangeSettings));
  }, [timeRangeSettings]);

  const updateSchedule = useCallback((id: string, update: Partial<Schedule>) => {
    setSchedules((prev) => ({ ...prev, [id]: { ...prev[id], ...update } }));
  }, []);

  const toggleSettings = useCallback((id: string) => {
    setOpenSettingsId((prev) => (prev === id ? null : id));
  }, []);

  useScheduler(currentTime, schedules, timeRangeSettings, effectiveDayType, play);

  const categories = Object.keys(CATEGORY_LABELS) as (keyof typeof CATEGORY_LABELS)[];

  const isAnnouncementTab = activeTab === "all-announcements" || categories.includes(activeTab as any);

  const handleAddTrack = useCallback(
    (file: File, onProgress?: (progress: number) => void) =>
      bgMusic.addTrack(file, bgMusic.currentPlaylistId ?? undefined, onProgress),
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
      <div className={styles.allCategoriesContainer}>
        {categories.map(cat => (
          <div key={cat} className={styles.categoryGroup}>
            <h2 className={styles.categoryTitle}>{CATEGORY_LABELS[cat]}</h2>
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
    <div className={styles.appContainer}>
      {/* Sidebar */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <img src="logo.png" alt="고고 다이노" className={styles.logo} />
        </div>
        <nav className={styles.sidebarNav}>
          <div className={styles.navGroup}>
            <button
              className={clsx(styles.navGroupTitleBtn, activeTab === 'all-announcements' && styles.active)}
              onClick={() => setActiveTab('all-announcements')}
            >
              <Megaphone size={18} />
              <span>안내 방송</span>
            </button>
            <div className={styles.navItemsContainer}>
              {categories.map((cat) => (
                <button
                  key={cat}
                  className={clsx(styles.navItem, activeTab === cat && styles.active)}
                  onClick={() => setActiveTab(cat)}
                >
                  <div className={styles.navIconWrapper}>
                    {cat === 'attraction' && <Gamepad2 size={16} />}
                    {cat === 'closing' && <LogOut size={16} />}
                    {cat === 'table' && <Utensils size={16} />}
                  </div>
                  <span className={styles.navLabel}>{CATEGORY_LABELS[cat]}</span>
                  <ChevronRight className={styles.chevron} size={14} />
                </button>
              ))}
            </div>
          </div>
          <div className={styles.navGroup}>
            <button
              className={clsx(styles.navGroupTitleBtn, activeTab === 'all-bg-music' && styles.active)}
              onClick={() => {
                setActiveTab('all-bg-music');
                bgMusic.setCurrentPlaylist(null);
              }}
            >
              <Music size={18} />
              <span>배경 음악</span>
            </button>
            <div className={styles.navItemsContainer}>
              {bgMusic.playlists.map(p => (
                <button
                  key={p.id}
                  className={clsx(styles.navItem, activeTab === `playlist-${p.id}` && styles.active)}
                  onClick={() => {
                    if (activeTab === `playlist-${p.id}`) {
                      setActiveTab("all-bg-music");
                    } else {
                      setActiveTab(`playlist-${p.id}`);
                      bgMusic.setCurrentPlaylist(p.id);
                    }
                  }}
                >
                  <div className={styles.navIconWrapper}>
                    <ListMusic size={16} />
                  </div>
                  <span className={styles.navLabel}>{p.name}</span>
                  {bgMusic.isPlaying && bgMusic.playingPlaylistId === p.id ? (
                    <div className={styles.playingIndicator}>
                      <Disc className={styles.rotatingDisc} size={14} />
                    </div>
                  ) : (
                    <ChevronRight className={styles.chevron} size={14} />
                  )}
                </button>
              ))}
              {bgMusic.playlists.length === 0 && activeTab !== 'all-bg-music' && (
                <button
                  className={clsx(styles.navItem, activeTab === 'playlist-empty' && styles.active)}
                  onClick={() => setActiveTab('all-bg-music')}
                >
                  <div className={styles.navIconWrapper}>
                    <PlusCircle size={16} />
                  </div>
                  <span className={styles.navLabel}>새 플레이리스트</span>
                </button>
              )}
            </div>
          </div>
        </nav>
        <div className={styles.sidebarFooter}>
          <button
            className={styles.sidebarFooterBtn}
            onClick={() => setShowSupportModal("guide")}
          >
            <BookOpen size={16} />
            <span>사용 가이드</span>
          </button>
          <button
            className={styles.sidebarFooterBtn}
            onClick={() => setShowSupportModal("feedback")}
          >
            <MessageSquare size={16} />
            <span>건의하기</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className={styles.mainArea}>
        <header className={styles.mainHeader}>
          <h1>{activeTitle || "배경 음악"}</h1>
          <div className={styles.currentTime}>
            <span className={styles.timeText}>{formatTime(currentTime)}</span>
            {isAnnouncementTab && (
              <>
                <div className={styles.timeDivider} />
                <button
                  className={styles.btnTimeRangeSettings}
                  onClick={() => setShowTimeRangeSettings(true)}
                  title="자동 재생 시간대 설정"
                >
                  <CalendarClock size={20} />
                </button>
              </>
            )}
          </div>
        </header>
        <main className={styles.contentArea}>
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

      {showTimeRangeSettings && (
        <TimeRangeSettingsModal
          settings={timeRangeSettings}
          detectedDayType={detectedDayType}
          dayTypeOverride={dayTypeOverride}
          onChangeDayTypeOverride={setDayTypeOverride}
          onChange={setTimeRangeSettings}
          onClose={() => setShowTimeRangeSettings(false)}
        />
      )}

      {showSupportModal && (
        <SupportModal
          type={showSupportModal}
          onClose={() => setShowSupportModal(null)}
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
