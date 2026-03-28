import { renderHook, act, waitFor } from "@testing-library/react";
import { useBgMusic } from "./useBgMusic";
import {
  saveTrackBlob,
  getTrackBlob,
  deleteTrackBlob,
  requestPersistentStorage,
} from "@/db/trackStorage";

// ─── trackStorage 모킹 ───────────────────────────────────────────────────────
jest.mock("@/db/trackStorage");

const mockSaveTrackBlob = saveTrackBlob as jest.MockedFunction<typeof saveTrackBlob>;
const mockGetTrackBlob = getTrackBlob as jest.MockedFunction<typeof getTrackBlob>;
const mockDeleteTrackBlob = deleteTrackBlob as jest.MockedFunction<typeof deleteTrackBlob>;
const mockRequestPersistentStorage = requestPersistentStorage as jest.MockedFunction<
  typeof requestPersistentStorage
>;

// ─── HTMLAudioElement 모킹 ───────────────────────────────────────────────────
let mockAudioInstances: MockAudio[] = [];

class MockAudio {
  volume = 1;
  currentTime = 0;
  duration = 180;
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;

  play = jest.fn().mockResolvedValue(undefined);
  pause = jest.fn();
  addEventListener = jest.fn();

  constructor(_src: string) {
    mockAudioInstances.push(this);
  }

  /** 테스트에서 이벤트를 직접 발생시킬 때 사용 */
  triggerEnded() {
    this.onended?.();
  }
  triggerError() {
    this.onerror?.();
  }
}

// ─── 전역 설정 ────────────────────────────────────────────────────────────────
beforeAll(() => {
  global.Audio = MockAudio as unknown as typeof Audio;
  global.URL.createObjectURL = jest.fn(() => "blob:mock-url");
  global.URL.revokeObjectURL = jest.fn();
});

// createPlaylist/addTrack 등 Date.now() 기반 ID 생성 시 충돌 방지
let dateNowCounter = 0;

