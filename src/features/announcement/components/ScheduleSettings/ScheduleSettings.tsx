import React, { useState, useEffect } from "react";
import clsx from "clsx";
import styles from "@/features/announcement/components/ScheduleSettings/ScheduleSettings.module.scss";
import type { Schedule, ScheduleType } from "@/features/announcement/types/schedule";
import { TimePicker } from "@/components/TimePicker/TimePicker";
import { useAnnouncementStore } from "@/features/announcement/stores/useAnnouncementStore";
import { ANNOUNCEMENT_DEFS } from "@/features/announcement/announcements";

export function ScheduleSettings(): React.ReactNode {
  const { openSettingsId, schedules, updateSchedule, toggleSettings } = useAnnouncementStore();

  const schedule = openSettingsId ? schedules[openSettingsId] : null;
  const announcementTitle = openSettingsId
    ? (ANNOUNCEMENT_DEFS.find((a) => a.id === openSettingsId)?.title ?? "")
    : "";

  const [draft, setDraft] = useState<Schedule | null>(schedule);

  useEffect(() => {
    setDraft(schedule);
  }, [schedule]);

  if (!openSettingsId || !draft) return null;

  const onClose = () => toggleSettings(openSettingsId);

  const handleConfirm = () => {
    updateSchedule(openSettingsId, draft);
    onClose();
  };

  const handleCancel = () => {
    setDraft(schedule);
    onClose();
  };

  const updateDraft = (update: Partial<Schedule>) => {
    setDraft((prev) => prev ? { ...prev, ...update } : prev);
  };

  const timeParts = draft.time ? draft.time.split(":") : ["00", "00"];
  const hour = timeParts[0] || "00";
  const minute = timeParts[1] || "00";

  const isTimeBased = ["once", "odd-hour", "even-hour"].includes(draft.type);
  const uiType = isTimeBased ? "time" : "interval";

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContainer} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>{announcementTitle} 방송 설정</h2>
          <button className={styles.btnCloseX} onClick={onClose}>&times;</button>
        </div>

        <div className={styles.settingsPanel}>
          <div className={styles.settingsRow}>
            <span className={styles.settingsLabel}>자동 재생</span>
            <label className={styles.toggleSwitch}>
              <input
                type="checkbox"
                checked={draft.enabled}
                onChange={(e) => updateDraft({ enabled: e.target.checked })}
              />
              <span className={styles.toggleSlider} />
            </label>
          </div>

          {draft.enabled && (
            <>
              <div className={styles.settingsRow}>
                <span className={styles.settingsLabel}>재생 유형</span>
                <select
                  value={uiType}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "time") {
                      updateDraft({ type: "once" });
                    } else {
                      updateDraft({ type: "interval" });
                    }
                  }}
                  className={styles.settingsSelect}
                >
                  <option value="time">시각 설정</option>
                  <option value="interval">반복 간격</option>
                </select>
              </div>

              {isTimeBased && (
                <div className={styles.settingsRow} style={{ flexDirection: "column", alignItems: "flex-start", gap: "8px" }}>
                  <span className={styles.settingsLabel}>재생 시각</span>
                  <TimePicker
                    mode={draft.type as "once" | "odd-hour" | "even-hour"}
                    hour={hour}
                    minute={minute}
                    onChange={(mode, h, m) => updateDraft({ type: mode as ScheduleType, time: `${h}:${m}` })}
                  />
                </div>
              )}

              {draft.type === "interval" && (
                <div className={styles.settingsRow}>
                  <span className={styles.settingsLabel}>간격 (분)</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={draft.intervalMinutes || ""}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9]/g, "").replace(/^0+/, "");
                      updateDraft({ intervalMinutes: val === "" ? 0 : Number(val) });
                    }}
                    onBlur={() => {
                      let val = draft.intervalMinutes;
                      if (val < 1) val = 1;
                      if (val > 180) val = 180;
                      updateDraft({ intervalMinutes: val });
                    }}
                    className={clsx(styles.settingsInput, styles.settingsInputNumber)}
                  />
                </div>
              )}
            </>
          )}
        </div>

        <div className={styles.modalFooter}>
          <div className={styles.settingsActions}>
            <button className={styles.btnCancel} onClick={handleCancel}>취소</button>
            <button className={styles.btnConfirm} onClick={handleConfirm}>확인</button>
          </div>
        </div>
      </div>
    </div>
  );
}
