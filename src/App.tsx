import React, { useEffect } from "react";
import clsx from "clsx";
import styles from "./App.module.scss";
import { ANNOUNCEMENTS_BY_CATEGORY, CATEGORY_LABELS } from "@/constants";
import { formatTime } from "@/utils";
import { useKoreanClock } from "@/hooks/useKoreanClock";
import { useScheduler, getDayType } from "@/features/announcement/hooks/useScheduler";
import { CategorySection } from "@/features/announcement/components/CategorySection/CategorySection";
import { BgMusicPanel } from "@/features/bg-music/components/BgMusicPanel/BgMusicPanel";
import { GlobalBottomBar } from "@/components/GlobalBottomBar/GlobalBottomBar";
import { ScheduleSettings } from "@/features/announcement/components/ScheduleSettings/ScheduleSettings";
import { AnnouncementTimeRangeSettings } from "@/features/announcement/components/AnnouncementTimeRangeSettings/AnnouncementTimeRangeSettings";
import { UpdateNotification } from "@/components/UpdateNotification/UpdateNotification";
import { SupportModal } from "@/components/SupportModal/SupportModal";
import { useAnnouncementStore } from "@/features/announcement/stores/useAnnouncementStore";
import { useAudioPlayerStore } from "@/features/announcement/stores/useAudioPlayerStore";
import { useBgMusicStore } from "@/features/bg-music/stores/useBgMusicStore";
import { useUIStore } from "@/stores/useUIStore";
import { useUpdaterStore } from "@/stores/useUpdaterStore";
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

  // ─── Stores ────────────────────────────────────────────────────────────────
  const { schedules, timeRangeSettings, dayTypeOverride, setShowTimeRangeSettings } = useAnnouncementStore();
  const { playingId, play } = useAudioPlayerStore();
  const bgMusic = useBgMusicStore();
  const { activeTab, setActiveTab, showSupportModal, setShowSupportModal } = useUIStore();
  const { init: initUpdater } = useUpdaterStore();

  // ─── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    bgMusic.init();
    initUpdater();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Fade background music when announcement plays/stops ──────────────────
  useEffect(() => {
    if (playingId) {
      bgMusic.fadeOut();
    } else {
      bgMusic.fadeIn();
    }
  }, [playingId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Scheduler ────────────────────────────────────────────────────────────
  const detectedDayType = getDayType(currentTime);
  const effectiveDayType = dayTypeOverride ?? detectedDayType;
  useScheduler(currentTime, schedules, timeRangeSettings, effectiveDayType, play);

  // ─── Content routing ──────────────────────────────────────────────────────
  const categories = Object.keys(CATEGORY_LABELS) as (keyof typeof CATEGORY_LABELS)[];
  const isAnnouncementTab = activeTab === "all-announcements" || categories.includes(activeTab as keyof typeof CATEGORY_LABELS);

  const bgmSettings = bgMusic.settings;

  let activeTitle = "";
  let content = null;

  if (activeTab === "all-announcements") {
    activeTitle = "전체 안내 방송";
    content = (
      <div className={styles.allCategoriesContainer}>
        {categories.map((cat) => (
          <div key={cat} className={styles.categoryGroup}>
            <h2 className={styles.categoryTitle}>{CATEGORY_LABELS[cat]}</h2>
            <CategorySection
              category={cat}
              announcements={ANNOUNCEMENTS_BY_CATEGORY[cat]}
            />
          </div>
        ))}
      </div>
    );
  } else if (categories.includes(activeTab as keyof typeof CATEGORY_LABELS)) {
    activeTitle = `안내 방송 > ${CATEGORY_LABELS[activeTab as keyof typeof CATEGORY_LABELS]}`;
    content = (
      <CategorySection
        category={activeTab as keyof typeof CATEGORY_LABELS}
        announcements={ANNOUNCEMENTS_BY_CATEGORY[activeTab as keyof typeof CATEGORY_LABELS]}
      />
    );
  } else if (activeTab === "all-bg-music" || activeTab.startsWith("playlist-")) {
    const pId = activeTab === "all-bg-music" ? null : activeTab.replace("playlist-", "");
    const playlist = bgmSettings.playlists.find((p) => p.id === pId);

    activeTitle = playlist ? `배경 음악 > ${playlist.name}` : "배경 음악 목록";

    content = (
      <BgMusicPanel
        tracks={bgmSettings.trackMeta}
        playlists={bgmSettings.playlists}
        currentPlaylistId={pId}
        currentPlaylist={playlist || null}
        playingPlaylistId={bgMusic.playingPlaylistId}
        currentTrackIndex={bgMusic.playingTrackIndex}
        isPlaying={bgMusic.isPlaying}
        autoplay={bgmSettings.autoplay}
        loopAll={bgmSettings.loopAll}
        onAddTrack={(file, onProgress) =>
          bgMusic.addTrack(file, bgmSettings.currentPlaylistId ?? undefined, onProgress)
        }
        onRemoveTrack={bgMusic.removeTrack}
        onCreatePlaylist={(name) => { bgMusic.createPlaylist(name); }}
        onDeletePlaylist={(id) => {
          bgMusic.deletePlaylist(id);
          if (activeTab === `playlist-${id}`) setActiveTab("all-bg-music");
        }}
        onSetCurrentPlaylist={(id) => {
          if (id === bgmSettings.currentPlaylistId) {
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
              className={clsx(styles.navGroupTitleBtn, activeTab === "all-announcements" && styles.active)}
              onClick={() => setActiveTab("all-announcements")}
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
                    {cat === "attraction" && <Gamepad2 size={16} />}
                    {cat === "closing" && <LogOut size={16} />}
                    {cat === "table" && <Utensils size={16} />}
                  </div>
                  <span className={styles.navLabel}>{CATEGORY_LABELS[cat]}</span>
                  <ChevronRight className={styles.chevron} size={14} />
                </button>
              ))}
            </div>
          </div>
          <div className={styles.navGroup}>
            <button
              className={clsx(styles.navGroupTitleBtn, activeTab === "all-bg-music" && styles.active)}
              onClick={() => {
                setActiveTab("all-bg-music");
                bgMusic.setCurrentPlaylist(null);
              }}
            >
              <Music size={18} />
              <span>배경 음악</span>
            </button>
            <div className={styles.navItemsContainer}>
              {bgmSettings.playlists.map((p) => (
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
              {bgmSettings.playlists.length === 0 && activeTab !== "all-bg-music" && (
                <button
                  className={clsx(styles.navItem, activeTab === "playlist-empty" && styles.active)}
                  onClick={() => setActiveTab("all-bg-music")}
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
          {content || (bgmSettings.playlists.length === 0 ? (
            <BgMusicPanel
              tracks={bgmSettings.trackMeta}
              playlists={bgmSettings.playlists}
              currentPlaylistId={null}
              currentPlaylist={null}
              currentTrackIndex={bgMusic.playingTrackIndex}
              isPlaying={bgMusic.isPlaying}
              autoplay={bgmSettings.autoplay}
              loopAll={bgmSettings.loopAll}
              onAddTrack={(file, onProgress) => bgMusic.addTrack(file, undefined, onProgress)}
              onRemoveTrack={bgMusic.removeTrack}
              onCreatePlaylist={(name) => { bgMusic.createPlaylist(name); }}
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

      <GlobalBottomBar />

      <ScheduleSettings />
      <AnnouncementTimeRangeSettings />

      {showSupportModal && (
        <SupportModal
          type={showSupportModal}
          onClose={() => setShowSupportModal(null)}
        />
      )}

      <UpdateNotification />
    </div>
  );
}

export default App;
