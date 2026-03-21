import React from "react";
import "./CategorySection.scss";
import type { AnnouncementDef } from "../../types/announcement";
import type { Schedule } from "../../types/schedule";
import { CATEGORY_LABELS } from "../../constants";
import { AnnouncementCard } from "../AnnouncementCard/AnnouncementCard";

interface CategorySectionProps {
  category: keyof typeof CATEGORY_LABELS;
  announcements: AnnouncementDef[];
  schedules: Record<string, Schedule>;
  playingId: string | null;
  progress: { current: number; duration: number };
  openSettingsId: string | null;
  onPlay: (ann: AnnouncementDef) => void;
  onStop: () => void;
  onSeek: (time: number) => void;
  onToggleSettings: (id: string) => void;
}

export function CategorySection({
  category,
  announcements,
  schedules,
  playingId,
  progress,
  openSettingsId,
  onPlay,
  onStop,
  onSeek,
  onToggleSettings,
}: CategorySectionProps): React.ReactNode {
  return (
    <section className="category-section">
      <div className="announcements">
        {announcements.map((ann) => (
          <AnnouncementCard
            key={ann.id}
            ann={ann}
            schedule={schedules[ann.id]}
            isPlaying={playingId === ann.id}
            isSettingsOpen={openSettingsId === ann.id}
            progress={progress}
            onPlay={() => onPlay(ann)}
            onStop={onStop}
            onSeek={onSeek}
            onToggleSettings={() => onToggleSettings(ann.id)}
          />
        ))}
      </div>
    </section>
  );
}
