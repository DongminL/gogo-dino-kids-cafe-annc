import React, { useRef, useState, useEffect, useCallback } from "react";
import clsx from "clsx";
import { GripVertical, Trash2, Edit2, Check, X, RotateCcw } from "lucide-react";
import styles from "@/features/bg-music/components/BgMusicPanel/BgMusicPanel.module.scss";
import type { Track, Playlist } from "@/features/bg-music/types/bgMusic";
import { stripExtension } from "@/utils";

interface UploadingItem {
  uploadId: string;
  fileName: string;
  progress: number;
  status: "uploading" | "error" | "done";
  error: string | null;
  file: File;
  playlistId: string | null;
}

interface BgMusicPanelProps {
  tracks: Track[];
  playlists: Playlist[];
  currentPlaylistId: string | null;
  currentPlaylist: Playlist | null;
  playingPlaylistId?: string | null;
  currentTrackIndex: number;
  isPlaying: boolean;
  autoplay: boolean;
  loopAll: boolean;
  onAddTrack: (file: File, onProgress?: (progress: number) => void) => Promise<void>;
  onRemoveTrack: (trackId: string) => Promise<void>;
  onCreatePlaylist: (name: string) => void;
  onDeletePlaylist: (id: string) => void;
  onSetCurrentPlaylist: (id: string | null) => void;
  onSetLoop: (playlistId: string | null, loop: boolean) => void;
  onAddToPlaylist: (playlistId: string, trackId: string) => void;
  onRemoveFromPlaylist: (playlistId: string, index: number) => void;
  onReorderTrack: (playlistId: string | null, fromIndex: number, toIndex: number) => void;
  onSetPlaylistTracks: (playlistId: string | null, trackIds: string[]) => void;
  onPlay: (index: number) => void;
  onSetAutoplay: (v: boolean) => void;
}

