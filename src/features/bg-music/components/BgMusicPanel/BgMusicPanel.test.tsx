import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { BgMusicPanel } from "./BgMusicPanel";
import type { Playlist, Track } from "@/features/bg-music/types/bgMusic";

// ─── 헬퍼 ─────────────────────────────────────────────────────────────────────

function makeProps(
  overrides: Partial<React.ComponentProps<typeof BgMusicPanel>> = {}
): React.ComponentProps<typeof BgMusicPanel> {
  return {
    tracks: [],
    playlists: [],
    currentPlaylistId: null,
    currentPlaylist: null,
    playingPlaylistId: null,
    currentTrackIndex: 0,
    isPlaying: false,
    autoplay: false,
    loopAll: false,
    onAddTrack: jest.fn().mockResolvedValue(undefined),
    onRemoveTrack: jest.fn().mockResolvedValue(undefined),
    onCreatePlaylist: jest.fn(),
    onDeletePlaylist: jest.fn(),
    onSetCurrentPlaylist: jest.fn(),
    onSetLoop: jest.fn(),
    onAddToPlaylist: jest.fn(),
    onRemoveFromPlaylist: jest.fn(),
    onReorderTrack: jest.fn(),
    onSetPlaylistTracks: jest.fn(),
    onPlay: jest.fn(),
    onSetAutoplay: jest.fn(),
    ...overrides,
  };
}

function triggerFileUpload(container: HTMLElement, file: File) {
  const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(fileInput, { target: { files: [file] } });
}

// ─── 업로드 진행률 UI ──────────────────────────────────────────────────────────

