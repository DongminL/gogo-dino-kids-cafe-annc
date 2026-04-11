import { test, expect } from "@playwright/test";

const TRACK_ID = "e2e-bgm-track";
const TRACK_NAME = "테스트 배경음악";
const BGM_VOLUME = 0.7;

/** 5초짜리 무음 WAV 버퍼(Node.js Buffer)를 생성합니다. */
function createSilentWavBuffer(durationSecs = 5): Buffer {
  const sampleRate = 8000;
  const numSamples = sampleRate * durationSecs;
  const buf = Buffer.alloc(44 + numSamples);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + numSamples, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate, 28);
  buf.writeUInt16LE(1, 32);
  buf.writeUInt16LE(8, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(numSamples, 40);
  return buf;
}

test.describe("배경음악 페이드 인/아웃", () => {
  test.beforeEach(async ({ page }) => {
    // 1) play()를 항상 resolve로 mock → autoplay 정책 우회
    //    volume setter를 후킹 → BGM 볼륨 변화 추적
    await page.addInitScript(() => {
      (window as any).__bgmVolumeLog = [];

      HTMLMediaElement.prototype.play = function () {
        return Promise.resolve();
      };

      const desc = Object.getOwnPropertyDescriptor(
        HTMLMediaElement.prototype,
        "volume"
      )!;
      Object.defineProperty(HTMLMediaElement.prototype, "volume", {
        get() {
          return desc.get!.call(this);
        },
        set(val: number) {
          // blob: URL이면 BGM 오디오로 판단
          const isBgm = (this.src || "").startsWith("blob:");
          (window as any).__bgmVolumeLog.push({ v: val, isBgm });
          desc.set!.call(this, val);
        },
        configurable: true,
      });
    });

    // 2) 페이지 로드 전에 localStorage에 BGM 트랙 설정 주입
    await page.addInitScript(
      ({ trackId, trackName, volume }) => {
        localStorage.setItem(
          "bg-music-settings",
          JSON.stringify({
            playlists: [],
            trackMeta: [{ id: trackId, name: trackName }],
            currentPlaylistId: null,
            currentTrackIndex: 0,
            autoplay: false,
            volume,
            loopAll: false,
          })
        );
      },
      { trackId: TRACK_ID, trackName: TRACK_NAME, volume: BGM_VOLUME }
    );

    // 3) 안내방송 오디오 파일 요청을 무음 WAV로 대체
    await page.route("**/*.mp3", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "audio/wav",
        body: createSilentWavBuffer(10),
      });
    });

    await page.goto("/");

    // 4) IndexedDB에 BGM용 무음 WAV blob 저장
    await page.evaluate(({ trackId }) => {
      return new Promise<void>((resolve, reject) => {
        const sampleRate = 8000;
        const numSamples = sampleRate * 10;
        const buf = new ArrayBuffer(44 + numSamples);
        const v = new DataView(buf);
        const writeStr = (off: number, str: string) => {
          for (let i = 0; i < str.length; i++) v.setUint8(off + i, str.charCodeAt(i));
        };
        writeStr(0, "RIFF");
        v.setUint32(4, 36 + numSamples, true);
        writeStr(8, "WAVE");
        writeStr(12, "fmt ");
        v.setUint32(16, 16, true);
        v.setUint16(20, 1, true);
        v.setUint16(22, 1, true);
        v.setUint32(24, sampleRate, true);
        v.setUint32(28, sampleRate, true);
        v.setUint16(32, 1, true);
        v.setUint16(34, 8, true);
        writeStr(36, "data");
        v.setUint32(40, numSamples, true);
        const blob = new Blob([buf], { type: "audio/wav" });

        const req = indexedDB.open("gogo-dino-bgmusic", 1);
        req.onupgradeneeded = () => {
          if (!req.result.objectStoreNames.contains("tracks")) {
            req.result.createObjectStore("tracks", { keyPath: "id" });
          }
        };
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction("tracks", "readwrite");
          tx.objectStore("tracks").put({ id: trackId, blob });
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(new Error("IDB 쓰기 실패"));
        };
        req.onerror = () => reject(new Error("IDB 열기 실패"));
      });
    }, { trackId: TRACK_ID });
  });

  test("안내방송 재생 시 배경음악 볼륨이 페이드 아웃된다", async ({ page }) => {
    // BGM 재생 시작
    await page.getByRole("button", { name: "재생", exact: true }).click();

    // BGM 오디오 엘리먼트에 목표 볼륨(0.7)이 설정될 때까지 대기
    await page.waitForFunction(
      () =>
        (window as any).__bgmVolumeLog.some(
          (e: { v: number; isBgm: boolean }) => e.isBgm && e.v >= 0.69
        ),
      { timeout: 5000 }
    );

    // 페이드 아웃 시작 지점 기록
    await page.evaluate(() => {
      (window as any).__fadeOutStart = (window as any).__bgmVolumeLog.length;
    });

    // 안내방송 재생 → bgMusic.fadeOut() 트리거
    await page.getByRole("button", { name: "▶ 재생" }).first().click();

    // FADE_DURATION_MS(1500ms) 이상 대기
    await page.waitForTimeout(2000);

    // BGM 볼륨이 0에 가까워졌는지 확인
    const result = await page.evaluate(() => {
      const log: { v: number; isBgm: boolean }[] = (window as any).__bgmVolumeLog;
      const from: number = (window as any).__fadeOutStart ?? 0;
      const bgmSteps = log.slice(from).filter((e) => e.isBgm);
      return {
        stepCount: bgmSteps.length,
        minVolume: bgmSteps.length > 0 ? Math.min(...bgmSteps.map((e) => e.v)) : 1,
        fadedToNearZero: bgmSteps.some((e) => e.v < 0.05),
      };
    });

    expect(result.stepCount).toBeGreaterThan(5); // 최소 5단계 페이드 스텝
    expect(result.fadedToNearZero).toBe(true);
  });

  test("안내방송 정지 후 배경음악 볼륨이 페이드 인된다", async ({ page }) => {
    // BGM 재생 시작
    await page.getByRole("button", { name: "재생", exact: true }).click();
    await page.waitForFunction(
      () =>
        (window as any).__bgmVolumeLog.some(
          (e: { v: number; isBgm: boolean }) => e.isBgm && e.v >= 0.69
        ),
      { timeout: 5000 }
    );

    // 안내방송 재생 → 페이드 아웃 발생
    await page.getByRole("button", { name: "▶ 재생" }).first().click();
    await page.waitForTimeout(2000); // 페이드 아웃 완료 대기

    // 페이드 인 시작 지점 기록
    await page.evaluate(() => {
      (window as any).__fadeInStart = (window as any).__bgmVolumeLog.length;
    });

    // 안내방송 정지 → bgMusic.fadeIn() 트리거
    await page.getByRole("button", { name: "■ 정지" }).click();

    // FADE_DURATION_MS(1500ms) 이상 대기
    await page.waitForTimeout(2000);

    // BGM 볼륨이 목표값(0.7)으로 복원됐는지 확인
    const result = await page.evaluate(() => {
      const log: { v: number; isBgm: boolean }[] = (window as any).__bgmVolumeLog;
      const from: number = (window as any).__fadeInStart ?? 0;
      const bgmSteps = log.slice(from).filter((e) => e.isBgm);
      return {
        stepCount: bgmSteps.length,
        maxVolume: bgmSteps.length > 0 ? Math.max(...bgmSteps.map((e) => e.v)) : 0,
        fadedToTarget: bgmSteps.some((e) => e.v >= 0.69),
      };
    });

    expect(result.stepCount).toBeGreaterThan(5);
    expect(result.fadedToTarget).toBe(true);
  });
});
