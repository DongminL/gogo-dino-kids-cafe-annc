import React, { useState } from "react";
import styles from "@/features/announcement/components/CategorySection/CategorySection.module.scss";
import type { AnnouncementDef } from "@/features/announcement/types/announcement";
import { CATEGORY_LABELS } from "@/features/announcement/announcements";
import { AnnouncementCard } from "@/features/announcement/components/AnnouncementCard/AnnouncementCard";
import { CustomAnnouncementModal } from "@/features/announcement/components/CustomAnnouncementModal/CustomAnnouncementModal";
import { useAudioPlayerStore } from "@/features/announcement/stores/useAudioPlayerStore";
import { useAnnouncementStore } from "@/features/announcement/stores/useAnnouncementStore";

interface CategorySectionProps {
  category: keyof typeof CATEGORY_LABELS;
  announcements: AnnouncementDef[];
}

export function CategorySection({
  category,
  announcements,
}: CategorySectionProps): React.ReactNode {
  const { playingId, progress, play, stop, seek } = useAudioPlayerStore();
  const { schedules, openSettingsId, toggleSettings, customDefs, removeCustom } = useAnnouncementStore();
  const [showModal, setShowModal] = useState(false);

  const allAnnouncements = [
    ...announcements,
    ...customDefs.filter((d) => d.category === category),
  ];

  return (
    <section className={styles.categorySection}>
      <div className={styles.announcements}>
        {allAnnouncements.map((ann) => (
          <AnnouncementCard
            key={ann.id}
            ann={ann}
            schedule={schedules[ann.id] ?? ann.defaultSchedule}
            isPlaying={playingId === ann.id}
            isSettingsOpen={openSettingsId === ann.id}
            progress={progress}
            onPlay={() => play(ann)}
            onStop={stop}
            onSeek={seek}
            onToggleSettings={() => toggleSettings(ann.id)}
            onDelete={ann.isCustom ? () => removeCustom(ann.id) : undefined}
          />
        ))}
      </div>
      <button className={styles.btnAddCustom} onClick={() => setShowModal(true)}>
        + 방송 만들기
      </button>
      {showModal && (
        <CustomAnnouncementModal initialCategory={category} onClose={() => setShowModal(false)} />
      )}
    </section>
  );
}
