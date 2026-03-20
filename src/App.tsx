import React, { useState, useEffect, useRef, useCallback } from 'react';
import './App.scss';

type ScheduleType = 'none' | 'once' | 'odd-hour' | 'even-hour' | 'interval';
type Category = 'attraction' | 'closing' | 'table';

interface Schedule {
  type: ScheduleType;
  time: string;
  intervalMinutes: number;
  enabled: boolean;
}

interface AnnouncementDef {
  id: string;
  title: string;
  category: Category;
  audioFile: string;
  defaultSchedule: Schedule;
}

const ANNOUNCEMENT_DEFS: AnnouncementDef[] = [
  {
    id: 'dance-trampoline',
    title: '댄스트램폴린',
    category: 'attraction',
    audioFile: 'dance-trampoline.wav',
    defaultSchedule: { type: 'odd-hour', time: '00:00', intervalMinutes: 30, enabled: true },
  },
  {
    id: 'zipline',
    title: '짚라인',
    category: 'attraction',
    audioFile: 'zip-line.mp3',
    defaultSchedule: { type: 'even-hour', time: '00:00', intervalMinutes: 30, enabled: true },
  },
  {
    id: 'photo-time',
    title: '포토타임',
    category: 'attraction',
    audioFile: 'photo-time.wav',
    defaultSchedule: { type: 'none', time: '00:00', intervalMinutes: 30, enabled: false },
  },
  {
    id: 'meal-order',
    title: '식사주문 마감',
    category: 'closing',
    audioFile: 'meal-order.mp3',
    defaultSchedule: { type: 'once', time: '18:15', intervalMinutes: 30, enabled: true },
  },
  {
    id: 'cafe-order',
    title: '카페음료 마감',
    category: 'closing',
    audioFile: 'cafe-order.mp3',
    defaultSchedule: { type: 'once', time: '18:50', intervalMinutes: 30, enabled: true },
  },
  {
    id: 'waterplay-close',
    title: '워터플레이존 마감',
    category: 'closing',
    audioFile: 'waterplay-close.wav',
    defaultSchedule: { type: 'once', time: '19:10', intervalMinutes: 30, enabled: true },
  },
  {
    id: 'exit',
    title: '퇴장',
    category: 'closing',
    audioFile: 'exit.wav',
    defaultSchedule: { type: 'once', time: '19:50', intervalMinutes: 30, enabled: true },
  },
  {
    id: 'table-yield',
    title: '식사 테이블 양보',
    category: 'table',
    audioFile: 'table-yield.wav',
    defaultSchedule: { type: 'none', time: '00:00', intervalMinutes: 30, enabled: false },
  },
];

const CATEGORY_LABELS: Record<Category, string> = {
  attraction: '어트랙션 운영',
  closing: '마감 안내 방송',
  table: '식사 테이블 양보 방송',
};

const SCHEDULE_TYPE_LABELS: Record<ScheduleType, string> = {
  none: '자동 재생 없음',
  once: '특정 시각 1회',
  'odd-hour': '매 홀수 시각 정각',
  'even-hour': '매 짝수 시각 정각',
  interval: '반복 간격',
};

function getKoreanTime(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
}

