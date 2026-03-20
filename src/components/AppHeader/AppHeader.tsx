import React from "react";
import "./AppHeader.scss";
import { VolumeControl } from "../VolumeControl/VolumeControl";
import { formatTime } from "../../utils";

interface AppHeaderProps {
  currentTime: Date;
  volume: number;
  onVolumeChange: (volume: number) => void;
}

export function AppHeader(
  { currentTime, volume, onVolumeChange }: AppHeaderProps
): React.ReactNode {
  return (
    <header className="app-header">
      <img src="logo.png" alt="고고 다이노" className="logo" />
      <div className="header-info">
        <h1>고고 다이노 안내 방송</h1>
        <div className="current-time">{formatTime(currentTime)}</div>
      </div>
      <VolumeControl volume={volume} onChange={onVolumeChange} />
    </header>
  );
}
