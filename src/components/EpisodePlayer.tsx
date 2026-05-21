"use client";

import React, { useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import { AbsoluteFill, Sequence, Audio, Img, spring, useCurrentFrame, useVideoConfig, interpolate } from "remotion";

export interface Scene {
  imageUrl: string;
  audioUrl: string;
  text: string;
  imagePrompt: string;
  sceneText?: string;
  cameraEffect?: string;
  transition?: string;
}

// 1. Define the Remotion Composition component
const SceneElement: React.FC<{ scene: Scene; duration: number }> = ({ scene, duration }) => {
  const frame = useCurrentFrame();
  
  // Camera Effect interpolations
  let transform = "scale(1)";
  const effect = scene.cameraEffect || "";
  
  if (effect === "zoom-in-fast") {
    const scale = spring({
      frame,
      fps: 30,
      config: { damping: 15, stiffness: 100 },
    });
    const scaleVal = interpolate(scale, [0, 1], [1, 1.25]);
    transform = `scale(${scaleVal})`;
  } else if (effect === "zoom-out-slow") {
    const scaleVal = interpolate(frame, [0, duration], [1.2, 1.0], {
      extrapolateRight: "clamp",
    });
    transform = `scale(${scaleVal})`;
  } else if (effect === "camera-shake") {
    const shakeX = Math.sin(frame * 1.5) * 8;
    const shakeY = Math.cos(frame * 1.2) * 8;
    transform = `translate(${shakeX}px, ${shakeY}px) scale(1.05)`;
  } else if (effect === "zoom-in-spin") {
    const scaleVal = interpolate(frame, [0, duration], [1.0, 1.3], {
      extrapolateRight: "clamp",
    });
    const rotateVal = interpolate(frame, [0, duration], [0, 10], {
      extrapolateRight: "clamp",
    });
    transform = `scale(${scaleVal}) rotate(${rotateVal}deg)`;
  } else if (effect === "pan-left") {
    const translateX = interpolate(frame, [0, duration], [50, -50], {
      extrapolateRight: "clamp",
    });
    transform = `translateX(${translateX}px) scale(1.15)`;
  } else if (effect === "pan-right") {
    const translateX = interpolate(frame, [0, duration], [-50, 50], {
      extrapolateRight: "clamp",
    });
    transform = `translateX(${translateX}px) scale(1.15)`;
  } else if (effect === "pan-diagonal") {
    const translateVal = interpolate(frame, [0, duration], [-30, 30], {
      extrapolateRight: "clamp",
    });
    transform = `translate(${translateVal}px, ${translateVal}px) scale(1.15)`;
  } else {
    const scaleVal = interpolate(frame, [0, duration], [1.0, 1.15], {
      extrapolateRight: "clamp",
    });
    transform = `scale(${scaleVal})`;
  }

  // Transitions: handled near the end of the scene (last 15 frames = 0.5s)
  const transitionStart = duration - 15;
  const transitionType = scene.transition || "cross-fade";
  let opacity = 1;
  let filter = "none";
  let transitionOverlay: React.ReactNode = null;

  if (frame >= transitionStart) {
    const progress = (frame - transitionStart) / 15; // 0 to 1
    
    if (transitionType === "fade-to-black") {
      transitionOverlay = (
        <AbsoluteFill 
          style={{ 
            backgroundColor: "black", 
            opacity: progress 
          }} 
        />
      );
    } else if (transitionType === "white-flash") {
      transitionOverlay = (
        <AbsoluteFill 
          style={{ 
            backgroundColor: "white", 
            opacity: 1 - Math.abs(progress - 0.5) * 2
          }} 
        />
      );
    } else if (transitionType === "cross-fade") {
      opacity = 1 - progress;
    } else if (transitionType === "cross-blur") {
      opacity = 1 - progress;
      const blurVal = progress * 10;
      filter = `blur(${blurVal}px)`;
    } else if (transitionType === "glitch-cut") {
      if (frame % 3 === 0) {
        const offset = (Math.random() - 0.5) * 30;
        transform += ` translate(${offset}px, ${offset}px)`;
        filter = "invert(0.1)";
      }
    }
  }

  return (
    <AbsoluteFill style={{ overflow: "hidden", backgroundColor: "black" }}>
      <div 
        style={{ 
          width: "100%", 
          height: "100%", 
          transform, 
          opacity, 
          filter,
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        <Img 
          src={scene.imageUrl} 
          style={{ 
            width: "100%", 
            height: "100%", 
            objectFit: "cover" 
          }} 
        />
      </div>

      {scene.audioUrl && scene.audioUrl !== "#" && (
        <Audio src={scene.audioUrl} />
      )}

      {transitionOverlay}
    </AbsoluteFill>
  );
};

const ReelsVideoComposition: React.FC<{ scenes: Scene[] }> = ({ scenes }) => {
  const videoConfig = useVideoConfig();
  const fps = videoConfig.fps;
  const sceneDuration = 5 * fps; // 150 frames (5s)

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      {scenes.map((scene, index) => {
        const startFrame = index * sceneDuration;
        return (
          <Sequence
            key={index}
            from={startFrame}
            durationInFrames={sceneDuration}
            layout="none"
          >
            <SceneElement scene={scene} duration={sceneDuration} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

// 2. Import Player dynamically to support Next.js SSR
const RemotionPlayer = dynamic(
  () => import("@remotion/player").then((mod) => mod.Player),
  { ssr: false }
);

interface EpisodePlayerProps {
  scenes: Scene[];
  isPlaying: boolean;
  onSceneChange?: (index: number) => void;
  onProgressChange?: (progress: number) => void;
  onPlaybackEnded?: () => void;
  playerRef?: React.RefObject<any>;
}

export const EpisodePlayer: React.FC<EpisodePlayerProps> = ({
  scenes,
  isPlaying,
  onSceneChange,
  onProgressChange,
  onPlaybackEnded,
  playerRef: externalPlayerRef,
}) => {
  const internalPlayerRef = useRef<any>(null);
  const player = externalPlayerRef || internalPlayerRef;
  const prevFrameRef = useRef<number>(-1);

  const fps = 30;
  const sceneDuration = 5 * fps; // 150 frames per scene
  const totalDuration = scenes.length * sceneDuration;

  // Sync Playback state
  useEffect(() => {
    const playerInstance = player.current;
    if (!playerInstance) return;

    if (isPlaying) {
      playerInstance.play();
    } else {
      playerInstance.pause();
    }
  }, [isPlaying, player]);

  // Handle frame changes for sync events
  useEffect(() => {
    const playerInstance = player.current;
    if (!playerInstance) return;

    const handleFrameChange = (e: CustomEvent<{ frame: number }>) => {
      const currentFrame = e.detail.frame;
      if (currentFrame === prevFrameRef.current) return;
      prevFrameRef.current = currentFrame;

      const activeIndex = Math.min(
        scenes.length - 1,
        Math.floor(currentFrame / sceneDuration)
      );
      
      const frameInScene = currentFrame % sceneDuration;
      const progress = (frameInScene / sceneDuration) * 100;

      if (onSceneChange) onSceneChange(activeIndex);
      if (onProgressChange) onProgressChange(progress);
    };

    const handleEnded = () => {
      if (onPlaybackEnded) onPlaybackEnded();
    };

    playerInstance.addEventListener("frameupdate", handleFrameChange);
    playerInstance.addEventListener("ended", handleEnded);

    return () => {
      playerInstance.removeEventListener("frameupdate", handleFrameChange);
      playerInstance.removeEventListener("ended", handleEnded);
    };
  }, [scenes, sceneDuration, onSceneChange, onProgressChange, onPlaybackEnded, player]);

  if (scenes.length === 0) return null;

  return (
    <div className="w-full h-full relative">
      <RemotionPlayer
        ref={player}
        component={ReelsVideoComposition as any}
        inputProps={{ scenes }}
        durationInFrames={totalDuration}
        fps={fps}
        compositionWidth={1080}
        compositionHeight={1920}
        style={{
          width: "100%",
          height: "100%",
          backgroundColor: "black",
        }}
        controls={false}
        loop={false}
        autoPlay={isPlaying}
      />
    </div>
  );
};
