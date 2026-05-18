"use client";

import React, { useState, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";

interface Scene {
  imageUrl: string;
  audioUrl: string;
  text: string;
  imagePrompt: string;
}

interface Episode {
  id: string;
  title: string;
  prompt: string;
  status: "pending" | "ready" | "failed";
  scenes: Scene[];
  createdAt: string;
}

const PRESET_PROMPTS = [
  {
    title: "Детектив в стиле Киберпанк",
    emoji: "🕵️‍♂️",
    prompt: "Киберпанк-детектив, выслеживающий цифрового призрака на залитых неоном дождливых улочках Нео-Токио.",
    color: "from-fuchsia-600 to-pink-600",
    theme: "cyberpunk",
  },
  {
    title: "Космическая Одиссея",
    emoji: "🚀",
    prompt: "Исследователь, открывающий гигантское светящееся кристаллическое древнее сооружение на далекой планете с фиолетовыми кольцами.",
    color: "from-cyan-500 to-blue-600",
    theme: "space",
  },
  {
    title: "Средневековое Волшебство",
    emoji: "🧙‍♂️",
    prompt: "Молодой ученик волшебника, находящий спрятанную светящуюся книгу заклинаний в темной древней библиотеке глубоко в горах.",
    color: "from-emerald-500 to-teal-600",
    theme: "fantasy",
  },
  {
    title: "Закат в стиле Синтвейв",
    emoji: "🌅",
    prompt: "Ретро-футуристический спортивный автомобиль, вечно мчащийся к гигантскому светящемуся сетчатому солнцу по розовому шоссе.",
    color: "from-amber-500 to-rose-600",
    theme: "retro",
  },
];

const INITIAL_EPISODES: Episode[] = [
  {
    id: "ep-1",
    title: "Загадка Нео-Токио",
    prompt: "Киберпанк-детектив, выслеживающий цифрового призрака на залитых неоном дождливых улочках Нео-Токио.",
    status: "ready",
    createdAt: "10 мин. назад",
    scenes: [
      {
        imageUrl: "https://images.unsplash.com/photo-1578894381163-e72c17f2d45f?auto=format&fit=crop&w=600&q=80",
        audioUrl: "#",
        text: "Неоновые огни Нео-Токио пробивались сквозь бесконечный дождь, освещая город, построенный на секретах.",
        imagePrompt: "cyberpunk neon noir rainy alleyways",
      },
      {
        imageUrl: "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=600&q=80",
        audioUrl: "#",
        text: "Детектив Каэль сканировал цифровые следы, оставленные неуловимым фантомным кодером.",
        imagePrompt: "cyberpunk detective examining glowing holographic clues",
      },
      {
        imageUrl: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=600&q=80",
        audioUrl: "#",
        text: "Глубоко в недрах Райного 9 массивный серверный стек пульсировал искусственной жизнью.",
        imagePrompt: "futuristic server room with green and red laser grids",
      },
    ],
  },
];

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [userId, setUserId] = useState("");
  const [tokenBalance, setTokenBalance] = useState(5);
  const [episodes, setEpisodes] = useState<Episode[]>(INITIAL_EPISODES);
  
  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [genStep, setGenStep] = useState<"idle" | "script" | "keyframes" | "voiceover" | "compiling">("idle");
  const [generationProgress, setGenerationProgress] = useState(0);
  
  // Viewer state
  const [selectedEpisode, setSelectedEpisode] = useState<Episode | null>(INITIAL_EPISODES[0]);
  const [activeSceneIndex, setActiveSceneIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // Audio system state
  const [audio] = useState<HTMLAudioElement | null>(() => {
    if (typeof window !== "undefined") {
      return new Audio();
    }
    return null;
  });

  // Sync user and fetch real episodes on mount
  useEffect(() => {
    let savedUserId = localStorage.getItem("storyreels_user_id");
    
    // Ensure it is a valid UUID (not 'usr_xxxx')
    if (!savedUserId || savedUserId.startsWith("usr_")) {
      savedUserId = uuidv4();
      localStorage.setItem("storyreels_user_id", savedUserId);
    }

    setUserId(savedUserId);

    const syncUser = async () => {
      try {
        const response = await fetch("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: savedUserId }),
        });
        const data = await response.json();
        if (data.tokenBalance !== undefined) {
          setTokenBalance(data.tokenBalance);
        }
      } catch (err) {
        console.error("Error syncing user:", err);
      }
    };

    const fetchEpisodes = async () => {
      try {
        const response = await fetch(`/api/episodes?userId=${savedUserId}`);
        const data = await response.json();
        if (data.episodes && data.episodes.length > 0) {
          setEpisodes(data.episodes);
          setSelectedEpisode(data.episodes[0]);
        }
      } catch (err) {
        console.error("Error fetching episodes:", err);
      }
    };

    syncUser();
    fetchEpisodes();
  }, []);

  // Handle actual audio playback
  useEffect(() => {
    if (!audio) return;

    // Stop current audio when changing scenes or pausing
    audio.pause();

    if (isPlaying && selectedEpisode && selectedEpisode.scenes.length > 0) {
      const activeScene = selectedEpisode.scenes[activeSceneIndex];
      if (activeScene && activeScene.audioUrl && activeScene.audioUrl !== "#") {
        audio.src = activeScene.audioUrl;
        audio.play().catch((err) => {
          console.warn("Audio play prevented:", err);
        });
      }
    }
  }, [isPlaying, activeSceneIndex, selectedEpisode, audio]);

  // Audio completion listener for auto-advancing slides
  useEffect(() => {
    if (!audio) return;

    const handleEnded = () => {
      if (selectedEpisode && selectedEpisode.scenes.length > 0) {
        setActiveSceneIndex((prev) => {
          if (prev >= selectedEpisode.scenes.length - 1) {
            setIsPlaying(false);
            return 0;
          }
          return prev + 1;
        });
      }
    };

    audio.addEventListener("ended", handleEnded);
    return () => {
      audio.removeEventListener("ended", handleEnded);
    };
  }, [audio, selectedEpisode]);

  // Fallback timer for auto-advancing when audio is not available
  useEffect(() => {
    let timer: NodeJS.Timeout;

    if (isPlaying && selectedEpisode && selectedEpisode.scenes.length > 0) {
      const activeScene = selectedEpisode.scenes[activeSceneIndex];
      const hasAudio = activeScene && activeScene.audioUrl && activeScene.audioUrl !== "#";

      if (!hasAudio) {
        timer = setTimeout(() => {
          setActiveSceneIndex((prev) => {
            if (prev >= selectedEpisode.scenes.length - 1) {
              setIsPlaying(false);
              return 0;
            }
            return prev + 1;
          });
        }, 4500); // 4.5 seconds per scene fallback
      }
    }

    return () => clearTimeout(timer);
  }, [isPlaying, activeSceneIndex, selectedEpisode]);

  // Pause audio on unmount or pause
  useEffect(() => {
    return () => {
      if (audio) {
        audio.pause();
      }
    };
  }, [audio]);

  const saveTokens = (newBalance: number) => {
    setTokenBalance(newBalance);
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    if (tokenBalance < 1) {
      alert("Недостаточно токенов! Пожалуйста, пополните баланс ниже.");
      return;
    }

    setIsGenerating(true);
    setGenStep("script");
    setGenerationProgress(5);

    // Simulate progress updates for a smoother user experience
    const progressInterval = setInterval(() => {
      setGenerationProgress((prev) => {
        if (prev < 95) return prev + 1;
        return prev;
      });
    }, 1000);

    // Dynamic stages simulation based on elapsed time (backend API is being evaluated in background)
    const stage1 = setTimeout(() => setGenStep("keyframes"), 8000);
    const stage2 = setTimeout(() => setGenStep("voiceover"), 22000);
    const stage3 = setTimeout(() => setGenStep("compiling"), 42000);

    try {
      const response = await fetch("/api/episodes/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, prompt }),
      });

      clearInterval(progressInterval);
      clearTimeout(stage1);
      clearTimeout(stage2);
      clearTimeout(stage3);

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Не удалось создать эпизод");
      }

      const data = await response.json();

      setGenStep("compiling");
      setGenerationProgress(100);

      // Refresh list from DB
      const listResponse = await fetch(`/api/episodes?userId=${userId}`);
      const listData = await listResponse.json();

      if (listData.episodes && listData.episodes.length > 0) {
        setEpisodes(listData.episodes);
        const newEp = listData.episodes.find((ep: any) => ep.id === data.episodeId) || listData.episodes[0];
        setSelectedEpisode(newEp);
        setActiveSceneIndex(0);
      }

      // Decrement balance locally
      setTokenBalance((prev) => Math.max(0, prev - 1));
      setPrompt("");

    } catch (err: any) {
      console.error(err);
      alert(`Ошибка генерации: ${err.message || err}`);
    } finally {
      clearInterval(progressInterval);
      clearTimeout(stage1);
      clearTimeout(stage2);
      clearTimeout(stage3);
      setIsGenerating(false);
      setGenStep("idle");
      setGenerationProgress(0);
    }
  };

  const handleTopUp = async () => {
    try {
      const response = await fetch("/api/yookassa/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = await response.json();
      
      if (data.confirmation_url) {
        window.open(data.confirmation_url, "_blank");

        // Polling check to sync tokens once they complete sandbox payment
        let attempts = 0;
        const interval = setInterval(async () => {
          attempts++;
          const res = await fetch("/api/users", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId }),
          });
          const userData = await res.json();
          if (userData.tokenBalance > tokenBalance || attempts > 20) {
            setTokenBalance(userData.tokenBalance);
            clearInterval(interval);
          }
        }, 3000);
      } else {
        // Fallback for direct sandbox testing
        const addRes = await fetch("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, addTokens: 5 }),
        });
        const addData = await addRes.json();
        if (addData.tokenBalance !== undefined) {
          setTokenBalance(addData.tokenBalance);
          alert("Песочница: Начислено +5 токенов на ваш баланс в базе данных!");
        }
      }
    } catch (err) {
      console.error("Top up failed, doing client fallback:", err);
      // Client-only local fallback if backend is offline
      saveTokens(tokenBalance + 5);
      alert("Начислено +5 токенов (клиентский демо-режим)!");
    }
  };

  return (
    <div className="flex flex-col flex-1 bg-zinc-950 text-zinc-100 font-sans selection:bg-purple-600 selection:text-white">
      {/* Premium Header */}
      <header className="sticky top-0 z-40 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-purple-600 to-pink-500 shadow-lg shadow-purple-500/20">
              <span className="text-xl font-bold tracking-tighter text-white">S</span>
              <div className="absolute inset-0 rounded-xl bg-gradient-to-tr from-purple-600 to-pink-500 blur-sm opacity-50 -z-10 animate-pulse"></div>
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
                Story<span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">Reels</span>
              </h1>
              <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold">ИИ Студия Историй</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* User Account Info */}
            <div className="hidden items-center gap-3 rounded-2xl border border-zinc-800/80 bg-zinc-900/40 px-4 py-2 sm:flex">
              <div className="flex flex-col text-right">
                <span className="text-[9px] font-mono text-zinc-500 truncate max-w-[100px]">{userId || "Подключение..."}</span>
                <span className="text-[10px] text-purple-400 font-semibold">Тестовый режим</span>
              </div>
              <div className="h-8 w-[1px] bg-zinc-800"></div>
              <div className="flex items-center gap-2">
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-purple-500/20 text-xs text-purple-400">🪙</div>
                <span className="text-sm font-bold text-white">{tokenBalance} токенов</span>
              </div>
            </div>

            <button
              onClick={handleTopUp}
              className="relative flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-500 px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-purple-600/30 transition-all duration-300 hover:scale-[1.03] hover:shadow-purple-600/50 active:scale-[0.98]"
            >
              Пополнить
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace Area */}
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-8 px-6 py-8 lg:flex-row">
        
        {/* Left Side: Creation & Controls */}
        <div className="flex flex-1 flex-col gap-8 lg:max-w-xl">
          {/* Generation Panel */}
          <section className="relative overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900/30 p-6 backdrop-blur-md">
            <div className="absolute -top-12 -right-12 h-24 w-24 rounded-full bg-purple-500/10 blur-xl"></div>
            
            <h2 className="mb-2 text-lg font-bold text-white flex items-center gap-2">
              <span className="text-purple-400">✨</span> Запустить ИИ-Эпизод
            </h2>
            <p className="mb-6 text-sm text-zinc-400">
              Опишите историю, которую хотите воплотить в жизнь. Наши нейросети напишут сценарий, озвучат персонажей и иллюстрируют каждую сцену.
            </p>

            <form onSubmit={handleGenerate} className="flex flex-col gap-4">
              <div className="relative">
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Например: Кибернетический исследователь приземляется на яркую фиолетовую планету, населенную существами из чистого света..."
                  className="h-32 w-full resize-none rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4 text-sm text-zinc-100 placeholder-zinc-500 transition-colors focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  maxLength={500}
                  disabled={isGenerating}
                />
                <span className="absolute bottom-3 right-3 text-[10px] font-semibold text-zinc-600">
                  {prompt.length}/500
                </span>
              </div>

              {/* Preset prompt pills */}
              <div className="flex flex-col gap-2">
                <span className="text-xs font-semibold text-zinc-500">Или выберите готовый пресет:</span>
                <div className="grid grid-cols-2 gap-2">
                  {PRESET_PROMPTS.map((preset) => (
                    <button
                      key={preset.title}
                      type="button"
                      onClick={() => setPrompt(preset.prompt)}
                      className="flex items-center gap-2 rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-2.5 text-left text-xs transition-all hover:border-zinc-700 hover:bg-zinc-850 active:scale-[0.98]"
                      disabled={isGenerating}
                    >
                      <span className="text-base">{preset.emoji}</span>
                      <div className="truncate">
                        <p className="font-bold text-zinc-200">{preset.title}</p>
                        <p className="truncate text-[10px] text-zinc-500">{preset.prompt}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Submit Button & Cost */}
              <button
                type="submit"
                disabled={isGenerating || !prompt.trim()}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-zinc-100 py-3.5 text-sm font-bold text-zinc-950 transition-all hover:bg-white disabled:bg-zinc-800 disabled:text-zinc-650"
              >
                {isGenerating ? (
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-950 border-t-transparent"></div>
                    <span>Создание рилса...</span>
                  </div>
                ) : (
                  <>
                    <span>Создать эпизод</span>
                    <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] font-semibold text-purple-400">
                      Стоимость: 1 Токен
                    </span>
                  </>
                )}
              </button>
            </form>

            {/* Active generation progress card */}
            {isGenerating && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950/95 p-8 text-center animate-fade-in backdrop-blur-md">
                <div className="relative mb-6">
                  <div className="h-20 w-20 rounded-full border-4 border-purple-500/20 border-t-purple-500 animate-spin"></div>
                  <div className="absolute inset-0 flex items-center justify-center text-xl">🎬</div>
                </div>

                <h3 className="text-lg font-bold text-white mb-2">Нейросеть генерирует контент</h3>
                
                {/* Generation Stage Tracker */}
                <div className="w-full max-w-xs mb-6">
                  <div className="flex justify-between text-xs text-zinc-400 mb-2 font-mono">
                    <span>
                      {genStep === "script" && "📝 Написание сценария..."}
                      {genStep === "keyframes" && "🎨 Генерация изображений..."}
                      {genStep === "voiceover" && "🎙️ Синтез озвучки..."}
                      {genStep === "compiling" && "📦 Сборка эпизода..."}
                    </span>
                    <span>{generationProgress}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-zinc-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-500 ease-out"
                      style={{ width: `${generationProgress}%` }}
                    ></div>
                  </div>
                </div>

                <p className="text-xs text-zinc-500 max-w-xs">
                  Этот процесс задействует Polza.ai LLM для сценария, Flux для качественных изображений и ИИ-TTS для озвучивания рилса.
                </p>
              </div>
            )}
          </section>

          {/* Pricing & YooKassa Top-up */}
          <section className="rounded-3xl border border-zinc-800 bg-zinc-900/30 p-6">
            <h2 className="mb-2 text-base font-bold text-white flex items-center gap-2">
              <span>🪙</span> Токены и демо-версия оплаты
            </h2>
            <p className="mb-4 text-xs text-zinc-400">
              Создание каждого эпизода расходует 1 токен. Реальные платежные операции безопасно обрабатываются через шлюз ЮKassa.
            </p>

            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4 text-center">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Стартовый</span>
                <span className="my-2 text-2xl font-black text-white">1 <span className="text-xs text-zinc-400">Токен</span></span>
                <button
                  onClick={handleTopUp}
                  className="w-full rounded-xl bg-zinc-800 py-1.5 text-[10px] font-bold text-zinc-300 hover:bg-zinc-700"
                >
                  100 ₽
                </button>
              </div>
              <div className="relative flex flex-col items-center justify-between rounded-2xl border border-purple-500/50 bg-purple-950/10 p-4 text-center">
                <div className="absolute -top-2.5 rounded-full bg-purple-600 px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider text-white">Популярно</div>
                <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider">Автор</span>
                <span className="my-2 text-2xl font-black text-white">5 <span className="text-xs text-zinc-400">Токенов</span></span>
                <button
                  onClick={handleTopUp}
                  className="w-full rounded-xl bg-purple-600 py-1.5 text-[10px] font-bold text-white hover:bg-purple-500 shadow-md shadow-purple-600/20"
                >
                  450 ₽
                </button>
              </div>
              <div className="flex flex-col items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4 text-center">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Студия</span>
                <span className="my-2 text-2xl font-black text-white">15 <span className="text-xs text-zinc-400">Токенов</span></span>
                <button
                  onClick={handleTopUp}
                  className="w-full rounded-xl bg-zinc-800 py-1.5 text-[10px] font-bold text-zinc-300 hover:bg-zinc-700"
                >
                  1000 ₽
                </button>
              </div>
            </div>
          </section>
        </div>

        {/* Right Side: Episodic Gallery & Interactive Reel Player */}
        <div className="flex flex-1 flex-col gap-8">
          
          {/* Episode Viewer */}
          {selectedEpisode ? (
            <section className="flex flex-col rounded-3xl border border-zinc-800 bg-zinc-900/20 overflow-hidden">
              <div className="p-5 border-b border-zinc-800 bg-zinc-900/40 flex items-center justify-between">
                <div>
                  <span className="rounded-full bg-purple-500/10 border border-purple-500/20 px-2.5 py-0.5 text-[10px] font-bold tracking-wide text-purple-400 uppercase">
                    Текущий Эпизод
                  </span>
                  <h3 className="mt-1.5 text-lg font-bold text-white">{selectedEpisode.title}</h3>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setIsPlaying(!isPlaying);
                    }}
                    className="flex h-10 items-center justify-center gap-2 rounded-xl bg-zinc-100 px-4 text-xs font-bold text-zinc-950 hover:bg-white"
                  >
                    {isPlaying ? "⏸️ Пауза" : "▶️ Запустить"}
                  </button>
                </div>
              </div>

              {/* Player Body */}
              <div className="relative aspect-video w-full bg-zinc-950 overflow-hidden flex items-center justify-center">
                {selectedEpisode.scenes.length > 0 ? (
                  <>
                    {/* Scene Image */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={selectedEpisode.scenes[activeSceneIndex].imageUrl}
                      alt={selectedEpisode.scenes[activeSceneIndex].text}
                      className="h-full w-full object-cover transition-all duration-700 ease-in-out"
                    />
                    
                    {/* Glassmorphic Audio Player Visualizer Bar */}
                    <div className="absolute top-4 right-4 flex items-center gap-1.5 rounded-lg bg-black/40 px-2.5 py-1.5 backdrop-blur-md border border-white/10">
                      <div className={`h-2.5 w-1 bg-purple-400 rounded-full ${isPlaying ? "animate-pulse" : ""}`}></div>
                      <div className={`h-4.5 w-1 bg-purple-400 rounded-full ${isPlaying ? "animate-pulse delay-75" : ""}`}></div>
                      <div className={`h-3 w-1 bg-purple-400 rounded-full ${isPlaying ? "animate-pulse delay-150" : ""}`}></div>
                      <span className="text-[10px] font-mono text-zinc-300">
                        {selectedEpisode.scenes[activeSceneIndex].audioUrl !== "#" ? "Озвучка ИИ воспроизводится" : "Режим без аудио"}
                      </span>
                    </div>

                    {/* Progress Dots */}
                    <div className="absolute top-4 left-4 flex gap-1.5 z-10">
                      {selectedEpisode.scenes.map((_, idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            setActiveSceneIndex(idx);
                            setIsPlaying(false);
                          }}
                          className={`h-2 rounded-full transition-all duration-300 ${
                            idx === activeSceneIndex ? "w-6 bg-purple-500" : "w-2 bg-white/30 hover:bg-white/50"
                          }`}
                        ></button>
                      ))}
                    </div>

                    {/* Closed Captions Subtitles Panel */}
                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-6 pt-16 flex flex-col justify-end">
                      <p className="text-sm font-medium leading-relaxed text-zinc-100 text-center drop-shadow-md">
                        &ldquo;{selectedEpisode.scenes[activeSceneIndex].text}&rdquo;
                      </p>
                      <p className="mt-2 text-[9px] uppercase tracking-wider text-purple-400 text-center font-bold font-mono">
                        Сцена {activeSceneIndex + 1} из {selectedEpisode.scenes.length} — Промпт: {selectedEpisode.scenes[activeSceneIndex].imagePrompt}
                      </p>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-zinc-500">В этом эпизоде нет сцен</p>
                )}
              </div>
            </section>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-zinc-800 p-12 text-center bg-zinc-900/10">
              <span className="text-3xl mb-3">🎬</span>
              <p className="text-sm text-zinc-400">Выберите или создайте эпизод слева, чтобы начать просмотр</p>
            </div>
          )}

          {/* Episode Gallery */}
          <section className="flex flex-col gap-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span>🗂️</span> Архив Эпизодов
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {episodes.map((ep) => (
                <button
                  key={ep.id}
                  onClick={() => {
                    setSelectedEpisode(ep);
                    setActiveSceneIndex(0);
                    setIsPlaying(false);
                  }}
                  className={`group relative flex flex-col text-left rounded-2xl border p-4 transition-all duration-300 hover:scale-[1.01] ${
                    selectedEpisode?.id === ep.id
                      ? "border-purple-500/80 bg-purple-950/10 shadow-md shadow-purple-950/20"
                      : "border-zinc-800 bg-zinc-900/10 hover:border-zinc-700"
                  }`}
                >
                  <div className="flex items-start justify-between w-full mb-2">
                    <div>
                      <h4 className="font-bold text-zinc-100 group-hover:text-purple-400 transition-colors">
                        {ep.title}
                      </h4>
                      <p className="text-[10px] text-zinc-500 font-mono mt-0.5">{ep.createdAt}</p>
                    </div>
                    <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[9px] font-bold text-emerald-400 uppercase">
                      {ep.status === "ready" ? "Готов" : ep.status === "pending" ? "Создается" : "Ошибка"}
                    </span>
                  </div>

                  <p className="line-clamp-2 text-xs text-zinc-400 mb-4 leading-normal flex-1">
                    {ep.prompt}
                  </p>

                  <div className="flex items-center justify-between mt-auto pt-3 border-t border-zinc-800/60 w-full text-[10px] text-zinc-500 font-semibold">
                    <span className="flex items-center gap-1">
                      🎞️ {ep.scenes.length} сцен
                    </span>
                    <span className="text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity">
                      Смотреть рилс →
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-zinc-800 bg-zinc-950 py-8 text-center text-xs text-zinc-500">
        <div className="mx-auto max-w-7xl px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© {new Date().getFullYear()} StoryReels. Все права защищены. Работает на Next.js и Supabase.</p>
          <div className="flex gap-4">
            <a href="#" className="hover:text-zinc-300">Политика конфиденциальности</a>
            <a href="#" className="hover:text-zinc-300">Условия использования</a>
            <a href="#" className="hover:text-zinc-300">Документация API</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