describe("BgMusicPanel - 업로드 진행률", () => {
  let capturedProgressCallback: ((progress: number) => void) | undefined;
  let resolveUpload!: () => void;
  let rejectUpload!: (err: Error | DOMException) => void;

  beforeEach(() => {
    jest.useFakeTimers();
    capturedProgressCallback = undefined;
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it("파일 선택 시 업로드 아이템이 표시되고 진행률이 0%로 초기화됨", async () => {
    const mockOnAddTrack = jest.fn().mockImplementation((_file: File, onProgress: (p: number) => void) => {
      capturedProgressCallback = onProgress;
      return new Promise<void>((res) => { resolveUpload = res; });
    });

    const { container } = render(<BgMusicPanel {...makeProps({ onAddTrack: mockOnAddTrack })} />);
    const file = new File(["audio"], "my-song.mp3", { type: "audio/mpeg" });

    await act(async () => {
      triggerFileUpload(container, file);
    });

    expect(screen.getByText("my-song")).toBeInTheDocument();
    expect(screen.getByText("0%")).toBeInTheDocument();
  });

  it("onAddTrack의 progress 콜백 호출 시 진행률이 업데이트됨", async () => {
    const mockOnAddTrack = jest.fn().mockImplementation((_file: File, onProgress: (p: number) => void) => {
      capturedProgressCallback = onProgress;
      return new Promise<void>((res) => { resolveUpload = res; });
    });

    const { container } = render(<BgMusicPanel {...makeProps({ onAddTrack: mockOnAddTrack })} />);
    const file = new File(["audio"], "progress-song.mp3");

    await act(async () => {
      triggerFileUpload(container, file);
    });

    act(() => { capturedProgressCallback!(50); });
    expect(screen.getByText("50%")).toBeInTheDocument();

    act(() => { capturedProgressCallback!(90); });
    expect(screen.getByText("90%")).toBeInTheDocument();
  });

  it("업로드 완료 시 '완료' 텍스트가 표시되고 진행률 %가 사라짐", async () => {
    const mockOnAddTrack = jest.fn().mockImplementation((_file: File, onProgress: (p: number) => void) => {
      capturedProgressCallback = onProgress;
      return new Promise<void>((res) => { resolveUpload = res; });
    });

    const { container } = render(<BgMusicPanel {...makeProps({ onAddTrack: mockOnAddTrack })} />);
    const file = new File(["audio"], "done-song.mp3");

    await act(async () => { triggerFileUpload(container, file); });

    await act(async () => { resolveUpload(); });

    expect(screen.getByText("완료")).toBeInTheDocument();
    expect(screen.queryByText("0%")).not.toBeInTheDocument();
  });

  it("완료 후 1500ms가 지나면 업로드 아이템이 사라짐", async () => {
    const mockOnAddTrack = jest.fn().mockImplementation((_file: File, onProgress: (p: number) => void) => {
      capturedProgressCallback = onProgress;
      return new Promise<void>((res) => { resolveUpload = res; });
    });

    const { container } = render(<BgMusicPanel {...makeProps({ onAddTrack: mockOnAddTrack })} />);
    const file = new File(["audio"], "auto-remove.mp3");

    await act(async () => { triggerFileUpload(container, file); });
    await act(async () => { resolveUpload(); });

    expect(screen.getByText("완료")).toBeInTheDocument();

    act(() => { jest.advanceTimersByTime(1500); });

    expect(screen.queryByText("auto-remove")).not.toBeInTheDocument();
  });

  it("1499ms에는 아직 아이템이 남아 있음", async () => {
    const mockOnAddTrack = jest.fn().mockImplementation((_file: File, onProgress: (p: number) => void) => {
      capturedProgressCallback = onProgress;
      return new Promise<void>((res) => { resolveUpload = res; });
    });

    const { container } = render(<BgMusicPanel {...makeProps({ onAddTrack: mockOnAddTrack })} />);
    const file = new File(["audio"], "still-visible.mp3");

    await act(async () => { triggerFileUpload(container, file); });
    await act(async () => { resolveUpload(); });

    act(() => { jest.advanceTimersByTime(1499); });

    expect(screen.getByText("완료")).toBeInTheDocument();
  });

  it("QuotaExceededError 시 '저장 공간이 부족합니다.' 오류 표시", async () => {
    const mockOnAddTrack = jest.fn().mockImplementation((_file: File, onProgress: (p: number) => void) => {
      capturedProgressCallback = onProgress;
      return new Promise<void>((_res, rej) => { rejectUpload = rej; });
    });

    const { container } = render(<BgMusicPanel {...makeProps({ onAddTrack: mockOnAddTrack })} />);
    const file = new File(["audio"], "quota-error.mp3");

    await act(async () => { triggerFileUpload(container, file); });

    await act(async () => {
      rejectUpload(new DOMException("quota exceeded", "QuotaExceededError"));
    });

    expect(screen.getByText("저장 공간이 부족합니다.")).toBeInTheDocument();
  });

  it("일반 오류 시 '파일 추가에 실패했습니다.' 오류 표시", async () => {
    const mockOnAddTrack = jest.fn().mockImplementation((_file: File, onProgress: (p: number) => void) => {
      capturedProgressCallback = onProgress;
      return new Promise<void>((_res, rej) => { rejectUpload = rej; });
    });

    const { container } = render(<BgMusicPanel {...makeProps({ onAddTrack: mockOnAddTrack })} />);
    const file = new File(["audio"], "error-song.mp3");

    await act(async () => { triggerFileUpload(container, file); });

    await act(async () => { rejectUpload(new Error("unknown error")); });

    expect(screen.getByText("파일 추가에 실패했습니다.")).toBeInTheDocument();
  });

  it("오류 발생 시 재시도 및 취소 버튼이 표시됨", async () => {
    const mockOnAddTrack = jest.fn().mockImplementation((_file: File, onProgress: (p: number) => void) => {
      capturedProgressCallback = onProgress;
      return new Promise<void>((_res, rej) => { rejectUpload = rej; });
    });

    const { container } = render(<BgMusicPanel {...makeProps({ onAddTrack: mockOnAddTrack })} />);
    const file = new File(["audio"], "buttons-test.mp3");

    await act(async () => { triggerFileUpload(container, file); });
    await act(async () => { rejectUpload(new Error("fail")); });

    expect(screen.getByTitle("재시도")).toBeInTheDocument();
    expect(screen.getByTitle("취소")).toBeInTheDocument();
  });

  it("재시도 버튼 클릭 시 오류 아이템이 제거되고 업로드를 다시 시도함", async () => {
    let uploadCount = 0;
    const mockOnAddTrack = jest.fn().mockImplementation((_file: File, onProgress: (p: number) => void) => {
      capturedProgressCallback = onProgress;
      uploadCount++;
      return new Promise<void>((_res, rej) => { rejectUpload = rej; });
    });

    const { container } = render(<BgMusicPanel {...makeProps({ onAddTrack: mockOnAddTrack })} />);
    const file = new File(["audio"], "retry-song.mp3");

    await act(async () => { triggerFileUpload(container, file); });
    await act(async () => { rejectUpload(new Error("fail")); });

    expect(screen.getByText("파일 추가에 실패했습니다.")).toBeInTheDocument();
    expect(uploadCount).toBe(1);

    // 재시도 클릭
    await act(async () => {
      screen.getByTitle("재시도").click();
    });

    expect(uploadCount).toBe(2);
    expect(screen.queryByText("파일 추가에 실패했습니다.")).not.toBeInTheDocument();
    // 재시도 후 0% 진행률로 새 아이템이 표시됨
    expect(screen.getByText("0%")).toBeInTheDocument();
  });

  it("취소 버튼 클릭 시 오류 아이템이 목록에서 제거됨", async () => {
    const mockOnAddTrack = jest.fn().mockImplementation((_file: File, onProgress: (p: number) => void) => {
      capturedProgressCallback = onProgress;
      return new Promise<void>((_res, rej) => { rejectUpload = rej; });
    });

    const { container } = render(<BgMusicPanel {...makeProps({ onAddTrack: mockOnAddTrack })} />);
    const file = new File(["audio"], "cancel-song.mp3");

    await act(async () => { triggerFileUpload(container, file); });
    await act(async () => { rejectUpload(new Error("fail")); });

    expect(screen.getByText("cancel-song")).toBeInTheDocument();

    act(() => { screen.getByTitle("취소").click(); });

    expect(screen.queryByText("cancel-song")).not.toBeInTheDocument();
  });

  it("현재 플레이리스트와 다른 플레이리스트의 업로드 아이템은 표시되지 않음", async () => {
    const mockOnAddTrack = jest.fn().mockImplementation((_file: File, onProgress: (p: number) => void) => {
      capturedProgressCallback = onProgress;
      return new Promise<void>(() => {}); // 완료되지 않음
    });

    const playlist1: Playlist = { id: "playlist-1", name: "P1", trackIds: [], loop: false };
    const playlist2: Playlist = { id: "playlist-2", name: "P2", trackIds: [], loop: false };

    const { container, rerender } = render(
      <BgMusicPanel
        {...makeProps({
          onAddTrack: mockOnAddTrack,
          currentPlaylistId: "playlist-1",
          currentPlaylist: playlist1,
          playlists: [playlist1, playlist2],
        })}
      />
    );

    const file = new File(["audio"], "filtered-song.mp3");

    await act(async () => { triggerFileUpload(container, file); });

    // playlist-1 보기 중 → 해당 업로드가 보임
    expect(screen.getByText("filtered-song")).toBeInTheDocument();

    // playlist-2로 전환
    rerender(
      <BgMusicPanel
        {...makeProps({
          onAddTrack: mockOnAddTrack,
          currentPlaylistId: "playlist-2",
          currentPlaylist: playlist2,
          playlists: [playlist1, playlist2],
        })}
      />
    );

    // playlist-1의 업로드는 playlist-2 보기에서 보이지 않음
    expect(screen.queryByText("filtered-song")).not.toBeInTheDocument();
  });

  it("currentPlaylistId가 null(전체 목록)이면 모든 플레이리스트의 업로드가 표시됨", async () => {
    let callCount = 0;
    const callbacks: Array<(p: number) => void> = [];
    const mockOnAddTrack = jest.fn().mockImplementation((_file: File, onProgress: (p: number) => void) => {
      callbacks.push(onProgress);
      callCount++;
      return new Promise<void>(() => {});
    });

    const playlist1: Playlist = { id: "playlist-1", name: "P1", trackIds: [], loop: false };

    const { container } = render(
      <BgMusicPanel
        {...makeProps({
          onAddTrack: mockOnAddTrack,
          currentPlaylistId: null, // 전체 목록
          playlists: [playlist1],
        })}
      />
    );

    const file1 = new File(["a"], "song-a.mp3");
    const file2 = new File(["b"], "song-b.mp3");

    await act(async () => {
      triggerFileUpload(container, file1);
    });
    await act(async () => {
      triggerFileUpload(container, file2);
    });

    // 전체 목록에서는 모든 업로드가 표시됨
    expect(screen.getByText("song-a")).toBeInTheDocument();
    expect(screen.getByText("song-b")).toBeInTheDocument();
  });

  it("여러 파일 동시 선택 시 각각 업로드 아이템이 추가됨", async () => {
    const callbacks: Array<(p: number) => void> = [];
    const mockOnAddTrack = jest.fn().mockImplementation((_file: File, onProgress: (p: number) => void) => {
      callbacks.push(onProgress);
      return new Promise<void>(() => {});
    });

    const { container } = render(<BgMusicPanel {...makeProps({ onAddTrack: mockOnAddTrack })} />);
    const file1 = new File(["a"], "multi-1.mp3");
    const file2 = new File(["b"], "multi-2.mp3");

    await act(async () => {
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      fireEvent.change(fileInput, { target: { files: [file1, file2] } });
    });

    expect(screen.getByText("multi-1")).toBeInTheDocument();
    expect(screen.getByText("multi-2")).toBeInTheDocument();
    expect(mockOnAddTrack).toHaveBeenCalledTimes(2);
  });
});

// ─── 프로그레스 바 렌더링 ──────────────────────────────────────────────────────

describe("BgMusicPanel - 프로그레스 바", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it("업로드 중에는 진행률에 맞게 프로그레스 바 너비가 설정됨", async () => {
    let capturedCallback: ((p: number) => void) | undefined;
    const mockOnAddTrack = jest.fn().mockImplementation((_file: File, onProgress: (p: number) => void) => {
      capturedCallback = onProgress;
      return new Promise<void>(() => {});
    });

    const { container } = render(<BgMusicPanel {...makeProps({ onAddTrack: mockOnAddTrack })} />);

    await act(async () => {
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      fireEvent.change(fileInput, { target: { files: [new File(["a"], "bar-test.mp3")] } });
    });

    act(() => { capturedCallback!(60); });

    const progressFill = container.querySelector(".upload-progress-fill") as HTMLElement;
    expect(progressFill.style.width).toBe("60%");
  });

  it("업로드 완료 후 프로그레스 바 너비가 100%가 됨", async () => {
    let resolveUpload!: () => void;
    const mockOnAddTrack = jest.fn().mockImplementation((_file: File, _onProgress: (p: number) => void) => {
      return new Promise<void>((res) => { resolveUpload = res; });
    });

    const { container } = render(<BgMusicPanel {...makeProps({ onAddTrack: mockOnAddTrack })} />);

    await act(async () => {
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      fireEvent.change(fileInput, { target: { files: [new File(["a"], "bar-done.mp3")] } });
    });

    await act(async () => { resolveUpload(); });

    const progressFill = container.querySelector(".upload-progress-fill") as HTMLElement;
    expect(progressFill.style.width).toBe("100%");
  });

  it("업로드 아이템에 uploading/done/error CSS 클래스가 올바르게 적용됨", async () => {
    let rejectUpload!: (err: Error) => void;
    const mockOnAddTrack = jest.fn().mockImplementation((_file: File, _onProgress: (p: number) => void) => {
      return new Promise<void>((_res, rej) => { rejectUpload = rej; });
    });

    const { container } = render(<BgMusicPanel {...makeProps({ onAddTrack: mockOnAddTrack })} />);

    await act(async () => {
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      fireEvent.change(fileInput, { target: { files: [new File(["a"], "css-test.mp3")] } });
    });

    // 업로드 중: uploading 클래스
    expect(container.querySelector(".bg-music-track-item--uploading")).toBeInTheDocument();
    expect(container.querySelector(".bg-music-track-item--upload-error")).not.toBeInTheDocument();

    // 오류: error 클래스
    await act(async () => { rejectUpload(new Error("fail")); });
    expect(container.querySelector(".bg-music-track-item--upload-error")).toBeInTheDocument();
  });
});

// ─── 트랙 목록이 없을 때 빈 상태 ────────────────────────────────────────────────

describe("BgMusicPanel - 빈 상태", () => {
  it("트랙과 업로드 아이템이 없으면 빈 상태 메시지를 표시함", () => {
    render(<BgMusicPanel {...makeProps()} />);
    expect(screen.getByText(/파일 추가 버튼을 눌러 음악을 업로드하세요/)).toBeInTheDocument();
  });

  it("업로드 중일 때는 빈 상태 메시지가 표시되지 않음", async () => {
    const mockOnAddTrack = jest.fn().mockImplementation(() => new Promise<void>(() => {}));
    const { container } = render(<BgMusicPanel {...makeProps({ onAddTrack: mockOnAddTrack })} />);

    await act(async () => {
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      fireEvent.change(fileInput, { target: { files: [new File(["a"], "uploading.mp3")] } });
    });

    expect(screen.queryByText(/파일 추가 버튼을 눌러 음악을 업로드하세요/)).not.toBeInTheDocument();
  });

  it("플레이리스트가 있을 때 빈 상태 메시지는 플레이리스트 전용 문구를 표시함", () => {
    const playlist: Playlist = { id: "p1", name: "테스트 플레이리스트", trackIds: [], loop: false };
    render(
      <BgMusicPanel
        {...makeProps({
          currentPlaylistId: "p1",
          currentPlaylist: playlist,
          playlists: [playlist],
        })}
      />
    );
    expect(screen.getByText(/이 플레이리스트에는 곡이 없습니다/)).toBeInTheDocument();
  });
});

// ─── 트랙 목록 표시 ────────────────────────────────────────────────────────────

describe("BgMusicPanel - 트랙 목록", () => {
  it("tracks 배열의 트랙들을 목록에 표시함", () => {
    const tracks: Track[] = [
      { id: "t1", name: "트랙 A" },
      { id: "t2", name: "트랙 B" },
    ];
    render(<BgMusicPanel {...makeProps({ tracks })} />);
    expect(screen.getByText("트랙 A")).toBeInTheDocument();
    expect(screen.getByText("트랙 B")).toBeInTheDocument();
  });

  it("현재 재생 중인 트랙에 playing CSS 클래스가 적용됨", () => {
    const tracks: Track[] = [
      { id: "t1", name: "재생 중 트랙" },
      { id: "t2", name: "다른 트랙" },
    ];
    const { container } = render(
      <BgMusicPanel
        {...makeProps({
          tracks,
          isPlaying: true,
          currentTrackIndex: 0,
          playingPlaylistId: null,
          currentPlaylistId: null,
        })}
      />
    );
    const items = container.querySelectorAll(".bg-music-track-item");
    expect(items[0]).toHaveClass("bg-music-track-item--playing");
    expect(items[1]).not.toHaveClass("bg-music-track-item--playing");
  });
});
