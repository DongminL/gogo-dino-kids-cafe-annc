import React, { useRef, useEffect, useState, useMemo, useCallback } from "react";
import "./TimePicker.scss";

interface TimePickerProps {
  mode: "once" | "odd-hour" | "even-hour";
  hour: string;
  minute: string;
  onChange: (mode: "once" | "odd-hour" | "even-hour", hour: string, minute: string) => void;
}

export interface WheelOption {
  label: string;
  value: string;
}

const ITEM_HEIGHT = 44;
const VISIBLE_ITEMS = 3; // Center + 1 above + 1 below shown in selection area, more visible via fade

export function TimePicker({ mode, hour, minute, onChange }: TimePickerProps) {
  const modeOptions: WheelOption[] = useMemo(() => [
    { label: "없음", value: "once" },
    { label: "홀수", value: "odd-hour" },
    { label: "짝수", value: "even-hour" },
  ], []);

  const hourOptions: WheelOption[] = useMemo(() => 
    Array.from({ length: 24 }, (_, i) => {
      const val = String(i).padStart(2, "0");
      return { label: val, value: val };
    }), []);

  const minuteOptions: WheelOption[] = useMemo(() => 
    Array.from({ length: 60 }, (_, i) => {
      const val = String(i).padStart(2, "0");
      return { label: val, value: val };
    }), []);

  return (
    <div className="shadcn-time-picker">
      <div className="picker-container">
        
        <div className="picker-column">
          <div className="column-label">반복</div>
          <Wheel 
            options={modeOptions} 
            value={mode} 
            onChange={(m) => onChange(m as "once" | "odd-hour" | "even-hour", hour, minute)} 
          />
        </div>

        <div className="picker-column">
          <div className="column-label">시간</div>
          {mode === "once" ? (
            <Wheel 
              options={hourOptions} 
              value={hour} 
              onChange={(h) => onChange(mode, h, minute)} 
            />
          ) : (
            <Wheel
              options={[{ label: "--", value: hour }]}
              value={hour}
              onChange={() => {}}
            />
          )}
        </div>
        
        <div className="picker-separator">:</div>
        
        <div className="picker-column">
          <div className="column-label">분</div>
          <Wheel 
            options={minuteOptions} 
            value={minute} 
            onChange={(m) => onChange(mode, hour, m)} 
          />
        </div>

        {/* The horizontal selection indicator lines */}
        <div className="selection-highlight" />
      </div>
    </div>
  );
}

interface WheelProps {
  options: WheelOption[];
  value: string;
  onChange: (v: string) => void;
}

function Wheel({ options, value, onChange }: WheelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isScrolling, setIsScrolling] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const wheelAccum = useRef(0);
  const isTransitioning = useRef(false);
  
  // To handle infinite scroll illusion, we repeat options
  const REPEAT_COUNT = 21; // Odd number for center alignment
  const extendedOptions = useMemo(() => {
    let arr: WheelOption[] = [];
    for (let i = 0; i < REPEAT_COUNT; i++) {
        arr = [...arr, ...options];
    }
    return arr;
  }, [options]);

  const centerSetIndex = Math.floor(REPEAT_COUNT / 2);
  const getInitialScroll = useCallback((val: string) => {
    const idx = options.findIndex(o => o.value === val);
    if (idx === -1) return 0;
    return (centerSetIndex * options.length + idx) * ITEM_HEIGHT;
  }, [options, centerSetIndex]);

  // Initial scroll and sync when value changes externally
  useEffect(() => {
    if (scrollRef.current) {
        const targetScroll = getInitialScroll(value);
        if (Math.abs(scrollRef.current.scrollTop - targetScroll) > 1) {
            scrollRef.current.scrollTop = targetScroll;
        }
    }
  }, [value, getInitialScroll]);

  // Handle Wheel Event Sensitivity
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (isTransitioning.current) return;

      wheelAccum.current += e.deltaY;
      
      // Sensitivity Threshold: Higher = less sensitive
      const THRESHOLD = 60; 

      if (Math.abs(wheelAccum.current) >= THRESHOLD) {
        const direction = wheelAccum.current > 0 ? 1 : -1;
        wheelAccum.current = 0;

        const currentScroll = el.scrollTop;
        const currentIndex = Math.round(currentScroll / ITEM_HEIGHT);
        const nextIndex = currentIndex + direction;

        isTransitioning.current = true;
        el.scrollTo({
          top: nextIndex * ITEM_HEIGHT,
          behavior: "smooth"
        });

        // Cooldown to prevent runaway scrolling
        setTimeout(() => {
          isTransitioning.current = false;
        }, 100);
      }
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    setIsScrolling(true);
    
    const scrollTop = scrollRef.current.scrollTop;
    const rawIndex = Math.round(scrollTop / ITEM_HEIGHT);
    const normalizedIndex = rawIndex % options.length;
    
    if (normalizedIndex !== activeIndex) {
      setActiveIndex(normalizedIndex);
    }
  };

  const handleScrollEnd = () => {
    setIsScrolling(false);
    if (!scrollRef.current) return;

    const scrollTop = scrollRef.current.scrollTop;
    const rawIndex = Math.round(scrollTop / ITEM_HEIGHT);
    
    // Snap to item (backup for touch scroll)
    if (!isTransitioning.current) {
      scrollRef.current.scrollTo({
        top: rawIndex * ITEM_HEIGHT,
        behavior: "smooth"
      });
    }

    const finalValue = options[rawIndex % options.length].value;
    if (finalValue !== value) {
      onChange(finalValue);
    }

    // Reset to center set to maintain infinite scroll feel
    setTimeout(() => {
        if (scrollRef.current) {
            const currentIdx = Math.round(scrollRef.current.scrollTop / ITEM_HEIGHT) % options.length;
            const centerScroll = (centerSetIndex * options.length + currentIdx) * ITEM_HEIGHT;
            if (Math.abs(scrollRef.current.scrollTop - centerScroll) > ITEM_HEIGHT * (options.length / 2)) {
               scrollRef.current.scrollTop = centerScroll;
            }
        }
    }, 300);
  };

  let scrollTimeout: NodeJS.Timeout;
  const onScroll = () => {
    handleScroll();
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(handleScrollEnd, 150);
  };

  return (
    <div 
      className={`wheel-scroll-view ${isScrolling ? "scrolling" : ""}`}
      ref={scrollRef}
      onScroll={onScroll}
    >
      <div className="wheel-list">
        {extendedOptions.map((opt, i) => {
          const isSelected = (i % options.length) === activeIndex;
          // Calculate distance from center for subtle scaling effect
          // This is a bit hard with pure CSS during scroll but we can try
          return (
            <div 
              key={`${i}-${opt.value}`} 
              className={`wheel-item ${isSelected ? "active" : ""}`}
              onClick={() => {
                if (scrollRef.current) {
                    scrollRef.current.scrollTo({
                        top: i * ITEM_HEIGHT,
                        behavior: "smooth"
                    });
                }
              }}
            >
              {opt.label}
            </div>
          );
        })}
      </div>
    </div>
  );
}
