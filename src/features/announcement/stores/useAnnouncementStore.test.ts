import { useAnnouncementStore } from "@/features/announcement/stores/useAnnouncementStore";
import { getTtsAudioUrl, deleteTtsCache } from "@/features/announcement/ttsCache";

jest.mock("@/features/announcement/ttsCache", () => ({
  getTtsAudioUrl: jest.fn(),
  deleteTtsCache: jest.fn(),
}));

jest.mock("@/features/announcement/stores/useAudioPlayerStore", () => ({
  useAudioPlayerStore: {
    getState: () => ({ playingId: null, stop: jest.fn() }),
  },
}));

const mockedGetTtsAudioUrl = getTtsAudioUrl as jest.Mock;
const mockedDeleteTtsCache = deleteTtsCache as jest.Mock;

beforeEach(() => {
  localStorage.clear();
  useAnnouncementStore.setState({ customDefs: [] });
  jest.clearAllMocks();
  mockedGetTtsAudioUrl.mockResolvedValue("blob:mock-audio");
  mockedDeleteTtsCache.mockResolvedValue(undefined);
  (URL as unknown as { revokeObjectURL: jest.Mock }).revokeObjectURL = jest.fn();
});

describe("updateCustom", () => {
  it("멘트가 바뀌지 않으면 TTS를 재요청하지 않는다", async () => {
    const { addCustom, updateCustom } = useAnnouncementStore.getState();
    await addCustom("우천 안내", "attraction", "우천 시 안내 방송입니다.");
    const id = useAnnouncementStore.getState().customDefs[0].id;
    mockedGetTtsAudioUrl.mockClear();

    await updateCustom(id, "우천 안내 (수정)", "closing", "우천 시 안내 방송입니다.");

    expect(mockedGetTtsAudioUrl).not.toHaveBeenCalled();
    expect(mockedDeleteTtsCache).not.toHaveBeenCalled();
    const def = useAnnouncementStore.getState().customDefs[0];
    expect(def.title).toBe("우천 안내 (수정)");
    expect(def.category).toBe("closing");
  });

  it("멘트가 바뀌면 TTS를 재요청하고, 다른 곳에서 안 쓰는 이전 캐시를 삭제한다", async () => {
    const { addCustom, updateCustom } = useAnnouncementStore.getState();
    await addCustom("우천 안내", "attraction", "원본 멘트");
    const id = useAnnouncementStore.getState().customDefs[0].id;
    mockedGetTtsAudioUrl.mockClear();
    mockedGetTtsAudioUrl.mockResolvedValue("blob:new-audio");

    await updateCustom(id, "우천 안내", "attraction", "새 멘트");

    expect(mockedGetTtsAudioUrl).toHaveBeenCalledWith("새 멘트");
    expect(mockedDeleteTtsCache).toHaveBeenCalledWith("원본 멘트");
    expect(useAnnouncementStore.getState().customDefs[0].audioFile).toBe("blob:new-audio");
    expect(useAnnouncementStore.getState().customDefs[0].text).toBe("새 멘트");
  });

  it("같은 멘트를 쓰는 다른 커스텀 방송이 있으면 이전 캐시를 삭제하지 않는다", async () => {
    const { addCustom, updateCustom } = useAnnouncementStore.getState();
    await addCustom("A 방송", "attraction", "공용 멘트");
    await addCustom("B 방송", "attraction", "공용 멘트");
    const targetId = useAnnouncementStore.getState().customDefs[0].id;
    mockedGetTtsAudioUrl.mockClear();

    await updateCustom(targetId, "A 방송", "attraction", "A만의 새 멘트");

    expect(mockedDeleteTtsCache).not.toHaveBeenCalled();
  });
});