export function BgMusicPanel({
  tracks,
  playlists,
  currentPlaylistId,
  currentPlaylist,
  playingPlaylistId,
  currentTrackIndex,
  isPlaying,
  autoplay,
  loopAll,
  onAddTrack,
  onRemoveTrack,
  onCreatePlaylist,
  onDeletePlaylist,
  onSetCurrentPlaylist,
  onSetLoop,
  onAddToPlaylist,
  onRemoveFromPlaylist,
  onReorderTrack,
  onSetPlaylistTracks,
  onPlay,
  onSetAutoplay,
}: BgMusicPanelProps): React.ReactNode {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [showNewPlaylistInput, setShowNewPlaylistInput] = useState(false);
  const [uploadingItems, setUploadingItems] = useState<UploadingItem[]>([]);
  const [showPlaylistMenu, setShowPlaylistMenu] = useState<string | null>(null);

  // Edit Mode State
  const [isEditing, setIsEditing] = useState(false);
  const [editingTrackIds, setEditingTrackIds] = useState<string[]>([]);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const editAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => { uploadTimersRef.current.forEach(clearTimeout); };
  }, []);

  useEffect(() => {
    if (!isEditing) {
      if (currentPlaylist) {
        setEditingTrackIds(currentPlaylist.trackIds);
      } else {
        setEditingTrackIds(tracks.map(t => t.id));
      }
    }
  }, [isEditing, currentPlaylist, tracks]);

  useEffect(() => {
    if (!showPlaylistMenu) return;
    const closeMenu = () => setShowPlaylistMenu(null);
    window.addEventListener("click", closeMenu);
    return () => window.removeEventListener("click", closeMenu);
  }, [showPlaylistMenu]);

  useEffect(() => {
    if (!isEditing) return;

    const handleClickOutside = (e: MouseEvent) => {
      // If clicking inside the edit area, or on the modal, don't cancel
      const target = e.target as HTMLElement;
      const isInside = editAreaRef.current?.contains(target);
      const isModal = target.closest("[data-confirm-modal]");
      if (!isInside && !isModal) {
        setIsEditing(false);
        setDraggedIndex(null);
      }
    };

    // Use setTimeout to avoid immediate cancellation when clicking the 'Edit' button
    const timeout = setTimeout(() => {
      window.addEventListener("mousedown", handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timeout);
      window.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isEditing]);


  const startUpload = useCallback(async (file: File, playlistId: string | null) => {
    const uploadId = `upload-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const fileName = stripExtension(file.name);

    setUploadingItems((prev) => [
      ...prev,
      { uploadId, fileName, progress: 0, status: "uploading", error: null, file, playlistId },
    ]);

    try {
      await onAddTrack(file, (progress) => {
        setUploadingItems((prev) =>
          prev.map((item) => item.uploadId === uploadId ? { ...item, progress } : item)
        );
      });

      setUploadingItems((prev) =>
        prev.map((item) => item.uploadId === uploadId ? { ...item, progress: 100, status: "done" } : item)
      );
      const timer = setTimeout(() => {
        setUploadingItems((prev) => prev.filter((item) => item.uploadId !== uploadId));
      }, 1500);
      uploadTimersRef.current.push(timer);
    } catch (err) {
      const error =
        err instanceof DOMException && err.name === "QuotaExceededError"
          ? "저장 공간이 부족합니다."
          : "파일 추가에 실패했습니다.";
      setUploadingItems((prev) =>
        prev.map((item) => item.uploadId === uploadId ? { ...item, status: "error", error } : item)
      );
    }
  }, [onAddTrack]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    for (const file of Array.from(files)) {
      void startUpload(file, currentPlaylistId);
    }
    e.target.value = "";
  };

  const handleRetryUpload = useCallback((uploadId: string) => {
    const item = uploadingItems.find((i) => i.uploadId === uploadId);
    if (!item) return;
    setUploadingItems((prev) => prev.filter((i) => i.uploadId !== uploadId));
    void startUpload(item.file, item.playlistId);
  }, [uploadingItems, startUpload]);

  const handleCancelUpload = useCallback((uploadId: string) => {
    setUploadingItems((prev) => prev.filter((i) => i.uploadId !== uploadId));
  }, []);

  const handleCreatePlaylist = () => {
    const name = newPlaylistName.trim();
    if (!name) return;
    onCreatePlaylist(name);
    setNewPlaylistName("");
    setShowNewPlaylistInput(false);
  };

  type DeletionTarget =
    | { type: "playlist"; playlistId: string; name: string }
    | { type: "track"; trackId: string; name: string }
    | { type: "rfp"; playlistId: string; trackId: string; index: number; name: string }
    | { type: "edit-rfp"; index: number; name: string };

  const [confirmDelete, setConfirmDelete] = useState<DeletionTarget | null>(null);

  const confirmTimerRef = useRef<NodeJS.Timeout | null>(null);

  const triggerConfirm = (target: DeletionTarget) => {
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);

    // If clicking same thing, toggle off
    if (confirmDelete && confirmDelete.type === target.type) {
      let isSame = false;
      if (target.type === "playlist" && confirmDelete.type === "playlist") {
        isSame = target.playlistId === confirmDelete.playlistId;
      } else if (target.type === "track" && confirmDelete.type === "track") {
        isSame = target.trackId === confirmDelete.trackId;
      } else if (target.type === "rfp" && confirmDelete.type === "rfp") {
        isSame = target.playlistId === confirmDelete.playlistId && target.index === confirmDelete.index;
      } else if (target.type === "edit-rfp" && confirmDelete.type === "edit-rfp") {
        isSame = target.index === confirmDelete.index;
      }

      if (isSame) {
        setConfirmDelete(null);
        return;
      }
    }

    setConfirmDelete(target);
    confirmTimerRef.current = setTimeout(() => {
      setConfirmDelete(null);
      confirmTimerRef.current = null;
    }, 5000);
  };

  const actualDeleteTrack = async (id: string) => {
    await onRemoveTrack(id);
    setConfirmDelete(null);
  };

  const actualDeletePlaylist = (id: string) => {
    onDeletePlaylist(id);
    setConfirmDelete(null);
  };

  const actualRemoveFromPlaylist = (playlistId: string, index: number) => {
    onRemoveFromPlaylist(playlistId, index);
    setConfirmDelete(null);
  };

  const actualRemoveFromEditList = (index: number) => {
    setEditingTrackIds((prev) => {
      const copy = [...prev];
      copy.splice(index, 1);
      return copy;
    });
    setConfirmDelete(null);
  };

  const handleStartEditing = () => {
    setEditingTrackIds(currentPlaylist ? currentPlaylist.trackIds : tracks.map(t => t.id));
    setIsEditing(true);
  };

  const handleFinishEditing = () => {
    onSetPlaylistTracks(currentPlaylist ? currentPlaylist.id : null, editingTrackIds);
    setIsEditing(false);
    setDraggedIndex(null);
  };

  const handleCancelEditing = () => {
    setIsEditing(false);
    setDraggedIndex(null);
  };

  const handleRemoveTrackWhileEditing = (index: number) => {
    const trackId = editingTrackIds[index];
    const track = tracks.find(t => t.id === trackId);
    triggerConfirm({ type: "edit-rfp", index, name: track?.name ?? trackId });
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    // Firefox requires some data to start drag
    e.dataTransfer.setData("text/plain", `${index}`);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newTrackIds = [...editingTrackIds];
    const [moved] = newTrackIds.splice(draggedIndex, 1);
    newTrackIds.splice(index, 0, moved);

    setEditingTrackIds(newTrackIds);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const tracksToDisplay: Array<{ trackId: string; track: Track | undefined; index: number }> =
    isEditing
      ? editingTrackIds.map((id, i) => ({ trackId: id, track: tracks.find(t => t.id === id), index: i }))
      : (currentPlaylist
          ? (currentPlaylist.trackIds ?? []).map((id, i) => ({ trackId: id, track: tracks.find(t => t.id === id), index: i }))
          : tracks.map((t, i) => ({ trackId: t.id, track: t, index: i })));

  const visibleUploads = uploadingItems.filter((item) =>
    currentPlaylistId === null || item.playlistId === currentPlaylistId
  );
  const isEmpty = tracksToDisplay.length === 0 && visibleUploads.length === 0;

  return (
    <section className={styles.bgMusicPanel}>
      <div className={styles.bgMusicLayout}>
        {/* Left Side: Management (Playlists) */}
        <div className={styles.bgMusicSidebarContent}>
          <div className={styles.bgMusicSection}>
            <div className={styles['bg-music-section-header']}>
              <h3>플레이리스트</h3>
            </div>

            <div className={styles.bgMusicAddPlaylistArea}>
              {showNewPlaylistInput ? (
                <div className={clsx(styles.bgMusicAddForm, styles.animateIn)}>
                  <input
                    className={styles.bgMusicInputField}
                    type="text"
                    placeholder="플레이리스트 이름 입력"
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
                  <div className={styles['bg-music-add-form-footer']}>
                    <button
                      className={clsx(styles.bgMusicBtn, styles['bg-music-btn--primary'], styles['bg-music-btn--sm'])}
                      onClick={handleCreatePlaylist}
                    >
                      확인
                    </button>
                    <button
                      className={clsx(styles.bgMusicBtn, styles['bg-music-btn--ghost'], styles['bg-music-btn--sm'])}
                      onClick={() => { setShowNewPlaylistInput(false); setNewPlaylistName(""); }}
                    >
                      취소
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  className={styles.bgMusicPlaylistAddTrigger}
                  onClick={() => setShowNewPlaylistInput(true)}
                >
                  <span className={styles.icon}>+</span>
                  <span>새 플레이리스트</span>
                </button>
              )}
            </div>

            <div className={styles.bgMusicPlaylistList}>
              <div
                className={clsx(styles.bgMusicPlaylistItem, currentPlaylistId === null && styles.active)}
                onClick={() => onSetCurrentPlaylist(null)}
              >
                <span className={styles.name}>전체 음악 목록</span>
                <span className={styles.count}>{tracks.length}곡</span>
              </div>
              <div className={styles.bgMusicPlaylistDivider} />
              {playlists.length === 0 ? (
                <div className={styles.bgMusicEmptySmall}>플레이리스트가 없습니다</div>
              ) : (
                playlists.map(p => {
                  return (
                    <div
                      key={p.id}
                      className={clsx(
                        styles.bgMusicPlaylistItem,
                        currentPlaylistId === p.id && styles.active,
                        confirmDelete?.type === 'playlist' && confirmDelete.playlistId === p.id && styles['confirm-delete']
                      )}
                      onClick={() => onSetCurrentPlaylist(p.id)}
                    >
                      <span className={styles.name}>{p.name}</span>
                      <span className={styles.count}>{p.trackIds.length}곡</span>
                      <button
                        className={styles.deleteBtn}
                        title="목록 삭제"
                        onClick={(e) => { e.stopPropagation(); triggerConfirm({ type: "playlist", playlistId: p.id, name: p.name }); }}
                      >
                        ✕
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Detail Tracks */}
        <div className={styles.bgMusicMainContent} ref={editAreaRef}>
          <div className={clsx(styles.bgMusicSection, styles['bg-music-section--full'])}>
            <div className={styles['bg-music-section-header']}>
              <h3>{currentPlaylist ? `${currentPlaylist.name} 트랙` : "배경 음악 목록"}</h3>

              <div className={styles.headerActions}>

                {!isEditing && (
                  <button
                    className={clsx(styles.bgMusicBtn, styles['bg-music-btn--ghost'], styles['bg-music-btn--sm'])}
                    style={{ marginRight: '8px' }}
                    onClick={handleStartEditing}
                  >
                    <Edit2 size={14} style={{ marginRight: '4px' }} />
                    편집
                  </button>
                )}

                {isEditing && (
                  <div style={{ display: 'flex', gap: '8px', marginRight: '16px' }}>
                    <button
                      className={clsx(styles.bgMusicBtn, styles['bg-music-btn--primary'], styles['bg-music-btn--sm'])}
                      onClick={handleFinishEditing}
                    >
                      <Check size={14} style={{ marginRight: '4px' }} />
                      완료
                    </button>
                    <button
                      className={clsx(styles.bgMusicBtn, styles['bg-music-btn--ghost'], styles['bg-music-btn--sm'])}
                      onClick={handleCancelEditing}
                    >
                      <X size={14} style={{ marginRight: '4px' }} />
                      취소
                    </button>
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*"
                  multiple
                  style={{ display: "none" }}
                  onChange={handleFileChange}
                />
                {!isEditing && (
                  <button
                    className={clsx(styles.bgMusicBtn, styles['bg-music-btn--primary'], styles['bg-music-btn--sm'])}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    + 배경 음악 파일 추가
                  </button>
                )}
              </div>
            </div>

            <div className={styles.bgMusicTrackList}>
              <>
                {isEmpty && (
                  <div className={styles.bgMusicEmpty}>
                    {currentPlaylist ? "이 플레이리스트에는 곡이 없습니다." : "등록된 곡이 없습니다."}<br/>
                    파일 추가 버튼을 눌러 음악을 업로드하세요.
                  </div>
                )}
                {visibleUploads.map((item) => (
                      <div
                        key={item.uploadId}
                        className={clsx(
                          styles.bgMusicTrackItem,
                          styles['bg-music-track-item--uploading'],
                          item.status === "error" && styles['bg-music-track-item--upload-error'],
                          item.status === "done" && styles['bg-music-track-item--upload-done']
                        )}
                      >
                        <span className={styles['bg-music-track-item__num']}>…</span>
                        <div className={styles['bg-music-track-item__upload-info']}>
                          <div className={styles.uploadNameRow}>
                            <span className={styles['bg-music-track-item__name']}>{item.fileName}</span>
                            {item.status === "uploading" && (
                              <span className={styles.uploadPercent}>{item.progress}%</span>
                            )}
                            {item.status === "error" && (
                              <span className={styles.uploadErrorLabel}>{item.error}</span>
                            )}
                            {item.status === "done" && (
                              <span className={styles.uploadDoneLabel}>완료</span>
                            )}
                          </div>
                          <div className={styles.uploadProgressBar}>
                            <div
                              className={clsx(
                                styles.uploadProgressFill,
                                styles[`upload-progress-fill--${item.status}`]
                              )}
                              style={{ width: `${item.progress}%` }}
                            />
                          </div>
                        </div>
                        {item.status === "error" && (
                          <div className={styles['bg-music-track-item__actions']} style={{ opacity: 1 }}>
                            <button
                              className={clsx(styles.bgMusicBtn, styles['bg-music-btn--icon'], styles['bg-music-btn--sm'])}
                              title="재시도"
                              onClick={() => handleRetryUpload(item.uploadId)}
                            >
                              <RotateCcw size={14} />
                            </button>
                            <button
                              className={clsx(styles.bgMusicBtn, styles['bg-music-btn--icon'], styles['bg-music-btn--sm'], styles['bg-music-btn--danger'])}
                              title="취소"
                              onClick={() => handleCancelUpload(item.uploadId)}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )}
                      </div>
                ))}
              </>
              {tracksToDisplay.length > 0 && (
                tracksToDisplay.map(({ trackId, track, index }) => {
                  const isConfirmingLibrary = confirmDelete?.type === 'track' && confirmDelete.trackId === trackId;
                  const isConfirmingRfp = confirmDelete?.type === 'rfp' && confirmDelete.playlistId === currentPlaylist?.id && confirmDelete.index === index;
                  const isConfirmingEdit = confirmDelete?.type === 'edit-rfp' && confirmDelete.index === index;
                  const isAnyConfirming = isConfirmingLibrary || isConfirmingRfp || isConfirmingEdit;

                  const isTrackPlaying = index === currentTrackIndex && isPlaying && (currentPlaylist ? currentPlaylist.id === playingPlaylistId : playingPlaylistId === null);

                  return (
                    <div
                      key={currentPlaylist ? `track-p-${currentPlaylist.id}-${trackId}-${index}` : `track-lib-${trackId}`}
                      className={clsx(
                        styles.bgMusicTrackItem,
                        isTrackPlaying && styles['bg-music-track-item--playing'],
                        isAnyConfirming && styles['bg-music-track-item--confirming'],
                        showPlaylistMenu === trackId && styles['bg-music-track-item--menu-open'],
                        isEditing && styles['bg-music-track-item--editing'],
                        isEditing && draggedIndex === index && styles['bg-music-track-item--dragged']
                      )}
                      onDoubleClick={() => !isAnyConfirming && !isEditing && onPlay(index)}
                      draggable={isEditing}
                      onDragStart={isEditing ? (e) => handleDragStart(e, index) : undefined}
                      onDragOver={isEditing ? (e) => handleDragOver(e, index) : undefined}
                      onDragEnd={isEditing ? handleDragEnd : undefined}
                    >
                    {isEditing ? (
                      <div className={styles['bg-music-track-item__handle']}>
                        <GripVertical size={16} />
                      </div>
                    ) : (
                      <span className={styles['bg-music-track-item__num']}>{index + 1}</span>
                    )}
                    <span className={styles['bg-music-track-item__name']}>{track?.name ?? trackId}</span>

                    <div className={styles['bg-music-track-item__actions']}>
                      {isEditing ? (
                        <button
                          className={clsx(styles.bgMusicBtn, styles['bg-music-btn--icon'], styles['bg-music-btn--sm'], styles['bg-music-btn--danger-text'])}
                          title="삭제"
                          onClick={() => handleRemoveTrackWhileEditing(index)}
                        >
                          <Trash2 size={16} />
                        </button>
                      ) : (
                        <>
                          {currentPlaylist ? (
                            <button
                              className={clsx(styles.bgMusicBtn, styles['bg-music-btn--icon'], styles['bg-music-btn--sm'])}
                              title="플레이리스트에서 제거"
                              onClick={() => triggerConfirm({
                                type: "rfp",
                                playlistId: currentPlaylist.id,
                                trackId: trackId,
                                index,
                                name: track?.name ?? trackId
                              })}
                            >
                              ✕
                            </button>
                          ) : (
                            <>
                              <div className={styles.bgMusicAddToPlaylistContainer}>
                                <button
                                  className={clsx(styles.bgMusicBtn, styles['bg-music-btn--icon'], styles['bg-music-btn--sm'], showPlaylistMenu === trackId && styles.active)}
                                  title="플레이리스트에 추가"
                                  onClick={(e) => { e.stopPropagation(); setShowPlaylistMenu(showPlaylistMenu === trackId ? null : trackId); }}
                                >
                                  +
                                </button>
                                {showPlaylistMenu === trackId && (
                                  <div className={styles.bgMusicPlaylistMenu} onClick={(e) => e.stopPropagation()}>
                                    <div className={styles.menuHeader}>추가할 플레이리스트 선택</div>
                                    {playlists.length === 0 ? (
                                      <div className={clsx(styles.menuItem, styles.disabled)}>플레이리스트가 없습니다</div>
                                    ) : (
                                      playlists.map(p => (
                                        <button
                                          key={p.id}
                                          className={styles.menuItem}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            onAddToPlaylist(p.id, trackId);
                                            setShowPlaylistMenu(null);
                                          }}
                                        >
                                          {p.name}
                                        </button>
                                      ))
                                    )}
                                  </div>
                                )}
                              </div>
                              <button
                                className={clsx(styles.bgMusicBtn, styles['bg-music-btn--icon'], styles['bg-music-btn--sm'], styles['bg-music-btn--danger'])}
                                title="파일 삭제"
                                onClick={() => triggerConfirm({ type: "track", trackId: trackId, name: track?.name ?? trackId })}
                              >
                                🗑
                              </button>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>

      {/* Confirmation Modal */}
      {confirmDelete && (
        <div className={styles.bgMusicConfirmModal} data-confirm-modal onClick={() => setConfirmDelete(null)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>알림</h3>
            </div>
            <div className={styles.modalDivider} />
            <div className={styles.modalBody}>
              {confirmDelete.type === "playlist" ? (
                <>플레이리스트 <strong>"{confirmDelete.name}"</strong>를 삭제하시겠습니까?</>
              ) : confirmDelete.type === "rfp" || confirmDelete.type === "edit-rfp" ? (
                <>곡 <strong>"{confirmDelete.name}"</strong>을(를) 플레이리스트에서 제거하시겠습니까?</>
              ) : (
                <>배경 음악 파일 <strong>"{confirmDelete.name}"</strong>을(를) 영구적으로 삭제하시겠습니까?</>
              )}
            </div>
            <div className={styles.modalDivider} />
            <div className={styles.modalFooter}>
              <button
                className={clsx(styles.bgMusicBtn, styles['bg-music-btn--danger-filled'])}
                onClick={() => {
                  if (confirmDelete.type === "playlist") {
                    actualDeletePlaylist(confirmDelete.playlistId);
                  } else if (confirmDelete.type === "edit-rfp") {
                    actualRemoveFromEditList(confirmDelete.index);
                  } else if (confirmDelete.type === "rfp") {
                    actualRemoveFromPlaylist(confirmDelete.playlistId, confirmDelete.index);
                  } else {
                    actualDeleteTrack(confirmDelete.trackId);
                  }
                }}
              >
                {confirmDelete.type === "rfp" || confirmDelete.type === "edit-rfp" ? "제거" : "삭제"}
              </button>
              <button
                className={styles.bgMusicBtn}
                onClick={() => setConfirmDelete(null)}
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
