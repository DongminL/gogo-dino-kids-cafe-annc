import React from "react";
import "./ScheduleSettings.scss";
import type { Schedule, ScheduleType } from "../../types/schedule";
import { SCHEDULE_TYPE_LABELS } from "../../constants";

interface ScheduleSettingsProps {
  schedule: Schedule;
  onChange: (update: Partial<Schedule>) => void;
}

export function ScheduleSettings(
  { schedule, onChange }: ScheduleSettingsProps
): React.ReactNode {
  return (
    <div className="settings-panel">
      <div className="settings-row">
        <span className="settings-label">자동 재생</span>
        <label className="toggle-switch">
          <input
            type="checkbox"
            checked={schedule.enabled}
            onChange={(e) => onChange({ enabled: e.target.checked })}
          />
          <span className="toggle-slider" />
        </label>
      </div>

      {schedule.enabled && (
        <>
          <div className="settings-row">
            <span className="settings-label">재생 유형</span>
            <select
              value={schedule.type}
              onChange={(e) => onChange({ type: e.target.value as ScheduleType })}
              className="settings-select"
            >
              {(Object.keys(SCHEDULE_TYPE_LABELS) as ScheduleType[]).map((t) => (
                <option key={t} value={t}>
                  {SCHEDULE_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>

          {schedule.type === "once" && (
            <div className="settings-row">
              <span className="settings-label">재생 시각</span>
              <input
                type="time"
                value={schedule.time}
                onChange={(e) => onChange({ time: e.target.value })}
                className="settings-input"
              />
            </div>
          )}

          {schedule.type === "interval" && (
            <div className="settings-row">
              <span className="settings-label">간격 (분)</span>
              <input
                type="number"
                min={1}
                max={120}
                value={schedule.intervalMinutes}
                onChange={(e) => onChange({ intervalMinutes: Number(e.target.value) })}
                className="settings-input settings-input-number"
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
