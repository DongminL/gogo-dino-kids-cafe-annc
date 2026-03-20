import React from "react";
import "./VolumeControl.scss";

interface VolumeControlProps {
  volume: number;
  onChange: (volume: number) => void;
}

export function VolumeControl(
  { volume, onChange }: VolumeControlProps
): React.ReactNode {
  return (
    <div className="volume-control">
      <span className="volume-label">볼륨</span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={volume}
        onChange={(e) => onChange(Number(e.target.value))}
        className="volume-slider"
      />
      <span className="volume-value">{Math.round(volume * 100)}%</span>
    </div>
  );
}
