import React from "react";
import clsx from "clsx";
import styles from "@/features/announcement/components/AnnouncementCard/AnnouncementCard.module.scss";
import { isBrokenCustom, type AnnouncementDef } from "@/features/announcement/types/announcement";
import type { Schedule } from "@/features/announcement/types/schedule";
import { getScheduleLabel } from "@/utils";
import { AudioControls } from "@/components/AudioControls/AudioControls";
interface AnnouncementCardProps {
  ann: AnnouncementDef;
  schedule: Schedule;
  isPlaying: boolean;
  isSettingsOpen: boolean;
  progress: { current: number; duration: number };
  onPlay: () => void;
  onStop: () => void;
  onSeek: (time: number) => void;
  onToggleSettings: () => void;
  onDelete?: () => void;
}

export function AnnouncementCard({
  ann,
  schedule,
  isPlaying,
  isSettingsOpen,
  progress,
  onPlay,
  onStop,
  onSeek,
  onToggleSettings,
  onDelete,
}: AnnouncementCardProps): React.ReactNode {
  const isScheduleActive = schedule.enabled;
  const isBroken = isBrokenCustom(ann);

  return (
    <div className={clsx(styles.announcementCard, isPlaying && styles.playing)}>
      <div className={styles.cardHeader}>
        <div className={styles.announcementTitle}>
          {ann.title}
          {ann.isCustom && <span className={styles.customBadge}>커스텀</span>}
        </div>
        <div className={styles.cardHeaderActions}>
          {onDelete && (
            <button className={styles.deleteToggle} onClick={onDelete} title="삭제">
              &#128465;
            </button>
          )}
          <button
            className={clsx(styles.settingsToggle, isSettingsOpen && styles.active)}
            onClick={onToggleSettings}
            title="스케줄 설정"
          >
            &#9881;
          </button>
        </div>
      </div>

      <div className={styles.scheduleInfo}>
        <span className={clsx(styles.scheduleBadge, isScheduleActive && styles.active)}>
          {isBroken ? "음성 생성 실패" : getScheduleLabel(schedule)}
        </span>
      </div>

      {isPlaying && (
        <AudioControls
          current={progress.current}
          duration={progress.duration}
          onSeek={onSeek}
        />
      )}

      <div className={styles.cardActions}>
        {isPlaying ? (
          <button className={styles.stopButton} onClick={onStop}>
            &#9632; 정지
          </button>
        ) : (
          <button className={styles.playButton} onClick={onPlay} disabled={isBroken}>
            &#9654; 재생
          </button>
        )}
      </div>
    </div>
  );
}
