import React, { useRef, useState } from "react";
import "./BgMusicPanel.scss";
import type { Track, Playlist } from "../../types/bgMusic";

function formatTime(sec: number): string {
  if (!isFinite(sec) || isNaN(sec)) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

interface BgMusicPanelProps {
  tracks: Track[];
  playlists: Playlist[];
  currentPlaylistId: string | null;
  currentPlaylist: Playlist | null;
  currentTrack: Track | null;
  currentTrackIndex: number;
  isPlaying: boolean;
  progress: { current: number; duration: number };
  volume: number;
  autoplay: boolean;
  onAddTrack: (file: File) => Promise<void>;
  onRemoveTrack: (trackId: string) => Promise<void>;
  onCreatePlaylist: (name: string) => void;
  onDeletePlaylist: (id: string) => void;
  onSetCurrentPlaylist: (id: string | null) => void;
  onSetLoop: (playlistId: string, loop: boolean) => void;
  onAddToPlaylist: (playlistId: string, trackId: string) => void;
  onRemoveFromPlaylist: (playlistId: string, trackId: string) => void;
  onReorderTrack: (playlistId: string, fromIndex: number, toIndex: number) => void;
  onPlay: (index: number) => void;
  onTogglePlay: () => void;
  onNext: () => void;
  onPrev: () => void;
  onSeek: (time: number) => void;
  onSetVolume: (v: number) => void;
  onSetAutoplay: (v: boolean) => void;
}

export function BgMusicPanel({
  tracks,
  playlists,
  currentPlaylistId,
  currentPlaylist,
  currentTrack,
  currentTrackIndex,
  isPlaying,
  progress,
  volume,
  autoplay,
  onAddTrack,
  onRemoveTrack,
  onCreatePlaylist,
  onDeletePlaylist,
  onSetCurrentPlaylist,
  onSetLoop,
  onAddToPlaylist,
  onRemoveFromPlaylist,
  onReorderTrack,
  onPlay,
  onTogglePlay,
  onNext,
  onPrev,
  onSeek,
  onSetVolume,
  onSetAutoplay,
}: BgMusicPanelProps): React.ReactNode {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [showNewPlaylistInput, setShowNewPlaylistInput] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [selectedLibraryTrackId, setSelectedLibraryTrackId] = useState("");

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setIsAdding(true);
    setAddError(null);
    for (const file of Array.from(files)) {
      try {
        await onAddTrack(file);
      } catch (err) {
        if (err instanceof DOMException && err.name === "QuotaExceededError") {
          setAddError("저장 공간이 부족합니다. 불필요한 음악을 삭제한 후 다시 시도해 주세요.");
        } else {
          setAddError("파일 추가에 실패했습니다.");
        }
        break;
      }
    }
    setIsAdding(false);
    e.target.value = "";
  };

  const handleCreatePlaylist = () => {
    const name = newPlaylistName.trim();
    if (!name) return;
    onCreatePlaylist(name);
    setNewPlaylistName("");
    setShowNewPlaylistInput(false);
  };

  const playlistTracks: Array<{ trackId: string; track: Track | undefined; index: number }> =
    (currentPlaylist?.trackIds ?? []).map((trackId, index) => ({
      trackId,
      track: tracks.find((t) => t.id === trackId),
      index,
    }));

  const playlistTrackIdSet = new Set(currentPlaylist?.trackIds ?? []);
  const libraryOnlyTracks = tracks.filter((t) => !playlistTrackIdSet.has(t.id));

  return (
    <section className="bg-music-panel">
      {/* Playlist bar */}
      <div className="bg-music-playlist-bar">
        <div className="bg-music-playlist-bar__left">
          <span className="bg-music-label">플레이리스트</span>
          <select
            className="bg-music-select"
            value={currentPlaylistId ?? ""}
            onChange={(e) => onSetCurrentPlaylist(e.target.value || null)}
          >
            {playlists.length === 0 && <option value="">— 없음 —</option>}
            {playlists.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          {showNewPlaylistInput ? (
            <div className="bg-music-new-playlist">
              <input
                className="bg-music-input"
                type="text"
                placeholder="플레이리스트 이름"
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreatePlaylist();
                  if (e.key === "Escape") {
                    setShowNewPlaylistInput(false);
                    setNewPlaylistName("");
                  }
                }}
                autoFocus
              />
              <button className="bg-music-btn bg-music-btn--primary" onClick={handleCreatePlaylist}>
                만들기
              </button>
              <button
                className="bg-music-btn"
                onClick={() => {
                  setShowNewPlaylistInput(false);
                  setNewPlaylistName("");
                }}
              >
                취소
              </button>
            </div>
          ) : (
            <button
              className="bg-music-btn bg-music-btn--icon"
              title="새 플레이리스트"
              onClick={() => setShowNewPlaylistInput(true)}
            >
              +
            </button>
          )}

          {currentPlaylist && (
            <button
              className="bg-music-btn bg-music-btn--danger bg-music-btn--icon"
              title="플레이리스트 삭제"
              onClick={() => onDeletePlaylist(currentPlaylist.id)}
            >
              🗑
            </button>
          )}
        </div>

        <div className="bg-music-playlist-bar__right">
          {currentPlaylist && (
            <label className="bg-music-toggle">
              <input
                type="checkbox"
                checked={currentPlaylist.loop}
                onChange={(e) => onSetLoop(currentPlaylist.id, e.target.checked)}
              />
              <span>반복</span>
            </label>
          )}
          <label className="bg-music-toggle">
            <input
              type="checkbox"
              checked={autoplay}
              onChange={(e) => onSetAutoplay(e.target.checked)}
            />
            <span>자동재생</span>
          </label>
        </div>
      </div>

      {/* Track list */}
      <div className="bg-music-track-list">
        {playlistTracks.length === 0 ? (
          <div className="bg-music-empty">
            {currentPlaylist
              ? "음악을 추가하세요"
              : "플레이리스트를 먼저 만드세요"}
          </div>
        ) : (
          playlistTracks.map(({ trackId, track, index }) => (
            <div
              key={trackId}
              className={`bg-music-track-item${index === currentTrackIndex && isPlaying ? " bg-music-track-item--playing" : ""}`}
              onDoubleClick={() => onPlay(index)}
            >
              <span className="bg-music-track-item__num">{index + 1}</span>
              <span className="bg-music-track-item__name">{track?.name ?? trackId}</span>
              <div className="bg-music-track-item__actions">
                <button
                  className="bg-music-btn bg-music-btn--icon bg-music-btn--sm"
                  title="위로"
                  disabled={index === 0}
                  onClick={() =>
                    currentPlaylist && onReorderTrack(currentPlaylist.id, index, index - 1)
                  }
                >
                  ▲
                </button>
                <button
                  className="bg-music-btn bg-music-btn--icon bg-music-btn--sm"
                  title="아래로"
                  disabled={index === playlistTracks.length - 1}
                  onClick={() =>
                    currentPlaylist && onReorderTrack(currentPlaylist.id, index, index + 1)
                  }
                >
                  ▼
                </button>
                <button
                  className="bg-music-btn bg-music-btn--icon bg-music-btn--sm"
                  title="플레이리스트에서 제거"
                  onClick={() =>
                    currentPlaylist && onRemoveFromPlaylist(currentPlaylist.id, trackId)
                  }
                >
                  ✕
                </button>
                <button
                  className="bg-music-btn bg-music-btn--icon bg-music-btn--sm bg-music-btn--danger"
                  title="영구 삭제"
                  onClick={() => onRemoveTrack(trackId)}
                >
                  🗑
                </button>
              </div>
            </div>
          ))
        )}

        {currentPlaylist && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              multiple
              style={{ display: "none" }}
              onChange={handleFileChange}
            />
            <button
              className="bg-music-add-track-btn"
              disabled={isAdding}
              onClick={() => { setAddError(null); fileInputRef.current?.click(); }}
            >
              {isAdding ? "추가 중…" : "+ 파일에서 추가"}
            </button>
            {addError && (
              <div className="bg-music-add-error">{addError}</div>
            )}

            {libraryOnlyTracks.length > 0 && (
              <div className="bg-music-library-add">
                <select
                  className="bg-music-select bg-music-select--grow"
                  value={selectedLibraryTrackId}
                  onChange={(e) => setSelectedLibraryTrackId(e.target.value)}
                >
                  <option value="">라이브러리에서 추가…</option>
                  {libraryOnlyTracks.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <button
                  className="bg-music-btn bg-music-btn--primary"
                  disabled={!selectedLibraryTrackId}
                  onClick={() => {
                    if (selectedLibraryTrackId) {
                      onAddToPlaylist(currentPlaylist.id, selectedLibraryTrackId);
                      setSelectedLibraryTrackId("");
                    }
                  }}
                >
                  추가
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Controls */}
      <div className="bg-music-controls">
        <div className="bg-music-controls__transport">
          <button
            className="bg-music-btn bg-music-btn--transport"
            title="이전"
            disabled={!currentPlaylist || currentPlaylist.trackIds.length === 0}
            onClick={onPrev}
          >
            ⏮
          </button>
          <button
            className="bg-music-btn bg-music-btn--transport bg-music-btn--play"
            title={isPlaying ? "일시정지" : "재생"}
            disabled={!currentPlaylist || currentPlaylist.trackIds.length === 0}
            onClick={onTogglePlay}
          >
            {isPlaying ? "⏸" : "▶"}
          </button>
          <button
            className="bg-music-btn bg-music-btn--transport"
            title="다음"
            disabled={!currentPlaylist || currentPlaylist.trackIds.length === 0}
            onClick={onNext}
          >
            ⏭
          </button>
        </div>

        <div className="bg-music-controls__center">
          <div className="bg-music-controls__track-name">
            {currentTrack ? currentTrack.name : "—"}
          </div>
          <div className="bg-music-seek">
            <span className="bg-music-seek__time">{formatTime(progress.current)}</span>
            <input
              type="range"
              className="bg-music-seek__bar"
              min={0}
              max={progress.duration || 0}
              step={0.5}
              value={progress.current}
              disabled={!progress.duration}
              onChange={(e) => onSeek(Number(e.target.value))}
            />
            <span className="bg-music-seek__time">{formatTime(progress.duration)}</span>
          </div>
        </div>

        <div className="bg-music-controls__volume">
          <span className="bg-music-volume-label">🎵 볼륨</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={volume}
            onChange={(e) => onSetVolume(Number(e.target.value))}
            className="bg-music-volume-slider"
          />
          <span className="bg-music-volume-value">{Math.round(volume * 100)}%</span>
        </div>
      </div>
    </section>
  );
}
