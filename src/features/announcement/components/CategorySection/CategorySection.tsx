import React from "react";
import styles from "./CategorySection.module.scss";
import type { AnnouncementDef } from "@/features/announcement/types/announcement";
import { CATEGORY_LABELS } from "@/constants";
import { AnnouncementCard } from "@/features/announcement/components/AnnouncementCard/AnnouncementCard";
import { useAudioPlayerStore } from "@/features/announcement/stores/useAudioPlayerStore";
import { useAnnouncementStore } from "@/features/announcement/stores/useAnnouncementStore";

interface CategorySectionProps {
  category: keyof typeof CATEGORY_LABELS;
  announcements: AnnouncementDef[];
}

export function CategorySection({
  category: _category,
  announcements,
}: CategorySectionProps): React.ReactNode {
  const { playingId, progress, play, stop, seek } = useAudioPlayerStore();
  const { schedules, openSettingsId, toggleSettings } = useAnnouncementStore();

  return (
    <section className={styles.categorySection}>
      <div className={styles.announcements}>
        {announcements.map((ann) => (
          <AnnouncementCard
            key={ann.id}
            ann={ann}
            schedule={schedules[ann.id]}
            isPlaying={playingId === ann.id}
            isSettingsOpen={openSettingsId === ann.id}
            progress={progress}
            onPlay={() => play(ann)}
            onStop={stop}
            onSeek={seek}
            onToggleSettings={() => toggleSettings(ann.id)}
          />
        ))}
      </div>
    </section>
  );
}
