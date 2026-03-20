import React from "react";
import "./AudioControls.scss";
import { formatDuration } from "../../utils";

interface AudioControlsProps {
  current: number;
  duration: number;
  onSeek: (time: number) => void;
}

export function AudioControls(
  { current, duration, onSeek }: AudioControlsProps
): React.ReactNode {
  return (
    <div className="audio-controls">
      <input
        type="range"
        className="seek-bar"
        min={0}
        max={duration || 0}
        step={0.1}
        value={current}
        onChange={(e) => onSeek(Number(e.target.value))}
      />
      <div className="time-display">
        <span>{formatDuration(current)}</span>
        <span>{formatDuration(duration)}</span>
      </div>
    </div>
  );
}
