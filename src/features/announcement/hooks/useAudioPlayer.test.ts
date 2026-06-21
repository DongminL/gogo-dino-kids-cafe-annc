import { renderHook, act } from "@testing-library/react";
import { useAudioPlayer } from "@/features/announcement/hooks/useAudioPlayer";
import { resetAudioPlayerStore } from "@/features/announcement/stores/useAudioPlayerStore";

// ─── HTMLAudioElement 모킹 ────────────────────────────────────────────────────
let mockAudioInstances: MockAudio[] = [];

class MockAudio {
  volume = 1;
  currentTime = 0;
  duration = 120;
  src: string;
  ontimeupdate: (() => void) | null = null;
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;

  play = jest.fn().mockResolvedValue(undefined);
  pause = jest.fn();

  constructor(src: string) {
    this.src = src;
    mockAudioInstances.push(this);
  }

  triggerTimeUpdate(currentTime: number, duration = this.duration) {
    this.currentTime = currentTime;
    this.duration = duration;
    this.ontimeupdate?.();
  }

  triggerEnded() {
    this.onended?.();
  }

  triggerError() {
    this.onerror?.();
  }
}

const mockAnnouncement = {
  id: "test-ann",
  title: "테스트 안내",
  audioFile: "/audio/test.mp3",
  category: "attraction" as const,
  defaultSchedule: {
    type: "once" as const,
    time: "09:00",
    intervalMinutes: 0,
    enabled: false,
  },
};

beforeAll(() => {
  global.Audio = MockAudio as unknown as typeof Audio;
});

beforeEach(() => {
  mockAudioInstances = [];
  jest.clearAllMocks();
  resetAudioPlayerStore();
});

