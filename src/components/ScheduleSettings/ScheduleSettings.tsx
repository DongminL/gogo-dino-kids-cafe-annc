import React, { useState, useEffect } from "react";
import "./ScheduleSettings.scss";
import type { Schedule, ScheduleType } from "../../types/schedule";
import { TimePicker } from "../TimePicker/TimePicker";

interface ScheduleSettingsProps {
  announcementTitle: string;
  schedule: Schedule;
  onChange: (update: Partial<Schedule>) => void;
  onClose: () => void;
}

export function ScheduleSettings({
  announcementTitle,
  schedule,
  onChange,
  onClose,
}: ScheduleSettingsProps): React.ReactNode {
  const [draft, setDraft] = useState<Schedule>(schedule);

  // Sync state if external schedule changes (e.g. initial load)
  useEffect(() => {
    setDraft(schedule);
  }, [schedule]);

  const handleConfirm = () => {
    onChange(draft);
    onClose();
  };

  const handleCancel = () => {
    setDraft(schedule);
    onClose();
  };

  const updateDraft = (update: Partial<Schedule>) => {
    setDraft((prev) => ({ ...prev, ...update }));
  };

  // Extract hour and minute from "HH:mm"
  const timeParts = draft.time ? draft.time.split(":") : ["00", "00"];
  const hour = timeParts[0] || "00";
  const minute = timeParts[1] || "00";

  const isTimeBased = ["once", "odd-hour", "even-hour"].includes(draft.type);
  const uiType = isTimeBased ? "time" : "interval";

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{announcementTitle} 방송 설정</h2>
          <button className="btn-close-x" onClick={onClose}>&times;</button>
        </div>

        <div className="settings-panel">
          <div className="settings-row">
            <span className="settings-label">자동 재생</span>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={draft.enabled}
                onChange={(e) => updateDraft({ enabled: e.target.checked })}
              />
              <span className="toggle-slider" />
            </label>
          </div>

          {draft.enabled && (
            <>
              <div className="settings-row">
                <span className="settings-label">재생 유형</span>
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
                  className="settings-select"
                >
                  <option value="time">시각 설정</option>
                  <option value="interval">반복 간격</option>
                </select>
              </div>

              {isTimeBased && (
                <div className="settings-row" style={{ flexDirection: "column", alignItems: "flex-start", gap: "8px" }}>
                  <span className="settings-label">재생 시각</span>
                  <TimePicker
                    mode={draft.type as "once" | "odd-hour" | "even-hour"}
                    hour={hour}
                    minute={minute}
                    onChange={(mode, h, m) => updateDraft({ type: mode, time: `${h}:${m}` })}
                  />
                </div>
              )}

              {draft.type === "interval" && (
                <div className="settings-row">
                  <span className="settings-label">간격 (분)</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={draft.intervalMinutes || ""}
                    onChange={(e) => {
                      // Remove non-numeric characters and then leading zeros
                      const val = e.target.value.replace(/[^0-9]/g, "").replace(/^0+/, "");
                      updateDraft({ intervalMinutes: val === "" ? 0 : Number(val) });
                    }}
                    onBlur={() => {
                      // Ensure value is within bounds when leaving the input
                      let val = draft.intervalMinutes;
                      if (val < 1) val = 1;
                      if (val > 180) val = 180;
                      updateDraft({ intervalMinutes: val });
                    }}
                    className="settings-input settings-input-number"
                  />
                </div>
              )}
            </>
          )}
        </div>

        <div className="modal-footer">
          <div className="settings-actions">
            <button className="btn-cancel" onClick={handleCancel}>취소</button>
            <button className="btn-confirm" onClick={handleConfirm}>확인</button>
          </div>
        </div>
      </div>
    </div>
  );
}
