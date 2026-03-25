import React from "react";
import "./AnnouncementCard.scss";
import type { AnnouncementDef } from "@/features/announcement/types/announcement";
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
}: AnnouncementCardProps): React.ReactNode {
  const isScheduleActive = schedule.enabled;

  return (
    <div className={`announcement-card${isPlaying ? " playing" : ""}`}>
      <div className="card-header">
        <div className="announcement-title">{ann.title}</div>
        <button
          className={`settings-toggle${isSettingsOpen ? " active" : ""}`}
          onClick={onToggleSettings}
          title="스케줄 설정"
        >
          &#9881;
        </button>
      </div>

      <div className="schedule-info">
        <span className={`schedule-badge${isScheduleActive ? " active" : ""}`}>
          {getScheduleLabel(schedule)}
        </span>
      </div>

      {isPlaying && (
        <AudioControls
          current={progress.current}
          duration={progress.duration}
          onSeek={onSeek}
        />
      )}

      <div className="card-actions">
        {isPlaying ? (
          <button className="stop-button" onClick={onStop}>
            &#9632; 정지
          </button>
        ) : (
          <button className="play-button" onClick={onPlay}>
            &#9654; 재생
          </button>
        )}
      </div>
    </div>
  );
}
