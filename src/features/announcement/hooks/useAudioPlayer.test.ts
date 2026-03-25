import { renderHook, act } from "@testing-library/react";
import { useAudioPlayer } from "./useAudioPlayer";

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
