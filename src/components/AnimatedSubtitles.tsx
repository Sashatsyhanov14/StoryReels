"use client";

import React, { useEffect, useState, useRef } from "react";

interface AnimatedSubtitlesProps {
  text: string;
  sceneKey: number; // changes when scene changes to reset animation
  isPlaying: boolean;
  audioDuration?: number; // total audio duration in seconds, for word timing
}

/**
 * CapCut-style animated subtitles with word-by-word reveal and karaoke highlight.
 * Words appear sequentially with a slight delay, and the active word glows purple.
 */
export function AnimatedSubtitles({ text, sceneKey, isPlaying, audioDuration }: AnimatedSubtitlesProps) {
  const [activeWordIndex, setActiveWordIndex] = useState(-1);
  const [revealedCount, setRevealedCount] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const words = text.split(/\s+/).filter(Boolean);

  // Calculate per-word timing based on audio duration or fallback
  const totalDuration = (audioDuration && audioDuration > 0) ? audioDuration : 4.5; // seconds
  const wordDelay = Math.max(60, Math.min(200, (totalDuration * 1000) / Math.max(words.length, 1)));

  useEffect(() => {
    // Reset on scene change
    setRevealedCount(0);
    setActiveWordIndex(-1);

    if (!isPlaying) {
      // If paused, show all words immediately
      setRevealedCount(words.length);
      return;
    }

    let currentWord = 0;
    
    timerRef.current = setInterval(() => {
      currentWord++;
      if (currentWord <= words.length) {
        setRevealedCount(currentWord);
        setActiveWordIndex(currentWord - 1);
      } else {
        if (timerRef.current) clearInterval(timerRef.current);
      }
    }, wordDelay);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneKey, isPlaying]);

  if (!text || words.length === 0) return null;

  return (
    <div 
      key={sceneKey}
      className="w-full max-w-[340px] bg-black/70 backdrop-blur-xl border border-zinc-700/30 rounded-2xl px-5 py-3.5 shadow-[0_12px_40px_rgba(0,0,0,0.85)] animate-subtitle-enter"
    >
      <p className="text-white font-extrabold text-xs sm:text-sm leading-relaxed tracking-wide text-center">
        {words.map((word, idx) => {
          const isRevealed = idx < revealedCount;
          const isActive = idx === activeWordIndex;
          const delay = idx * 40; // stagger delay for entrance

          return (
            <span
              key={`${sceneKey}-${idx}`}
              className={`
                subtitle-word mr-[0.3em]
                ${isActive ? "subtitle-word-active" : ""}
              `}
              style={{
                animationDelay: isRevealed ? `${delay}ms` : "0ms",
                opacity: isRevealed ? undefined : 0,
              }}
            >
              {word}
            </span>
          );
        })}
      </p>
    </div>
  );
}