function formatTime(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

function formatDuration(seconds: number): string {
  if (!isFinite(seconds) || isNaN(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function getScheduleLabel(schedule: Schedule): string {
  if (!schedule.enabled || schedule.type === 'none') return '자동 재생 꺼짐';
  switch (schedule.type) {
    case 'once': return `${schedule.time} 자동 재생`;
    case 'odd-hour': return '홀수 시각 정각 자동 재생';
    case 'even-hour': return '짝수 시각 정각 자동 재생';
    case 'interval': return `${schedule.intervalMinutes}분마다 자동 재생`;
    default: return '';
  }
}

function loadSettings(): Record<string, Schedule> {
  try {
    const saved = localStorage.getItem('ann-schedules-v1');
    if (saved) return JSON.parse(saved);
  } catch { }
  return Object.fromEntries(ANNOUNCEMENT_DEFS.map(d => [d.id, { ...d.defaultSchedule }]));
}

function App() {
  const [currentTime, setCurrentTime] = useState<Date>(getKoreanTime());
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [audioProgress, setAudioProgress] = useState({ current: 0, duration: 0 });
  const [volume, setVolume] = useState(1.0);
  const [schedules, setSchedules] = useState<Record<string, Schedule>>(loadSettings);
  const [openSettingsId, setOpenSettingsId] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const volumeRef = useRef(1.0);
  const schedulesRef = useRef(schedules);
  const triggeredRef = useRef<Set<string>>(new Set());
  const lastDayRef = useRef<string>('');

  useEffect(() => { volumeRef.current = volume; if (audioRef.current) audioRef.current.volume = volume; }, [volume]);
  useEffect(() => { schedulesRef.current = schedules; localStorage.setItem('ann-schedules-v1', JSON.stringify(schedules)); }, [schedules]);

  // Clock tick
  useEffect(() => {
    const timer = setTimeout(() => setCurrentTime(getKoreanTime()), 1000);
    return () => clearTimeout(timer);
  }, [currentTime]);

  const handlePlay = useCallback((ann: AnnouncementDef) => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.ontimeupdate = null;
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current = null;
    }

    const audio = new Audio(ann.audioFile);
    audio.volume = volumeRef.current;
    audioRef.current = audio;
    setPlayingId(ann.id);
    setAudioProgress({ current: 0, duration: 0 });

    audio.ontimeupdate = () => {
      setAudioProgress({ current: audio.currentTime, duration: audio.duration || 0 });
    };
    audio.onended = () => {
      setPlayingId(null);
      setAudioProgress({ current: 0, duration: 0 });
      audioRef.current = null;
    };
    audio.onerror = () => {
      setPlayingId(null);
      audioRef.current = null;
    };

    audio.play().catch(() => {
      setPlayingId(null);
      audioRef.current = null;
    });
  }, []);

  const handleStop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.ontimeupdate = null;
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current = null;
    }
    setPlayingId(null);
    setAudioProgress({ current: 0, duration: 0 });
  }, []);

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value);
    if (audioRef.current) audioRef.current.currentTime = time;
    setAudioProgress(prev => ({ ...prev, current: time }));
  }, []);

  const handlePlayRef = useRef(handlePlay);
  useEffect(() => { handlePlayRef.current = handlePlay; }, [handlePlay]);

  // Auto-play scheduler
  useEffect(() => {
    const now = currentTime;
    const hh = now.getHours();
    const mm = now.getMinutes();
    const ss = now.getSeconds();

    if (ss !== 0) return;

    const dayStr = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
    if (lastDayRef.current !== dayStr) {
      triggeredRef.current = new Set();
      lastDayRef.current = dayStr;
    }

    ANNOUNCEMENT_DEFS.forEach(ann => {
      const schedule = schedulesRef.current[ann.id];
      if (!schedule?.enabled || schedule.type === 'none') return;

      const triggerKey = `${ann.id}-${dayStr}-${hh}:${String(mm).padStart(2, '0')}`;
      if (triggeredRef.current.has(triggerKey)) return;

      let fire = false;
      if (schedule.type === 'once' && schedule.time) {
        const [sh, sm] = schedule.time.split(':').map(Number);
        fire = hh === sh && mm === sm;
      } else if (schedule.type === 'odd-hour') {
        fire = mm === 0 && hh % 2 === 1;
      } else if (schedule.type === 'even-hour') {
        fire = mm === 0 && hh % 2 === 0;
      } else if (schedule.type === 'interval' && schedule.intervalMinutes > 0) {
        const totalMins = hh * 60 + mm;
        fire = totalMins > 0 && totalMins % schedule.intervalMinutes === 0;
      }

      if (fire) {
        triggeredRef.current.add(triggerKey);
        handlePlayRef.current(ann);
      }
    });
  }, [currentTime]);

  const updateSchedule = (id: string, update: Partial<Schedule>) => {
    setSchedules(prev => ({ ...prev, [id]: { ...prev[id], ...update } }));
  };

  const categories: Category[] = ['attraction', 'closing', 'table'];

  return (
    <div className="app">
      <header className="app-header">
        <img src="logo.png" alt="고고 다이노" className="logo" />
        <div className="header-info">
          <h1>고고 다이노 안내 방송</h1>
          <div className="current-time">{formatTime(currentTime)}</div>
        </div>
        <div className="volume-control">
          <span className="volume-label">볼륨</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={volume}
            onChange={e => setVolume(Number(e.target.value))}
            className="volume-slider"
          />
          <span className="volume-value">{Math.round(volume * 100)}%</span>
        </div>
      </header>

      <main className="app-main">
        {categories.map(cat => {
          const anns = ANNOUNCEMENT_DEFS.filter(a => a.category === cat);
          return (
            <section key={cat} className="category-section">
              <h2 className="section-title">{CATEGORY_LABELS[cat]}</h2>
              <div className="announcements">
                {anns.map(ann => {
                  const isPlaying = playingId === ann.id;
                  const schedule = schedules[ann.id];
                  const isSettingsOpen = openSettingsId === ann.id;
                  const isScheduleActive = schedule?.enabled && schedule.type !== 'none';

                  return (
                    <div key={ann.id} className={`announcement-card${isPlaying ? ' playing' : ''}`}>
                      <div className="card-header">
                        <div className="announcement-title">{ann.title}</div>
                        <button
                          className={`settings-toggle${isSettingsOpen ? ' active' : ''}`}
                          onClick={() => setOpenSettingsId(isSettingsOpen ? null : ann.id)}
                          title="스케줄 설정"
                        >
                          &#9881;
                        </button>
                      </div>

                      <div className="schedule-info">
                        <span className={`schedule-badge${isScheduleActive ? ' active' : ''}`}>
                          {getScheduleLabel(schedule)}
                        </span>
                      </div>

                      {isPlaying && (
                        <div className="audio-controls">
                          <input
                            type="range"
                            className="seek-bar"
                            min={0}
                            max={audioProgress.duration || 0}
                            step={0.1}
                            value={audioProgress.current}
                            onChange={handleSeek}
                          />
                          <div className="time-display">
                            <span>{formatDuration(audioProgress.current)}</span>
                            <span>{formatDuration(audioProgress.duration)}</span>
                          </div>
                        </div>
                      )}

                      <div className="card-actions">
                        {isPlaying ? (
                          <button className="stop-button" onClick={handleStop}>
                            &#9632; 정지
                          </button>
                        ) : (
                          <button className="play-button" onClick={() => handlePlay(ann)}>
                            &#9654; 재생
                          </button>
                        )}
                      </div>

                      {isSettingsOpen && (
                        <div className="settings-panel">
                          <div className="settings-row">
                            <span className="settings-label">자동 재생</span>
                            <label className="toggle-switch">
                              <input
                                type="checkbox"
                                checked={schedule?.enabled ?? false}
                                onChange={e => updateSchedule(ann.id, { enabled: e.target.checked })}
                              />
                              <span className="toggle-slider" />
                            </label>
                          </div>

                          {schedule?.enabled && (
                            <>
                              <div className="settings-row">
                                <span className="settings-label">재생 유형</span>
                                <select
                                  value={schedule.type}
                                  onChange={e => updateSchedule(ann.id, { type: e.target.value as ScheduleType })}
                                  className="settings-select"
                                >
                                  {(Object.keys(SCHEDULE_TYPE_LABELS) as ScheduleType[]).map(t => (
                                    <option key={t} value={t}>{SCHEDULE_TYPE_LABELS[t]}</option>
                                  ))}
                                </select>
                              </div>

                              {schedule.type === 'once' && (
                                <div className="settings-row">
                                  <span className="settings-label">재생 시각</span>
                                  <input
                                    type="time"
                                    value={schedule.time}
                                    onChange={e => updateSchedule(ann.id, { time: e.target.value })}
                                    className="settings-input"
                                  />
                                </div>
                              )}

                              {schedule.type === 'interval' && (
                                <div className="settings-row">
                                  <span className="settings-label">간격 (분)</span>
                                  <input
                                    type="number"
                                    min={1}
                                    max={120}
                                    value={schedule.intervalMinutes}
                                    onChange={e => updateSchedule(ann.id, { intervalMinutes: Number(e.target.value) })}
                                    className="settings-input settings-input-number"
                                  />
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </main>
      <footer className="app-footer">
        AI Voice: Supertone 제공
      </footer>
    </div>
  );
}

export default App;