// ─────────────────────────────────────────────────────────────────────────────
describe("초기 상태", () => {
  it("기본값으로 초기화", () => {
    const { result } = renderHook(() => useAudioPlayer());

    expect(result.current.playingId).toBeNull();
    expect(result.current.progress).toEqual({ current: 0, duration: 0 });
    expect(result.current.volume).toBe(1.0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("재생", () => {
  it("play: Audio 생성 후 재생 시작, playingId 설정", async () => {
    const { result } = renderHook(() => useAudioPlayer());

    await act(async () => {
      result.current.play(mockAnnouncement);
    });

    expect(result.current.playingId).toBe("test-ann");
    expect(mockAudioInstances).toHaveLength(1);
    expect(mockAudioInstances[0].play).toHaveBeenCalled();
  });

  it("play: 새 항목 재생 시 기존 Audio 중지", async () => {
    const { result } = renderHook(() => useAudioPlayer());

    await act(async () => {
      result.current.play(mockAnnouncement);
    });

    const firstAudio = mockAudioInstances[0];

    await act(async () => {
      result.current.play({ ...mockAnnouncement, id: "ann-2" });
    });

    expect(firstAudio.pause).toHaveBeenCalled();
    expect(result.current.playingId).toBe("ann-2");
  });

  it("play: 재생 실패 시 playingId=null", async () => {
    const failingPlay = jest.fn().mockRejectedValueOnce(new Error("autoplay blocked"));
    const originalAudio = global.Audio;
    class FailAudio extends MockAudio {
      play = failingPlay;
    }
    global.Audio = FailAudio as unknown as typeof Audio;

    const { result } = renderHook(() => useAudioPlayer());

    await act(async () => {
      result.current.play(mockAnnouncement);
    });

    expect(result.current.playingId).toBeNull();
    global.Audio = originalAudio;
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("정지", () => {
  it("stop: Audio 중지 및 playingId=null, progress 초기화", async () => {
    const { result } = renderHook(() => useAudioPlayer());

    await act(async () => {
      result.current.play(mockAnnouncement);
    });
    expect(result.current.playingId).toBe("test-ann");

    act(() => {
      result.current.stop();
    });

    expect(result.current.playingId).toBeNull();
    expect(result.current.progress).toEqual({ current: 0, duration: 0 });
    expect(mockAudioInstances[0].pause).toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("진행 상태", () => {
  it("재생 중 timeupdate 이벤트 시 progress 업데이트", async () => {
    const { result } = renderHook(() => useAudioPlayer());

    await act(async () => {
      result.current.play(mockAnnouncement);
    });

    act(() => {
      mockAudioInstances[0].triggerTimeUpdate(30, 120);
    });

    expect(result.current.progress.current).toBe(30);
    expect(result.current.progress.duration).toBe(120);
  });

  it("재생 종료(ended) 시 playingId=null, progress 초기화", async () => {
    const { result } = renderHook(() => useAudioPlayer());

    await act(async () => {
      result.current.play(mockAnnouncement);
    });

    act(() => {
      mockAudioInstances[0].triggerEnded();
    });

    expect(result.current.playingId).toBeNull();
    expect(result.current.progress).toEqual({ current: 0, duration: 0 });
  });

  it("오류 발생 시 playingId=null", async () => {
    const { result } = renderHook(() => useAudioPlayer());

    await act(async () => {
      result.current.play(mockAnnouncement);
    });

    act(() => {
      mockAudioInstances[0].triggerError();
    });

    expect(result.current.playingId).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("시간 이동", () => {
  it("seek: 재생 중인 오디오의 currentTime 변경", async () => {
    const { result } = renderHook(() => useAudioPlayer());

    await act(async () => {
      result.current.play(mockAnnouncement);
    });

    act(() => {
      result.current.seek(60);
    });

    expect(mockAudioInstances[0].currentTime).toBe(60);
    expect(result.current.progress.current).toBe(60);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("큐 재생 (enqueue)", () => {
  const ann1 = { ...mockAnnouncement, id: "ann-1" };
  const ann2 = { ...mockAnnouncement, id: "ann-2" };
  const ann3 = { ...mockAnnouncement, id: "ann-3" };

  it("재생 중일 때 큐에 추가하고 현재 트랙 종료 후 순차 재생", async () => {
    const { result } = renderHook(() => useAudioPlayer());

    await act(async () => {
      result.current.play(ann1);
    });
    expect(result.current.playingId).toBe("ann-1");

    act(() => {
      result.current.enqueue(ann2);
    });

    // ann1 종료 → 큐에서 ann2 자동 재생
    act(() => {
      mockAudioInstances[0].triggerEnded();
    });

    expect(result.current.playingId).toBe("ann-2");
    expect(mockAudioInstances).toHaveLength(2);
  });

  it("우선순위 낮은 값이 먼저 재생됨 (priority 1 < 2)", async () => {
    const { result } = renderHook(() => useAudioPlayer());

    await act(async () => {
      result.current.play(ann1);
    });

    // priority 2인 ann3 먼저 큐에 추가, 그 다음 priority 1인 ann2 추가
    act(() => {
      result.current.enqueue(ann3, 2);
      result.current.enqueue(ann2, 1); // 낮은 priority → 앞으로 삽입됨
    });

    // ann1 종료 → priority 1인 ann2가 먼저 재생
    act(() => {
      mockAudioInstances[0].triggerEnded();
    });
    expect(result.current.playingId).toBe("ann-2");

    // ann2 종료 → priority 2인 ann3 재생
    act(() => {
      mockAudioInstances[1].triggerEnded();
    });
    expect(result.current.playingId).toBe("ann-3");
  });

  it("stop 호출 시 큐 비워짐 — 정지 후 이전 큐 항목이 재생되지 않음", async () => {
    const { result } = renderHook(() => useAudioPlayer());

    await act(async () => {
      result.current.play(ann1);
    });
    expect(result.current.playingId).toBe("ann-1");

    act(() => {
      result.current.enqueue(ann2);
    });

    // stop → 큐 비워짐
    act(() => {
      result.current.stop();
    });
    expect(result.current.playingId).toBeNull();

    // stop 이후 enqueue → audioRef=null이므로 ann3이 즉시 재생 (ann2는 큐에서 제거됨)
    await act(async () => {
      result.current.enqueue(ann3);
    });
    expect(result.current.playingId).toBe("ann-3");
    expect(mockAudioInstances).toHaveLength(2); // ann1 + ann3 (ann2는 재생 안 됨)
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("볼륨", () => {
  it("setVolume: 볼륨 값 변경", () => {
    const { result } = renderHook(() => useAudioPlayer());

    act(() => {
      result.current.setVolume(0.5);
    });

    expect(result.current.volume).toBe(0.5);
  });

  it("setVolume: 재생 중인 오디오에 즉시 반영", async () => {
    const { result } = renderHook(() => useAudioPlayer());

    await act(async () => {
      result.current.play(mockAnnouncement);
    });

    act(() => {
      result.current.setVolume(0.3);
    });

    expect(mockAudioInstances[0].volume).toBe(0.3);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("레이스 컨디션 회귀 (generation 가드)", () => {
  const ann1 = { ...mockAnnouncement, id: "ann-1" };
  const ann2 = { ...mockAnnouncement, id: "ann-2" };
  const ann3 = { ...mockAnnouncement, id: "ann-3" };

  it("stale onerror 이중 발화 시 큐를 건너뛰지 않음", async () => {
    const { result } = renderHook(() => useAudioPlayer());

    await act(async () => { result.current.play(ann1); });
    expect(result.current.playingId).toBe("ann-1");

    act(() => {
      result.current.enqueue(ann2);
      result.current.enqueue(ann3);
    });

    const firstAudio = mockAudioInstances[0];

    // ann1 종료 → ann2 재생 시작
    act(() => { firstAudio.triggerEnded(); });
    expect(result.current.playingId).toBe("ann-2");
    expect(mockAudioInstances).toHaveLength(2);

    // stale onerror 발화 — generation 가드로 무시되어야 함 (수정 전엔 ann3이 잘못 재생됨)
    act(() => { firstAudio.triggerError(); });
    expect(result.current.playingId).toBe("ann-2");
    expect(mockAudioInstances).toHaveLength(2);
  });

  it("새 play 후 옛 audio의 늦은 play() reject가 새 재생을 끊지 않음", async () => {
    let rejectFirstPlay!: (reason: Error) => void;
    const firstPlayPromise = new Promise<void>((_, rej) => { rejectFirstPlay = rej; });
    let deferredUsed = false;

    const originalAudio = global.Audio;
    class DeferredPlayAudio extends MockAudio {
      play = jest.fn(() => {
        if (!deferredUsed) { deferredUsed = true; return firstPlayPromise; }
        return Promise.resolve();
      });
    }
    global.Audio = DeferredPlayAudio as unknown as typeof Audio;

    const { result } = renderHook(() => useAudioPlayer());

    act(() => { result.current.play(ann1); });
    expect(result.current.playingId).toBe("ann-1");

    // ann2로 교체 재생 — ann1의 play()는 아직 pending
    await act(async () => { result.current.play(ann2); });
    expect(result.current.playingId).toBe("ann-2");

    // 옛 play() reject — generation 가드로 새 재생에 영향 없어야 함
    await act(async () => { rejectFirstPlay(new Error("interrupted")); });
    expect(result.current.playingId).toBe("ann-2");

    global.Audio = originalAudio;
  });
});