beforeEach(() => {
  dateNowCounter = 0;
  jest.spyOn(Date, "now").mockImplementation(() => 1_000_000 + dateNowCounter++);

  localStorage.clear();
  mockAudioInstances = [];
  jest.clearAllMocks();

  mockSaveTrackBlob.mockResolvedValue(undefined);
  mockGetTrackBlob.mockResolvedValue(new Blob(["audio"], { type: "audio/mpeg" }));
  mockDeleteTrackBlob.mockResolvedValue(undefined);
  mockRequestPersistentStorage.mockResolvedValue(true);
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ─── 헬퍼 ────────────────────────────────────────────────────────────────────
/** 플레이리스트 1개 + 트랙 1개가 추가된 훅을 반환 */
async function setupWithOneTrack() {
  const { result } = renderHook(() => useBgMusic());

  act(() => {
    result.current.createPlaylist("테스트 플레이리스트");
  });

  const playlistId = result.current.playlists[0].id;
  const file = new File(["audio data"], "song.mp3", { type: "audio/mpeg" });

  await act(async () => {
    await result.current.addTrack(file, playlistId);
  });

  return result;
}

/** play() 호출 후 isPlaying=true 가 될 때까지 대기 */
async function playAndWait(result: ReturnType<typeof setupWithOneTrack> extends Promise<infer R> ? R : never) {
  await act(async () => {
    result.current.play();
  });
  await waitFor(() => expect(result.current.isPlaying).toBe(true));
}

// ─────────────────────────────────────────────────────────────────────────────
describe("초기 상태", () => {
  it("기본값으로 초기화", () => {
    const { result } = renderHook(() => useBgMusic());

    expect(result.current.tracks).toEqual([]);
    expect(result.current.playlists).toEqual([]);
    expect(result.current.currentPlaylistId).toBeNull();
    expect(result.current.isPlaying).toBe(false);
    expect(result.current.volume).toBe(0.7);
    expect(result.current.autoplay).toBe(false);
  });

  it("마운트 시 requestPersistentStorage 호출", () => {
    renderHook(() => useBgMusic());
    expect(mockRequestPersistentStorage).toHaveBeenCalledTimes(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("플레이리스트 관리", () => {
  it("createPlaylist: 플레이리스트 생성", () => {
    const { result } = renderHook(() => useBgMusic());

    act(() => {
      result.current.createPlaylist("신나는 노래");
    });

    expect(result.current.playlists).toHaveLength(1);
    expect(result.current.playlists[0].name).toBe("신나는 노래");
    expect(result.current.playlists[0].trackIds).toEqual([]);
    expect(result.current.playlists[0].loop).toBe(false);
  });

  it("createPlaylist: 첫 번째 플레이리스트 생성 시 current로 설정", () => {
    const { result } = renderHook(() => useBgMusic());

    act(() => {
      result.current.createPlaylist("첫 번째");
    });

    expect(result.current.currentPlaylistId).toBe(result.current.playlists[0].id);
  });

  it("createPlaylist: 이미 current가 있으면 변경하지 않음", () => {
    const { result } = renderHook(() => useBgMusic());

    act(() => {
      result.current.createPlaylist("첫 번째");
    });
    const firstId = result.current.currentPlaylistId;

    act(() => {
      result.current.createPlaylist("두 번째");
    });

    expect(result.current.playlists).toHaveLength(2);
    expect(result.current.currentPlaylistId).toBe(firstId);
  });

  it("deletePlaylist: 플레이리스트 삭제, 다음 플레이리스트로 current 전환", () => {
    const { result } = renderHook(() => useBgMusic());

    act(() => {
      result.current.createPlaylist("플레이리스트1");
      result.current.createPlaylist("플레이리스트2");
    });

    const id1 = result.current.playlists[0].id;
    const id2 = result.current.playlists[1].id;

    act(() => {
      result.current.deletePlaylist(id1);
    });

    expect(result.current.playlists).toHaveLength(1);
    expect(result.current.currentPlaylistId).toBe(id2);
  });

  it("deletePlaylist: 마지막 플레이리스트 삭제 시 currentPlaylistId가 null", () => {
    const { result } = renderHook(() => useBgMusic());

    act(() => {
      result.current.createPlaylist("유일한 플레이리스트");
    });
    const id = result.current.playlists[0].id;

    act(() => {
      result.current.deletePlaylist(id);
    });

    expect(result.current.playlists).toHaveLength(0);
    expect(result.current.currentPlaylistId).toBeNull();
  });

  it("setCurrentPlaylist: 현재 플레이리스트 변경 및 트랙 인덱스 초기화", () => {
    const { result } = renderHook(() => useBgMusic());

    act(() => {
      result.current.createPlaylist("A");
      result.current.createPlaylist("B");
    });

    const idB = result.current.playlists[1].id;

    act(() => {
      result.current.setCurrentPlaylist(idB);
    });

    expect(result.current.currentPlaylistId).toBe(idB);
    expect(result.current.currentTrackIndex).toBe(0);
  });

  it("setLoop: 플레이리스트 반복 재생 설정/해제", () => {
    const { result } = renderHook(() => useBgMusic());

    act(() => {
      result.current.createPlaylist("루프 테스트");
    });
    const id = result.current.playlists[0].id;

    act(() => {
      result.current.setLoop(id, true);
    });
    expect(result.current.playlists[0].loop).toBe(true);

    act(() => {
      result.current.setLoop(id, false);
    });
    expect(result.current.playlists[0].loop).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("트랙 관리", () => {
  it("addTrack: IndexedDB에 저장 후 trackMeta에 추가", async () => {
    const { result } = renderHook(() => useBgMusic());
    const file = new File(["audio"], "my-song.mp3", { type: "audio/mpeg" });

    await act(async () => {
      await result.current.addTrack(file);
    });

    expect(mockSaveTrackBlob).toHaveBeenCalledWith(expect.stringMatching(/^track-/), file);
    expect(result.current.tracks).toHaveLength(1);
    expect(result.current.tracks[0].name).toBe("my-song"); // 확장자 제거
  });

  it("addTrack: playlistId 지정 시 해당 플레이리스트에도 추가", async () => {
    const { result } = renderHook(() => useBgMusic());

    act(() => {
      result.current.createPlaylist("테스트");
    });
    const playlistId = result.current.playlists[0].id;

    const file = new File(["audio"], "track.mp3");
    await act(async () => {
      await result.current.addTrack(file, playlistId);
    });

    expect(result.current.playlists[0].trackIds).toHaveLength(1);
  });

  it("addTrack: playlistId 미지정 시 플레이리스트에 추가되지 않음", async () => {
    const { result } = renderHook(() => useBgMusic());

    act(() => {
      result.current.createPlaylist("테스트");
    });

    const file = new File(["audio"], "track.mp3");
    await act(async () => {
      await result.current.addTrack(file); // playlistId 없음
    });

    expect(result.current.tracks).toHaveLength(1);
    expect(result.current.playlists[0].trackIds).toHaveLength(0);
  });

  it("removeTrack: IndexedDB에서 삭제 및 trackMeta, 모든 플레이리스트에서 제거", async () => {
    const result = await setupWithOneTrack();
    const trackId = result.current.tracks[0].id;

    await act(async () => {
      await result.current.removeTrack(trackId);
    });

    expect(mockDeleteTrackBlob).toHaveBeenCalledWith(trackId);
    expect(result.current.tracks).toHaveLength(0);
    expect(result.current.playlists[0].trackIds).toHaveLength(0);
  });

  it("addTrackToPlaylist: 기존 트랙을 플레이리스트에 추가", async () => {
    const { result } = renderHook(() => useBgMusic());

    act(() => {
      result.current.createPlaylist("플레이리스트");
    });
    const playlistId = result.current.playlists[0].id;

    const file = new File(["audio"], "song.mp3");
    await act(async () => {
      await result.current.addTrack(file); // 플레이리스트 없이 추가
    });

    const trackId = result.current.tracks[0].id;

    act(() => {
      result.current.addTrackToPlaylist(playlistId, trackId);
    });

    expect(result.current.playlists[0].trackIds).toContain(trackId);
  });

  it("removeTrackFromPlaylist: 특정 플레이리스트에서만 제거, trackMeta는 유지", async () => {
    const result = await setupWithOneTrack();
    const playlistId = result.current.playlists[0].id;
    const trackId = result.current.tracks[0].id;

    act(() => {
      result.current.removeTrackFromPlaylist(playlistId, 0);
    });

    expect(result.current.playlists[0].trackIds).not.toContain(trackId);
    expect(result.current.tracks).toHaveLength(1); // trackMeta는 남아 있음
  });

  it("reorderTrack: 플레이리스트 내 트랙 순서 변경 (앞에서 뒤로)", async () => {
    const { result } = renderHook(() => useBgMusic());

    act(() => {
      result.current.createPlaylist("플레이리스트");
    });
    const playlistId = result.current.playlists[0].id;

    const files = [
      new File(["a"], "a.mp3"),
      new File(["b"], "b.mp3"),
      new File(["c"], "c.mp3"),
    ];
    for (const file of files) {
      await act(async () => {
        await result.current.addTrack(file, playlistId);
      });
    }

    const [idA, idB, idC] = result.current.playlists[0].trackIds;

    // index 0 → index 2 이동: [A, B, C] → [B, C, A]
    act(() => {
      result.current.reorderTrack(playlistId, 0, 2);
    });

    const reordered = result.current.playlists[0].trackIds;
    expect(reordered).toEqual([idB, idC, idA]);
  });

  it("reorderTrack: 다른 플레이리스트에는 영향 없음", async () => {
    const { result } = renderHook(() => useBgMusic());

    act(() => {
      result.current.createPlaylist("A");
      result.current.createPlaylist("B");
    });
    const [playlistA, playlistB] = result.current.playlists;

    const files = [new File(["x"], "x.mp3"), new File(["y"], "y.mp3")];
    for (const file of files) {
      await act(async () => {
        await result.current.addTrack(file, playlistA.id);
        await result.current.addTrack(file, playlistB.id);
      });
    }

    const originalB = [...result.current.playlists[1].trackIds];

    act(() => {
      result.current.reorderTrack(playlistA.id, 0, 1);
    });

    expect(result.current.playlists[1].trackIds).toEqual(originalB);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("재생 제어", () => {
  it("play: getTrackBlob 호출 후 Audio 생성 및 isPlaying=true", async () => {
    const result = await setupWithOneTrack();
    const trackId = result.current.playlists[0].trackIds[0];

    await act(async () => {
      result.current.play();
    });
    await waitFor(() => expect(result.current.isPlaying).toBe(true));

    expect(mockGetTrackBlob).toHaveBeenCalledWith(trackId);
    expect(mockAudioInstances).toHaveLength(1);
    expect(mockAudioInstances[0].play).toHaveBeenCalled();
  });

  it("togglePlay: 재생 중이면 pause, 정지 중이면 resume", async () => {
    const result = await setupWithOneTrack();

    await act(async () => { result.current.play(); });
    await waitFor(() => expect(result.current.isPlaying).toBe(true));

    // 재생 중 → pause
    act(() => {
      result.current.togglePlay();
    });
    expect(result.current.isPlaying).toBe(false);

    // 정지 중 (audioRef 있음) → audio.play() 재호출
    await act(async () => {
      result.current.togglePlay();
    });
    await waitFor(() => expect(result.current.isPlaying).toBe(true));
  });

  it("play: Audio 재생 실패 시 isPlaying=false", async () => {
    mockGetTrackBlob.mockResolvedValueOnce(new Blob(["audio"]));
    const result = await setupWithOneTrack();

    mockAudioInstances; // drain
    const rejectedPlay = jest.fn().mockRejectedValueOnce(new Error("autoplay blocked"));

    // 다음 Audio 인스턴스의 play가 실패하도록 설정
    mockGetTrackBlob.mockResolvedValueOnce(new Blob(["audio"]));
    const originalAudio = global.Audio;
    class FailingAudio extends MockAudio {
      play = rejectedPlay;
    }
    global.Audio = FailingAudio as unknown as typeof Audio;

    await act(async () => { result.current.play(); });
    await waitFor(() => expect(result.current.isPlaying).toBe(false));

    global.Audio = originalAudio;
  });

  it("next: 다음 트랙으로 이동", async () => {
    const { result } = renderHook(() => useBgMusic());

    act(() => { result.current.createPlaylist("테스트"); });
    const playlistId = result.current.playlists[0].id;

    const files = [
      new File(["a"], "a.mp3"),
      new File(["b"], "b.mp3"),
    ];
    for (const file of files) {
      await act(async () => {
        await result.current.addTrack(file, playlistId);
      });
    }

    await act(async () => { result.current.play(0); });
    await waitFor(() => expect(result.current.isPlaying).toBe(true));

    await act(async () => { result.current.next(); });
    await waitFor(() => expect(result.current.currentTrackIndex).toBe(1));
  });

  it("prev: 이전 트랙으로 이동", async () => {
    const { result } = renderHook(() => useBgMusic());

    act(() => { result.current.createPlaylist("테스트"); });
    const playlistId = result.current.playlists[0].id;

    const files = [new File(["a"], "a.mp3"), new File(["b"], "b.mp3")];
    for (const file of files) {
      await act(async () => {
        await result.current.addTrack(file, playlistId);
      });
    }

    await act(async () => { result.current.play(1); });
    await waitFor(() => expect(result.current.currentTrackIndex).toBe(1));

    await act(async () => { result.current.prev(); });
    await waitFor(() => expect(result.current.currentTrackIndex).toBe(0));
  });

  it("next/prev: 마지막/첫 트랙에서 순환", async () => {
    const { result } = renderHook(() => useBgMusic());

    act(() => { result.current.createPlaylist("테스트"); });
    const playlistId = result.current.playlists[0].id;

    const files = [new File(["a"], "a.mp3"), new File(["b"], "b.mp3")];
    for (const file of files) {
      await act(async () => {
        await result.current.addTrack(file, playlistId);
      });
    }

    // 마지막 트랙에서 next → index 0
    await act(async () => { result.current.play(1); });
    await waitFor(() => expect(result.current.currentTrackIndex).toBe(1));
    await act(async () => { result.current.next(); });
    await waitFor(() => expect(result.current.currentTrackIndex).toBe(0));

    // 첫 트랙에서 prev → 마지막 index
    await act(async () => { result.current.prev(); });
    await waitFor(() => expect(result.current.currentTrackIndex).toBe(1));
  });

  it("seek: 재생 시간 이동", async () => {
    const result = await setupWithOneTrack();

    await act(async () => { result.current.play(); });
    await waitFor(() => expect(result.current.isPlaying).toBe(true));

    act(() => {
      result.current.seek(60);
    });

    expect(mockAudioInstances[0].currentTime).toBe(60);
    expect(result.current.progress.current).toBe(60);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("루프 재생", () => {
  it("루프 ON: 마지막 트랙 종료 후 첫 트랙으로 돌아감", async () => {
    const { result } = renderHook(() => useBgMusic());

    act(() => { result.current.createPlaylist("루프 플레이리스트"); });
    const playlistId = result.current.playlists[0].id;

    act(() => { result.current.setLoop(playlistId, true); });

    const files = [new File(["a"], "a.mp3"), new File(["b"], "b.mp3")];
    for (const file of files) {
      await act(async () => {
        await result.current.addTrack(file, playlistId);
      });
    }

    // 마지막 트랙(index 1)부터 재생
    await act(async () => { result.current.play(1); });
    await waitFor(() => expect(result.current.currentTrackIndex).toBe(1));

    const lastAudio = mockAudioInstances[mockAudioInstances.length - 1];

    // onended 트리거 → loop이므로 index 0으로
    await act(async () => {
      lastAudio.triggerEnded();
    });
    await waitFor(() => expect(result.current.currentTrackIndex).toBe(0));
  });

  it("루프 OFF: 마지막 트랙 종료 후 isPlaying=false", async () => {
    const { result } = renderHook(() => useBgMusic());

    act(() => { result.current.createPlaylist("일반 플레이리스트"); });
    const playlistId = result.current.playlists[0].id;

    const file = new File(["a"], "a.mp3");
    await act(async () => {
      await result.current.addTrack(file, playlistId);
    });

    await act(async () => { result.current.play(0); });
    await waitFor(() => expect(result.current.isPlaying).toBe(true));

    const audio = mockAudioInstances[mockAudioInstances.length - 1];

    await act(async () => {
      audio.triggerEnded();
    });
    await waitFor(() => expect(result.current.isPlaying).toBe(false));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("전체 음악 목록 재생", () => {
  it("loopAll ON: 전체 음악 목록 재생 시 마지막 트랙 종료 후 첫 트랙으로 돌아감", async () => {
    const { result } = renderHook(() => useBgMusic());

    // 1. 트랙 2개 추가 (플레이리스트 없이)
    await act(async () => {
      await result.current.addTrack(new File(["a"], "a.mp3"));
      await result.current.addTrack(new File(["b"], "b.mp3"));
    });

    // 2. 전체 반복 루프 ON
    act(() => {
      result.current.setLoop(null, true);
    });
    expect(result.current.loopAll).toBe(true);

    // 3. 마지막 트랙(index 1) 재생 (전체 목록)
    act(() => {
      result.current.setCurrentPlaylist(null);
    });
    await act(async () => {
      result.current.play(1);
    });
    await waitFor(() => expect(result.current.isPlaying).toBe(true));
    expect(result.current.playingPlaylistId).toBeNull();
    expect(result.current.currentTrackIndex).toBe(1);

    const lastAudio = mockAudioInstances[mockAudioInstances.length - 1];

    // 4. onended 트리거 -> loopAll이므로 index 0으로
    await act(async () => {
      lastAudio.triggerEnded();
    });
    await waitFor(() => expect(result.current.currentTrackIndex).toBe(0));
    expect(result.current.playingPlaylistId).toBeNull();
  });

  it("전체 음악 목록 재생 시 종료 후 다음 곡으로 자동 이동", async () => {
    const { result } = renderHook(() => useBgMusic());

    await act(async () => {
      await result.current.addTrack(new File(["a"], "a.mp3"));
      await result.current.addTrack(new File(["b"], "b.mp3"));
    });

    // index 0 재생 (전체 목록)
    act(() => { result.current.setCurrentPlaylist(null); });
    await act(async () => { result.current.play(0); });
    await waitFor(() => expect(result.current.isPlaying).toBe(true));

    const audio = mockAudioInstances[mockAudioInstances.length - 1];

    // 첫 곡 종료 -> 다음 곡(index 1)으로
    await act(async () => {
      audio.triggerEnded();
    });
    await waitFor(() => expect(result.current.currentTrackIndex).toBe(1));
    expect(result.current.isPlaying).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("볼륨 및 페이드", () => {
  it("setVolume: 볼륨 값 변경 및 재생 중인 오디오에 즉시 반영", async () => {
    const result = await setupWithOneTrack();

    await act(async () => { result.current.play(); });
    await waitFor(() => expect(result.current.isPlaying).toBe(true));

    act(() => {
      result.current.setVolume(0.3);
    });

    expect(result.current.volume).toBe(0.3);
    expect(mockAudioInstances[0].volume).toBe(0.3);
  });

  it("fadeOut: setInterval로 볼륨을 서서히 0으로 감소", async () => {
    jest.useFakeTimers();

    const result = await setupWithOneTrack();

    await act(async () => { result.current.play(); });
    await waitFor(() => expect(result.current.isPlaying).toBe(true));

    const audio = mockAudioInstances[mockAudioInstances.length - 1];
    audio.volume = result.current.volume; // 초기 볼륨 동기화

    act(() => {
      result.current.fadeOut();
      jest.advanceTimersByTime(2000);
    });

    expect(audio.volume).toBe(0);

    jest.useRealTimers();
  });

  it("fadeIn: fadeOut 이후 볼륨을 설정 볼륨으로 복구", async () => {
    jest.useFakeTimers();

    const result = await setupWithOneTrack();

    await act(async () => { result.current.play(); });
    await waitFor(() => expect(result.current.isPlaying).toBe(true));

    const audio = mockAudioInstances[mockAudioInstances.length - 1];
    const targetVolume = result.current.volume;
    audio.volume = targetVolume;

    // fadeOut 완료
    act(() => {
      result.current.fadeOut();
      jest.advanceTimersByTime(2000);
    });
    expect(audio.volume).toBe(0);

    // fadeIn 복구
    act(() => {
      result.current.fadeIn();
      jest.advanceTimersByTime(2000);
    });

    expect(audio.volume).toBeCloseTo(targetVolume, 5);

    jest.useRealTimers();
  });

  it("fadeOut: 오디오 없을 때 호출해도 오류 없음", () => {
    const { result } = renderHook(() => useBgMusic());

    expect(() => {
      act(() => { result.current.fadeOut(); });
    }).not.toThrow();
  });

  it("fadeIn: 이미 페이드 상태가 아닐 때 호출해도 오류 없음", async () => {
    const result = await setupWithOneTrack();

    await act(async () => { result.current.play(); });
    await waitFor(() => expect(result.current.isPlaying).toBe(true));

    expect(() => {
      act(() => { result.current.fadeIn(); }); // isFaded=false 상태에서 호출
    }).not.toThrow();
  });

  // ── 버그 수정 회귀 테스트 ────────────────────────────────────────────────────
  // 안내 방송 재생 중(배경 음악이 없는 상태)에 fadeOut을 호출해도 isFaded 플래그가
  // 설정되어야 하며, 이후 배경 음악이 재생될 때 볼륨 0으로 시작해야 한다.

  it("안내 방송 재생 중 배경 음악 시작 시 볼륨 0으로 재생", async () => {
    // 배경 음악 없는 상태에서 fadeOut (안내 방송 시작 시뮬레이션)
    const result = await setupWithOneTrack();

    act(() => { result.current.fadeOut(); });

    // 안내 방송 재생 중에 배경 음악 재생
    await act(async () => { result.current.play(); });
    await waitFor(() => expect(result.current.isPlaying).toBe(true));

    expect(mockAudioInstances[mockAudioInstances.length - 1].volume).toBe(0);
  });

  it("배경 음악 없을 때 fadeOut 후 fadeIn → 이후 배경 음악 재생 시 정상 볼륨으로 시작", async () => {
    const result = await setupWithOneTrack();
    const targetVolume = result.current.volume;

    // 배경 음악 없이 fadeOut → fadeIn (안내 방송 시작 후 종료 시뮬레이션)
    act(() => {
      result.current.fadeOut();
      result.current.fadeIn();
    });

    // 안내 방송 종료 후 배경 음악 재생
    await act(async () => { result.current.play(); });
    await waitFor(() => expect(result.current.isPlaying).toBe(true));

    expect(mockAudioInstances[mockAudioInstances.length - 1].volume).toBe(targetVolume);
  });

  it("배경 음악 없을 때 fadeOut 중복 호출 시 두 번째는 무시됨", async () => {
    jest.useFakeTimers();

    const result = await setupWithOneTrack();

    await act(async () => { result.current.play(); });
    await waitFor(() => expect(result.current.isPlaying).toBe(true));

    const audio = mockAudioInstances[mockAudioInstances.length - 1];
    audio.volume = result.current.volume;

    act(() => {
      result.current.fadeOut();
      result.current.fadeOut(); // 이미 faded 상태 → 무시
      jest.advanceTimersByTime(2000);
    });

    expect(audio.volume).toBe(0);

    jest.useRealTimers();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("설정 영속성 (localStorage)", () => {
  it("설정을 localStorage에 저장하고 재마운트 시 복원", () => {
    const { result, unmount } = renderHook(() => useBgMusic());

    act(() => {
      result.current.createPlaylist("저장될 플레이리스트");
      result.current.setAutoplay(true);
      result.current.setVolume(0.4);
    });

    unmount();

    const { result: result2 } = renderHook(() => useBgMusic());

    expect(result2.current.playlists).toHaveLength(1);
    expect(result2.current.playlists[0].name).toBe("저장될 플레이리스트");
    expect(result2.current.autoplay).toBe(true);
    expect(result2.current.volume).toBe(0.4);
  });

  it("localStorage 데이터가 손상된 경우 기본값으로 초기화", () => {
    localStorage.setItem("bg-music-settings", "{ broken json {{");

    const { result } = renderHook(() => useBgMusic());

    expect(result.current.playlists).toEqual([]);
    expect(result.current.volume).toBe(0.7);
    expect(result.current.autoplay).toBe(false);
  });

  it("setAutoplay: 자동 재생 설정 토글", () => {
    const { result } = renderHook(() => useBgMusic());

    act(() => { result.current.setAutoplay(true); });
    expect(result.current.autoplay).toBe(true);

    act(() => { result.current.setAutoplay(false); });
    expect(result.current.autoplay).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("자동 재생 (autoplay)", () => {
  it("autoplay=true이고 플레이리스트에 트랙이 있으면 마운트 시 자동 재생", async () => {
    // localStorage에 autoplay=true 설정 저장
    const playlistId = "playlist-autoplay-test";
    const trackId = "track-autoplay-test";

    localStorage.setItem(
      "bg-music-settings",
      JSON.stringify({
        playlists: [{ id: playlistId, name: "자동재생 플레이리스트", trackIds: [trackId], loop: false }],
        trackMeta: [{ id: trackId, name: "자동재생 트랙" }],
        currentPlaylistId: playlistId,
        currentTrackIndex: 0,
        autoplay: true,
        volume: 0.7,
      })
    );

    const { result } = renderHook(() => useBgMusic());

    await waitFor(() => expect(result.current.isPlaying).toBe(true));
    expect(mockGetTrackBlob).toHaveBeenCalledWith(trackId);
  });

  it("autoplay=false이면 마운트 시 재생하지 않음", () => {
    localStorage.setItem(
      "bg-music-settings",
      JSON.stringify({
        playlists: [{ id: "pl1", name: "플레이리스트", trackIds: ["tr1"], loop: false }],
        trackMeta: [{ id: "tr1", name: "트랙" }],
        currentPlaylistId: "pl1",
        currentTrackIndex: 0,
        autoplay: false,
        volume: 0.7,
      })
    );

    renderHook(() => useBgMusic());

    expect(mockGetTrackBlob).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("플레이리스트 전환 및 재생 유지", () => {
  it("다른 플레이리스트를 클릭해도 현재 재생 중인 음악이 중단되지 않음", async () => {
    const { result } = renderHook(() => useBgMusic());

    // 1. 플레이리스트 두 개 생성 및 곡 추가
    act(() => {
      result.current.createPlaylist("Playlist 1");
    });
    const id1 = result.current.playlists[0].id;
    
    act(() => {
      result.current.createPlaylist("Playlist 2");
    });
    const id2 = result.current.playlists[1].id;

    await act(async () => {
      await result.current.addTrack(new File(["a"], "a.mp3"), id1);
      await result.current.addTrack(new File(["b"], "b.mp3"), id2);
    });

    // 2. Playlist 1의 곡 재생 시작 (명시적으로 id1 선택 후 재생)
    act(() => {
      result.current.setCurrentPlaylist(id1);
    });
    await act(async () => {
      result.current.play(0);
    });
    await waitFor(() => expect(result.current.isPlaying).toBe(true));
    expect(result.current.playingPlaylistId).toBe(id1);

    // 3. Playlist 2로 전환 (단순 클릭)
    act(() => {
      result.current.setCurrentPlaylist(id2);
    });

    // 4. 결과 검증
    expect(result.current.isPlaying).toBe(true); // 재생이 중단되지 않아야 함
    expect(result.current.currentPlaylistId).toBe(id2); // 선택(View)은 Playlist 2
    expect(result.current.playingPlaylistId).toBe(id1); // 오디오 컨텐츠(Playing)는 여전히 Playlist 1
    expect(result.current.currentTrack?.name).toBe("a"); // 하단 바 정보 등은 여전히 'a' 트랙
  });

  it("새로운 플레이리스트의 곡을 재생할 때만 재생 컨텍스트가 전환됨", async () => {
    const { result } = renderHook(() => useBgMusic());

    act(() => {
      result.current.createPlaylist("Playlist 1");
      result.current.createPlaylist("Playlist 2");
    });
    const id1 = result.current.playlists[0].id;
    const id2 = result.current.playlists[1].id;

    await act(async () => {
      await result.current.addTrack(new File(["a"], "a.mp3"), id1);
      await result.current.addTrack(new File(["b"], "b.mp3"), id2);
    });

    // Playlist 1 재생 시작
    act(() => { result.current.setCurrentPlaylist(id1); });
    await act(async () => { result.current.play(0); });
    await waitFor(() => expect(result.current.isPlaying).toBe(true));

    // Playlist 2로 선택 전환
    act(() => { result.current.setCurrentPlaylist(id2); });
    
    // Playlist 2의 곡 재생 시작 (이 시점에서야 컨텍스트 전환)
    await act(async () => {
      result.current.play(0);
    });
    
    await waitFor(() => {
      expect(result.current.playingPlaylistId).toBe(id2);
      expect(result.current.currentTrack?.name).toBe("b");
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("addTrack - onProgress 콜백", () => {
  let mockReaderInstance: {
    onprogress: ((e: Partial<ProgressEvent>) => void) | null;
    onload: (() => void) | null;
    onerror: (() => void) | null;
    error: Error | null;
    readAsArrayBuffer: jest.Mock;
  } | null;

  class MockFileReader {
    onprogress: ((e: Partial<ProgressEvent>) => void) | null = null;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    error: Error | null = null;
    readAsArrayBuffer = jest.fn(() => { mockReaderInstance = this; });
  }

  let originalFileReader: typeof FileReader;

  beforeEach(() => {
    mockReaderInstance = null;
    originalFileReader = global.FileReader;
    global.FileReader = MockFileReader as unknown as typeof FileReader;
  });

  afterEach(() => {
    global.FileReader = originalFileReader;
  });

  it("파일 읽기 중 onProgress가 0-75 범위로 호출됨", async () => {
    const { result } = renderHook(() => useBgMusic());
    const onProgress = jest.fn();
    const file = new File(["audio"], "test.mp3");

    let addTrackPromise!: Promise<void>;
    act(() => {
      addTrackPromise = result.current.addTrack(file, undefined, onProgress);
    });

    expect(mockReaderInstance).not.toBeNull();

    // 50% 읽기 진행 → Math.round(50/100 * 75) = Math.round(37.5) = 38
    act(() => {
      mockReaderInstance!.onprogress?.({ lengthComputable: true, loaded: 50, total: 100 });
    });
    expect(onProgress).toHaveBeenCalledWith(38);

    // 100% 읽기 진행 → Math.round(100/100 * 75) = 75
    act(() => {
      mockReaderInstance!.onprogress?.({ lengthComputable: true, loaded: 100, total: 100 });
    });
    expect(onProgress).toHaveBeenCalledWith(75);

    // onload 완료 → 80%, 90%, 100% 순서로 호출
    await act(async () => {
      mockReaderInstance!.onload?.();
      await addTrackPromise;
    });

    expect(onProgress).toHaveBeenCalledWith(80);
    expect(onProgress).toHaveBeenCalledWith(90);
    expect(onProgress).toHaveBeenCalledWith(100);
  });

  it("onProgress 호출 순서: 읽기 중(0-75%) → 로드 완료(80) → 저장 전(90) → 저장 후(100)", async () => {
    const { result } = renderHook(() => useBgMusic());
    const calls: number[] = [];
    const onProgress = jest.fn((v: number) => calls.push(v));
    const file = new File(["audio"], "order-test.mp3");

    let addTrackPromise!: Promise<void>;
    act(() => {
      addTrackPromise = result.current.addTrack(file, undefined, onProgress);
    });

    act(() => {
      mockReaderInstance!.onprogress?.({ lengthComputable: true, loaded: 30, total: 100 });
    });

    await act(async () => {
      mockReaderInstance!.onload?.();
      await addTrackPromise;
    });

    expect(calls[0]).toBe(23); // Math.round(30/100 * 75) = Math.round(22.5) = 23
    expect(calls[1]).toBe(80);
    expect(calls[2]).toBe(90);
    expect(calls[3]).toBe(100);
  });

  it("lengthComputable=false이면 읽기 중에는 onProgress를 호출하지 않음", async () => {
    const { result } = renderHook(() => useBgMusic());
    const onProgress = jest.fn();
    const file = new File(["audio"], "no-progress.mp3");

    let addTrackPromise!: Promise<void>;
    act(() => {
      addTrackPromise = result.current.addTrack(file, undefined, onProgress);
    });

    act(() => {
      mockReaderInstance!.onprogress?.({ lengthComputable: false, loaded: 50, total: 100 });
    });

    // 읽기 중에는 호출되지 않음
    expect(onProgress).not.toHaveBeenCalled();

    // 완료 후에는 80, 90, 100 호출됨
    await act(async () => {
      mockReaderInstance!.onload?.();
      await addTrackPromise;
    });

    expect(onProgress).toHaveBeenCalledWith(80);
    expect(onProgress).toHaveBeenCalledWith(90);
    expect(onProgress).toHaveBeenCalledWith(100);
  });

  it("파일 읽기 실패(onerror) 시 reader.error를 reject함", async () => {
    const { result } = renderHook(() => useBgMusic());
    const file = new File(["audio"], "fail.mp3");

    let caughtError: Error | null = null;
    let addTrackPromise!: Promise<void>;
    act(() => {
      addTrackPromise = result.current.addTrack(file);
    });

    await act(async () => {
      const mockError = new Error("읽기 실패");
      mockReaderInstance!.error = mockError;
      mockReaderInstance!.onerror?.();
      try { await addTrackPromise; } catch (e) { caughtError = e as Error; }
    });

    expect(caughtError).not.toBeNull();
    expect(caughtError!.message).toBe("읽기 실패");
  });

  it("파일 읽기 실패 시 FileReader.error가 null이면 '파일 읽기 실패' 기본 오류 사용", async () => {
    const { result } = renderHook(() => useBgMusic());
    const file = new File(["audio"], "null-error.mp3");

    let caughtError: Error | null = null;
    let addTrackPromise!: Promise<void>;
    act(() => {
      addTrackPromise = result.current.addTrack(file);
    });

    await act(async () => {
      mockReaderInstance!.error = null;
      mockReaderInstance!.onerror?.();
      try { await addTrackPromise; } catch (e) { caughtError = e as Error; }
    });

    expect(caughtError).not.toBeNull();
    expect(caughtError!.message).toBe("파일 읽기 실패");
  });

  it("onProgress 미전달 시에도 addTrack이 정상적으로 트랙을 추가함", async () => {
    const { result } = renderHook(() => useBgMusic());
    const file = new File(["audio"], "no-callback.mp3");

    let addTrackPromise!: Promise<void>;
    act(() => {
      addTrackPromise = result.current.addTrack(file); // onProgress 없음
    });

    await act(async () => {
      mockReaderInstance!.onload?.();
      await addTrackPromise;
    });

    expect(result.current.tracks).toHaveLength(1);
    expect(result.current.tracks[0].name).toBe("no-callback");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("전체 음악 목록 (Default Playlist)", () => {
  it("loopAll: 전체 음악 목록 루프 설정 및 동작", async () => {
    const { result } = renderHook(() => useBgMusic());

    const fileA = new File(["a"], "a.mp3");
    const fileB = new File(["b"], "b.mp3");

    await act(async () => {
      await result.current.addTrack(fileA);
      await result.current.addTrack(fileB);
    });

    // loopAll ON
    act(() => {
      result.current.setLoop(null, true);
    });
    expect(result.current.loopAll).toBe(true);

    // 마지막 트랙 재생
    await act(async () => { result.current.play(1); });
    await waitFor(() => expect(result.current.isPlaying).toBe(true));
    expect(result.current.currentTrackIndex).toBe(1);

    const audio = mockAudioInstances[mockAudioInstances.length - 1];
    
    // 종료 트리거 -> 첫 트랙으로
    await act(async () => {
      audio.triggerEnded();
    });
    await waitFor(() => expect(result.current.currentTrackIndex).toBe(0));
  });

  it("autoplay: 전체 음악 목록에서도 자동 재생 동작", async () => {
    const trackId = "track-1";
    localStorage.setItem(
      "bg-music-settings",
      JSON.stringify({
        playlists: [],
        trackMeta: [{ id: trackId, name: "트랙1" }],
        currentPlaylistId: null,
        currentTrackIndex: 0,
        autoplay: true,
        volume: 0.7,
        loopAll: false,
      })
    );

    const { result } = renderHook(() => useBgMusic());

    await waitFor(() => expect(result.current.isPlaying).toBe(true));
    expect(mockGetTrackBlob).toHaveBeenCalledWith(trackId);
  });

  it("reorderTrack: 전체 음악 목록(trackMeta) 순서 변경", async () => {
    const { result } = renderHook(() => useBgMusic());

    const fileA = new File(["a"], "a.mp3");
    const fileB = new File(["b"], "b.mp3");

    await act(async () => {
      await result.current.addTrack(fileA);
      await result.current.addTrack(fileB);
    });

    const [idA, idB] = result.current.tracks.map(t => t.id);
    expect(result.current.tracks.map(t => t.id)).toEqual([idA, idB]);

    // 전체 목록(null)에서 순서 변경
    act(() => {
      result.current.reorderTrack(null, 0, 1);
    });

    expect(result.current.tracks.map(t => t.id)).toEqual([idB, idA]);
  });
});
