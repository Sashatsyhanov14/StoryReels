"use client";

import React, { useState, useEffect, useRef } from "react";
import { v4 as uuidv4 } from "uuid";
import { supabase } from "@/lib/supabase-client";

interface Scene {
  imageUrl: string;
  audioUrl: string;
  text: string;
  imagePrompt: string;
  cameraEffect?: string;
  transition?: string;
}

interface Episode {
  id: string;
  title: string;
  prompt: string;
  status: "pending" | "ready" | "failed";
  scenes: Scene[];
  createdAt: string;
  progress?: number;
  step?: "idle" | "script" | "keyframes" | "voiceover" | "compiling";
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
  
  // Psychological Landing Flow State
  const [isRegistered, setIsRegistered] = useState(false);
  const [landingStep, setLandingStep] = useState<"input" | "generating" | "teaser">("input");
  
  // Auth state
  const [email, setEmail] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  // Check auth session on load
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setIsRegistered(true);
        setUserId(session.user.email || session.user.id);
      }
    };
    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setIsRegistered(true);
        setUserId(session.user.email || session.user.id);
      } else {
        setIsRegistered(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleOAuthLogin = async (provider: 'google' | 'vk') => {
    try {
      setAuthLoading(true);
      await supabase.auth.signInWithOAuth({
        provider: provider as any,
        options: {
          redirectTo: typeof window !== 'undefined' ? window.location.origin : '',
        }
      });
    } catch (error) {
      console.error(error);
      alert("Ошибка при входе через " + provider);
      setAuthLoading(false);
    }
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    try {
      setAuthLoading(true);
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: typeof window !== 'undefined' ? window.location.origin : '',
        }
      });
      if (error) throw error;
      alert("Волшебная ссылка отправлена на " + email + ". Проверьте почту!");
      setEmail("");
    } catch (error) {
      console.error(error);
      alert("Ошибка отправки Magic Link");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleTelegramLogin = () => {
    setAuthLoading(true);
    // Имитация авторизации через Telegram Mini App / Widget
    setTimeout(() => {
      setIsRegistered(true);
      setTokenBalance(15);
      setAuthLoading(false);
    }, 1200);
  };

  useEffect(() => {
    if (!isRegistered && landingStep === "generating") {
      const timer = setTimeout(() => {
        setLandingStep("teaser");
      }, 4500);
      return () => clearTimeout(timer);
    }
  }, [landingStep, isRegistered]);

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [genStep, setGenStep] = useState<"idle" | "script" | "keyframes" | "voiceover" | "compiling">("idle");
  const [generationProgress, setGenerationProgress] = useState(0);
  
  // Viewer state
  const [selectedEpisode, setSelectedEpisode] = useState<Episode | null>(INITIAL_EPISODES[0]);
  const [activeSceneIndex, setActiveSceneIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [transitionClass, setTransitionClass] = useState("");
  const advanceToNextSceneRef = useRef<() => void>(() => {});

  // Audio system ref
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize audio and event listeners
  useEffect(() => {
    if (typeof window !== "undefined") {
      const audioInstance = new Audio();
      
      const handleEnded = () => {
        advanceToNextSceneRef.current();
      };
      
      audioInstance.addEventListener("ended", handleEnded);
      audioRef.current = audioInstance;

      return () => {
        audioInstance.pause();
        audioInstance.removeEventListener("ended", handleEnded);
      };
    }
  }, []);

  const runGeneration = async (
    episodeId: string, 
    currentUserId: string, 
    scenes: { imageUrl?: string; audioUrl?: string; image_prompt?: string; voice_text?: string; camera_effect?: string; transition?: string; }[]
  ) => {
    setIsGenerating(true);
    setGenStep("keyframes");

    // Find the first scene that doesn't have an imageUrl or audioUrl
    let startIdx = 0;
    for (let i = 0; i < scenes.length; i++) {
      const hasImage = scenes[i].imageUrl && scenes[i].imageUrl !== "";
      const hasAudio = scenes[i].audioUrl && scenes[i].audioUrl !== "" && scenes[i].audioUrl !== "#";
      if (!hasImage || !hasAudio) {
        startIdx = i;
        break;
      }
    }

    try {
      const batchSize = 5;
      const pendingIndices: number[] = [];
      for (let i = startIdx; i < scenes.length; i++) {
        pendingIndices.push(i);
      }

      for (let k = 0; k < pendingIndices.length; k += batchSize) {
        const batch = pendingIndices.slice(k, k + batchSize);
        const currentProgress = Math.min(95, Math.round(10 + ((startIdx + k) / scenes.length) * 85));
        setGenerationProgress(currentProgress);
        
        // Update pending episode status in UI dynamically so user sees progress
        setEpisodes((prevEpisodes) => {
          return prevEpisodes.map((ep) => {
            if (ep.id === episodeId) {
              return {
                ...ep,
                progress: currentProgress,
                step: "keyframes"
              };
            }
            return ep;
          });
        });

        const response = await fetch('/api/episodes/generate-scene', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ episodeId, sceneIndices: batch })
        });
        
        if (!response.ok) {
          throw new Error(`Ошибка при генерации кадров: ${batch.map(idx => idx + 1).join(', ')}`);
        }
        
        const data = await response.json();
        if (data.isCompleted) {
          break;
        }
      }

      // Fetch the updated episodes and select the newly ready episode
      const response = await fetch(`/api/episodes?userId=${currentUserId}`);
      if (response.ok) {
        const data = await response.json();
        const episodesList: Episode[] = data.episodes || [];
        setEpisodes(episodesList);
        
        const finishedEp = episodesList.find((ep) => ep.id === episodeId);
        if (finishedEp) {
          setSelectedEpisode(finishedEp);
          setActiveSceneIndex(0);
        }
      }

      setGenerationProgress(100);
      setGenStep("idle");
      setIsGenerating(false);

    } catch (err) {
      console.error("Generation loop failed:", err);
      const errMsg = err instanceof Error ? err.message : String(err);
      alert(`Ошибка: ${errMsg}`);
      
      await fetch(`/api/episodes/fail`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ episodeId })
      }).catch(console.error);

      // Refresh episodes list
      const response = await fetch(`/api/episodes?userId=${currentUserId}`);
      if (response.ok) {
        const data = await response.json();
        setEpisodes(data.episodes || []);
      }

      // Refresh user balance if tokens were refunded/adjusted
      try {
        const userResponse = await fetch("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: currentUserId }),
        });
        const userData = await userResponse.json();
        if (userData.tokenBalance !== undefined) {
          setTokenBalance(userData.tokenBalance);
        }
      } catch (e) {
        console.error("Failed to sync user tokens on error", e);
      }

      setGenerationProgress(0);
      setGenStep("idle");
      setIsGenerating(false);
    }
  };

  // Sync user and fetch real episodes on mount
  useEffect(() => {
    let savedUserId = localStorage.getItem("storyreels_user_id");
    
    // Ensure it is a valid UUID (not 'usr_xxxx')
    if (!savedUserId || savedUserId.startsWith("usr_")) {
      savedUserId = uuidv4();
      localStorage.setItem("storyreels_user_id", savedUserId);
    }

    const syncUser = async () => {
      try {
        if (savedUserId) {
          setUserId(savedUserId);
        }
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
          
          // Check if there is any pending episode and resume generation loop
          const pendingEpisode = data.episodes.find((ep: Episode) => ep.status === "pending");
          if (pendingEpisode) {
            setSelectedEpisode(pendingEpisode);
            runGeneration(pendingEpisode.id, savedUserId || "", pendingEpisode.scenes);
          } else {
            setSelectedEpisode(data.episodes[0]);
          }
        }
      } catch (err) {
        console.error("Error fetching episodes:", err);
      }
    };

    syncUser();
    fetchEpisodes();
  }, []);

  // Set advanceToNextSceneRef implementation
  useEffect(() => {
    advanceToNextSceneRef.current = () => {
      if (!selectedEpisode || selectedEpisode.scenes.length === 0) return;
      const currentScene = selectedEpisode.scenes[activeSceneIndex];
      const transitionType = currentScene?.transition || "fade-to-black";

      setTransitionClass(transitionType);

      // Change the scene index halfway through (150ms)
      setTimeout(() => {
        setActiveSceneIndex((prev) => {
          if (prev >= selectedEpisode.scenes.length - 1) {
            setIsPlaying(false);
            return 0;
          }
          return prev + 1;
        });
      }, 150);

      // Reset transition class after completion (300ms)
      setTimeout(() => {
        setTransitionClass("");
      }, 300);
    };
  }, [selectedEpisode, activeSceneIndex]);

  // Handle actual audio playback
  useEffect(() => {
    const audioInstance = audioRef.current;
    if (!audioInstance) return;

    // Stop current audio when changing scenes or pausing
    audioInstance.pause();

    if (isPlaying && selectedEpisode && selectedEpisode.scenes.length > 0) {
      const activeScene = selectedEpisode.scenes[activeSceneIndex];
      if (activeScene && activeScene.audioUrl && activeScene.audioUrl !== "#") {
        audioInstance.src = activeScene.audioUrl;
        audioInstance.play().catch((err) => {
          console.warn("Audio play prevented:", err);
        });
      }
    }
  }, [isPlaying, activeSceneIndex, selectedEpisode]);

  // Fallback timer for auto-advancing when audio is not available
  useEffect(() => {
    let timer: NodeJS.Timeout;

    if (isPlaying && selectedEpisode && selectedEpisode.scenes.length > 0) {
      const activeScene = selectedEpisode.scenes[activeSceneIndex];
      const hasAudio = activeScene && activeScene.audioUrl && activeScene.audioUrl !== "#";

      if (!hasAudio) {
        timer = setTimeout(() => {
          advanceToNextSceneRef.current();
        }, 4500); // 4.5 seconds per scene fallback
      }
    }

    return () => clearTimeout(timer);
  }, [isPlaying, activeSceneIndex, selectedEpisode]);

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

    try {
      const response = await fetch("/api/episodes/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, prompt }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Не удалось запустить создание эпизода");
      }

      const data = await response.json();

      // Decrement balance locally immediately
      setTokenBalance((prev) => Math.max(0, prev - 1));
      setPrompt("");

      // Start client-driven generation loop
      await runGeneration(data.episodeId, userId, data.scenes);

    } catch (err) {
      console.error(err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      alert(`Ошибка генерации: ${errorMessage}`);
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

  // --- PSYCHOLOGICAL LANDING HOOK (UX PERSUASION) ---
  if (!isRegistered) {
    return (
      <div className="flex flex-col flex-1 min-h-screen bg-zinc-950 text-zinc-100 font-sans relative overflow-hidden items-center justify-center">
        {/* Ambient glow background */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-purple-600/10 rounded-full blur-[120px] pointer-events-none"></div>

        {landingStep === "input" && (
          <div className="z-10 w-full max-w-2xl px-6 flex flex-col items-center text-center animate-fade-in">
            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-1 text-xs font-semibold text-purple-300">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500"></span>
              </span>
              ИИ Студия Историй v2.0
            </div>
            <h1 className="mb-6 text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-white leading-tight">
              Создайте вирусный <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">StoryReels</span> за 30 секунд
            </h1>
            <p className="mb-12 text-base md:text-lg text-zinc-400 max-w-lg">
              Опишите вашу идею, а нейросеть напишет цепляющий сценарий, озвучит его и сгенерирует визуальный ряд. Без монтажа и часов работы.
            </p>

            <form 
              onSubmit={(e) => { e.preventDefault(); if(prompt) setLandingStep("generating"); }}
              className="w-full relative group"
            >
              <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 to-pink-600 rounded-3xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
              <div className="relative flex flex-col sm:flex-row items-center bg-zinc-900 border border-zinc-800 rounded-3xl p-2 shadow-2xl">
                <input 
                  type="text" 
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Опишите идею (например: киберпанк детектив...)"
                  className="w-full bg-transparent border-none px-6 py-4 text-white placeholder-zinc-500 focus:outline-none text-base sm:text-lg"
                />
                <button 
                  type="submit"
                  disabled={!prompt}
                  className="w-full sm:w-auto bg-white text-zinc-950 px-8 py-4 mt-2 sm:mt-0 rounded-2xl font-bold hover:scale-105 transition-transform disabled:opacity-50 disabled:hover:scale-100"
                >
                  Создать ✨
                </button>
              </div>
            </form>

            <div className="mt-10 flex flex-wrap justify-center gap-3">
              {PRESET_PROMPTS.slice(0,3).map((p) => (
                <button 
                  key={p.title}
                  onClick={() => setPrompt(p.prompt)}
                  className="px-4 py-2 rounded-full border border-zinc-800 bg-zinc-900/50 text-[10px] sm:text-xs font-semibold text-zinc-400 hover:text-white hover:border-zinc-600 transition-colors"
                >
                  {p.emoji} {p.title}
                </button>
              ))}
            </div>
          </div>
        )}

        {landingStep === "generating" && (
          <div className="z-10 flex flex-col items-center text-center animate-fade-in">
             <div className="relative mb-8">
               <div className="h-32 w-32 rounded-full border-4 border-purple-500/20 border-t-purple-500 animate-spin"></div>
               <div className="absolute inset-0 flex items-center justify-center text-3xl animate-pulse">🧠</div>
             </div>
             <h2 className="text-2xl font-bold text-white mb-2">ИИ создает магию...</h2>
             <p className="text-zinc-400 mb-8 max-w-sm">
               Анализ промпта... Написание сценария... Генерация изображений и озвучки...
             </p>
             {/* Fake generation timeout removed from JSX, handled in useEffect */}
          </div>
        )}

        {landingStep === "teaser" && (
          <div className="z-10 w-full flex flex-col items-center px-4 relative animate-fade-in">
            <h2 className="text-3xl font-bold text-white mb-8">Ваш Reels готов! 🔥</h2>
            
            <div className="relative aspect-[9/16] w-full max-w-[320px] rounded-3xl overflow-hidden border border-zinc-700 shadow-[0_0_50px_rgba(168,85,247,0.3)] group">
               {/* eslint-disable-next-line @next/next/no-img-element */}
               <img src="https://images.unsplash.com/photo-1578894381163-e72c17f2d45f?auto=format&fit=crop&w=600&q=80" alt="blur" className="w-full h-full object-cover blur-md scale-110" />
               
               {/* Curiosity Gap Paywall Overlay */}
               <div className="absolute inset-0 bg-black/60 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center">
                  <span className="text-4xl mb-2 drop-shadow-lg animate-bounce">🔒</span>
                  <h3 className="text-lg font-bold text-white mb-1">Сценарий просто огонь!</h3>
                  <p className="text-[10px] text-zinc-300 mb-4 leading-relaxed max-w-[250px]">
                    Войдите, чтобы досмотреть видео, убрать вотермарку и получить <strong className="text-purple-400">10 токенов</strong> бонусом.
                  </p>
                  
                  {/* Auth Methods */}
                  <div className="w-full flex flex-col gap-2 relative">
                    {authLoading && (
                      <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50 backdrop-blur-sm rounded-xl">
                        <div className="h-6 w-6 animate-spin rounded-full border-2 border-purple-500 border-t-transparent"></div>
                      </div>
                    )}
                    
                    <div className="flex gap-2">
                      {/* Telegram */}
                      <button 
                        onClick={handleTelegramLogin}
                        disabled={authLoading}
                        className="flex-1 bg-[#2AABEE] hover:bg-[#229ED9] text-white font-bold py-2.5 rounded-xl transition-all shadow-lg flex items-center justify-center group"
                        title="Войти через Telegram"
                      >
                        <span className="text-xl group-hover:scale-110 transition-transform">✈️</span>
                      </button>
                      {/* Google */}
                      <button 
                        onClick={() => handleOAuthLogin('google')}
                        disabled={authLoading}
                        className="flex-1 bg-white hover:bg-zinc-100 text-zinc-900 font-bold py-2.5 rounded-xl transition-all shadow-lg flex items-center justify-center group"
                        title="Войти через Google"
                      >
                        <span className="text-xl font-serif font-black group-hover:scale-110 transition-transform">G</span>
                      </button>
                      {/* VK */}
                      <button 
                        onClick={() => handleOAuthLogin('vk')}
                        disabled={authLoading}
                        className="flex-1 bg-[#0077FF] hover:bg-[#0066EE] text-white font-bold py-2.5 rounded-xl transition-all shadow-lg flex items-center justify-center group"
                        title="Войти через VK"
                      >
                        <span className="text-sm tracking-tighter group-hover:scale-110 transition-transform">VK</span>
                      </button>
                    </div>
                    
                    {/* Magic Link */}
                    <form onSubmit={handleMagicLink} className="relative mt-1">
                      <input 
                        type="email" 
                        placeholder="Email для входа (Magic Link)" 
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={authLoading}
                        className="w-full bg-black/50 border border-zinc-700/50 text-white placeholder-zinc-500 text-[10px] px-4 py-3 rounded-xl focus:outline-none focus:border-purple-500 transition-colors"
                      />
                      <button 
                        type="submit" 
                        disabled={authLoading || !email.includes('@')}
                        className="absolute right-1 top-1 bottom-1 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 px-3 rounded-lg text-[10px] font-bold text-white transition-colors"
                      >
                        Войти
                      </button>
                    </form>
                  </div>

                  <p className="text-[9px] text-red-400 font-mono font-bold animate-pulse flex items-center gap-1 mt-4">
                    ⚠️ Черновик будет удален через 14:59
                  </p>
               </div>
            </div>
          </div>
        )}
      </div>
    );
  }

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

      {/* Bento Grid Dashboard */}
      <main className="mx-auto grid w-full max-w-7xl flex-1 grid-cols-1 lg:grid-cols-12 gap-6 px-6 py-8">
        
        {/* BENTO ITEMS 1 & 2: Generation Hub & Gamification (Cols 1-7) */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          {/* Generation Panel */}
          <section className="relative overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900/40 p-6 backdrop-blur-xl shadow-2xl transition-all hover:border-zinc-700/80 group">
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

          {/* Bento Grid: Stats and Pricing */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Series Tracker Widget */}
            <section className="relative overflow-hidden rounded-3xl border border-zinc-800 bg-gradient-to-br from-zinc-900/80 to-zinc-900/30 p-6 backdrop-blur-xl shadow-2xl flex flex-col justify-center transition-all hover:border-zinc-700">
              <h3 className="text-[10px] font-bold text-zinc-500 mb-4 uppercase tracking-widest">Текущий сериал</h3>
              <div className="flex items-center gap-4 mb-4">
                 <div className="text-4xl filter drop-shadow-md">📺</div>
                 <div>
                   <div className="text-lg font-bold text-white tracking-tight">Эпизод 1</div>
                   <div className="text-[10px] text-zinc-500 font-mono">Сюжет в разработке</div>
                 </div>
              </div>
              
              <div className="flex items-center gap-1 mb-2">
                 <div className="flex-1 bg-purple-500 h-1.5 rounded-full shadow-[0_0_10px_#a855f7]"></div>
                 <div className="flex-1 bg-zinc-800 h-1.5 rounded-full"></div>
                 <div className="flex-1 bg-zinc-800 h-1.5 rounded-full"></div>
                 <div className="flex-1 bg-zinc-800 h-1.5 rounded-full"></div>
                 <div className="flex-1 bg-zinc-800 h-1.5 rounded-full"></div>
              </div>
              <p className="text-[9px] text-zinc-400 leading-tight mt-1 text-center font-bold tracking-wider uppercase">
                Продолжение следует...
              </p>
            </section>

            {/* Compact Top-Up */}
            <section className="rounded-3xl border border-zinc-800 bg-zinc-900/40 p-6 backdrop-blur-xl flex flex-col justify-between shadow-2xl transition-all hover:border-zinc-700">
               <h3 className="text-[10px] font-bold text-zinc-500 mb-2 uppercase tracking-widest flex items-center justify-between">
                 <span>Баланс токенов</span>
                 <span className="text-white text-sm font-black bg-zinc-800 px-2 py-0.5 rounded-md border border-zinc-700">{tokenBalance} 🪙</span>
               </h3>
               <p className="text-[9px] text-zinc-400 mb-4 leading-tight">Каждое создание рилса расходует 1 токен. Пополните сейчас со скидкой.</p>
               
               <div className="flex gap-2">
                 <button onClick={handleTopUp} className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold py-2.5 rounded-xl text-[10px] transition-all border border-zinc-700/50">
                    +5 (450₽)
                 </button>
                 <button onClick={handleTopUp} className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-90 text-white font-bold py-2.5 rounded-xl text-[10px] shadow-[0_0_15px_rgba(168,85,247,0.4)] transition-all">
                    +15 (1000₽)
                 </button>
               </div>
            </section>
          </div>
        </div>

        {/* BENTO ITEMS 3 & 4: The Player & Community (Cols 8-12) */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          
          {/* Episode Viewer */}
          {selectedEpisode ? (
            <>
              {/* Cinematic Player Container with Ambilight Effect */}
              <div className="relative w-full max-w-[350px] mx-auto flex items-center justify-center py-6">
                {/* Ambilight Background Glow */}
                {selectedEpisode.scenes?.length > 0 && selectedEpisode.scenes[activeSceneIndex]?.imageUrl && (
                  <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none rounded-[3rem]">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[140%] h-[140%] opacity-30 blur-[80px] transition-all duration-1000 ease-in-out scale-110">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img 
                        src={selectedEpisode.scenes[activeSceneIndex].imageUrl} 
                        alt="" 
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>
                )}
                
                {/* Player Body (Vertical Video Reel) */}
                <div 
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="relative z-10 aspect-[9/16] w-full bg-zinc-950 overflow-hidden flex items-center justify-center rounded-3xl border border-zinc-800/80 shadow-[0_0_50px_rgba(0,0,0,0.5)] cursor-pointer select-none group hover:scale-[1.02] transition-transform duration-500"
                >
                {selectedEpisode.status === "pending" ? (
                  <div className="flex flex-col items-center justify-center p-6 text-center animate-pulse">
                    <div className="relative mb-4">
                      <div className="h-12 w-12 rounded-full border-3 border-purple-500/20 border-t-purple-500 animate-spin"></div>
                      <div className="absolute inset-0 flex items-center justify-center text-lg">🎬</div>
                    </div>
                    <p className="text-sm font-bold text-white mb-1">Создание эпизода...</p>
                    <p className="text-xs text-zinc-400">
                      {selectedEpisode.step === "script" && "📝 Написание сценария..."}
                      {selectedEpisode.step === "keyframes" && "🎨 Генерация изображений..."}
                      {selectedEpisode.step === "voiceover" && "🎙️ Синтез озвучки..."}
                      {selectedEpisode.step === "compiling" && "📦 Сборка эпизода..."}
                      {(!selectedEpisode.step || selectedEpisode.step === "idle") && "Запуск..."}
                    </p>
                    <div className="mt-4 w-48 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                      <div 
                        className="h-full rounded-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-500" 
                        style={{ width: `${selectedEpisode.progress || 5}%` }}
                      ></div>
                    </div>
                  </div>
                ) : selectedEpisode.status === "failed" ? (
                  <div className="flex flex-col items-center justify-center p-6 text-center">
                    <span className="text-3xl mb-2">❌</span>
                    <p className="text-sm font-bold text-red-400">Ошибка генерации</p>
                    <p className="text-xs text-zinc-500 mt-1 max-w-xs">Не удалось создать этот эпизод. Токен был возвращен на ваш баланс.</p>
                  </div>
                ) : selectedEpisode.scenes.length > 0 ? (
                  <>
                    {/* Scene Media (Image or Video) */}
                    {selectedEpisode.scenes.map((scene, idx) => {
                      const isActive = idx === activeSceneIndex;
                      const isVideo = scene.imageUrl.endsWith('.mp4') || scene.imageUrl.includes('video');
                      
                      if (isVideo) {
                        return (
                          <video
                            key={idx}
                            src={scene.imageUrl}
                            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${
                              isActive ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none"
                            }`}
                            autoPlay={isActive}
                            loop
                            muted
                            playsInline
                          />
                        );
                      }
                      
                      return (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          key={idx}
                          src={scene.imageUrl}
                          alt={scene.text}
                          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ease-in-out ${
                            isActive ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none"
                          } ${
                            isPlaying && isActive
                              ? (scene.cameraEffect === "zoom-in-fast"
                                ? "animate-zoom-in-fast"
                                : scene.cameraEffect === "zoom-out-slow"
                                ? "animate-zoom-out-slow"
                                : scene.cameraEffect === "camera-shake"
                                ? "animate-camera-shake"
                                : scene.cameraEffect === "zoom-in-spin"
                                ? "animate-zoom-in-spin"
                                : scene.cameraEffect === "pan-left"
                                ? "animate-pan-left"
                                : scene.cameraEffect === "pan-right"
                                ? "animate-pan-right"
                                : scene.cameraEffect === "pan-diagonal"
                                ? "animate-pan-diagonal"
                                : (idx % 2 === 0 ? "animate-ken-burns-in" : "animate-ken-burns-out"))
                              : ""
                          }`}
                        />
                      );
                    })}

                    {/* Transition Overlay */}
                    {transitionClass && (
                      <div className={`absolute inset-0 z-20 pointer-events-none ${
                        transitionClass === 'fade-to-black' ? 'animate-fade-to-black-transition' :
                        transitionClass === 'glitch-cut' ? 'animate-glitch-cut-transition' :
                        transitionClass === 'white-flash' ? 'animate-white-flash-transition' :
                        transitionClass === 'cross-blur' ? 'animate-cross-blur-transition' :
                        transitionClass === 'cross-fade' ? 'animate-cross-fade-transition' : ''
                      }`} />
                    )}
                    
                    {/* Minimalist Top Watermark */}
                    <div className="absolute top-4 inset-x-0 z-20 flex justify-between items-center px-4 pointer-events-none opacity-40 group-hover:opacity-100 transition-opacity duration-300">
                      <span className="text-[9px] font-mono tracking-widest text-white uppercase drop-shadow-md">
                        STORYREELS • {selectedEpisode.title}
                      </span>
                      <span className="text-[9px] font-mono text-white drop-shadow-md">
                        {activeSceneIndex + 1}/{selectedEpisode.scenes.length}
                      </span>
                    </div>

                    {/* Pause Overlay Button */}
                    {!isPlaying && (
                      <div className="absolute inset-0 bg-black/40 z-20 flex items-center justify-center pointer-events-none">
                        <div className="h-16 w-16 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white border border-white/20 transition-all duration-300">
                          <span className="text-2xl pl-1">▶</span>
                        </div>
                      </div>
                    )}

                    {/* Closed Captions Subtitles Panel */}
                    <div className="absolute bottom-8 inset-x-0 z-20 px-4 flex flex-col justify-end pointer-events-none">
                      <div className="mx-auto max-w-[90%] rounded-xl bg-black/60 px-4 py-2.5 text-center backdrop-blur-md border border-white/10 shadow-lg">
                        <p className="text-xs font-semibold leading-relaxed text-yellow-300 text-center drop-shadow-md">
                          {selectedEpisode.scenes[activeSceneIndex].text}
                        </p>
                      </div>
                    </div>

                    {/* Sleek bottom progress indicator */}
                    <div className="absolute bottom-0 inset-x-0 h-1 bg-white/10 z-20 flex">
                      <div 
                        className="h-full bg-purple-500 transition-all duration-300 ease-out" 
                        style={{ width: `${((activeSceneIndex + 1) / selectedEpisode.scenes.length) * 100}%` }}
                      />
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-zinc-500">В этом эпизоде нет сцен</p>
                )}
              </div>
              </div>

            {/* BENTO ITEM: Social Proof / Idea of the Day */}
            <div className="flex flex-col gap-3">
                 <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest pl-1 mt-2">Вдохновение дня</h3>
                 <button onClick={() => setPrompt("Триллер в заброшенном особняке, где картины оживают по ночам, и детектив должен разгадать их тайну до рассвета.")} className="text-left relative overflow-hidden rounded-3xl border border-purple-500/30 bg-purple-500/10 p-5 backdrop-blur-xl shadow-lg transition-all hover:bg-purple-500/20 active:scale-[0.98] group flex gap-4 items-center">
                    <span className="text-4xl block animate-pulse drop-shadow-[0_0_15px_rgba(168,85,247,0.5)]">🔮</span>
                    <div>
                      <p className="text-sm text-white font-bold mb-0.5">Мистический особняк</p>
                      <p className="text-[10px] text-purple-300/70 mb-2 font-mono uppercase">Триллер • Хоррор</p>
                      <span className="inline-flex items-center gap-1 text-[9px] font-bold text-purple-400 bg-purple-500/20 border border-purple-500/30 px-2 py-1 rounded-md transition-all group-hover:bg-purple-500/40">
                         Применить промпт
                      </span>
                    </div>
                 </button>

            </div>

            {/* Scenario Board Panel */}
            {selectedEpisode.status === "ready" && (
              <section className="rounded-3xl border border-zinc-800 bg-zinc-900/30 p-6 backdrop-blur-md">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <span>📋</span> Сценарий серии (Раскадровка)
                    </h3>
                    <p className="text-xs text-zinc-400 mt-1">
                      Здесь показана последовательность кадров, озвучка и настройки анимации. Нажмите на строку, чтобы воспроизвести соответствующий кадр.
                    </p>
                  </div>
                </div>
                
                <div className="overflow-x-auto rounded-2xl border border-zinc-800/80 bg-zinc-950/40">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-zinc-800/80 bg-zinc-900/50 text-[10px] uppercase font-bold tracking-wider text-zinc-400">
                        <th className="px-4 py-3 text-center w-16">Кадр</th>
                        <th className="px-4 py-3 w-48">Миниатюра / Промпт</th>
                        <th className="px-4 py-3">Текст озвучки (Русский)</th>
                        <th className="px-4 py-3 w-32">Анимация</th>
                        <th className="px-4 py-3 w-28">Переход</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/40">
                      {selectedEpisode.scenes.map((scene, idx) => {
                        const isActive = idx === activeSceneIndex;
                        return (
                          <tr 
                            key={idx}
                            onClick={() => {
                              setActiveSceneIndex(idx);
                              setIsPlaying(true);
                            }}
                            className={`cursor-pointer transition-all hover:bg-zinc-900/60 ${
                              isActive ? "bg-purple-950/35 text-purple-200 border-l-2 border-purple-500 font-semibold" : "text-zinc-300"
                            }`}
                          >
                            <td className="px-4 py-3.5 text-center font-mono">
                              {isActive ? (
                                <span className="flex items-center justify-center text-purple-400 gap-1 animate-pulse">
                                  ▶️ {idx + 1}
                                </span>
                              ) : (
                                idx + 1
                              )}
                            </td>
                            <td className="px-4 py-3.5">
                              <div className="flex items-center gap-3">
                                {scene.imageUrl && scene.imageUrl !== "#" ? (
                                  <div className="relative h-10 w-16 flex-shrink-0 overflow-hidden rounded-lg border border-zinc-800">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img 
                                      src={scene.imageUrl} 
                                      alt={`Кадр ${idx + 1}`}
                                      className="h-full w-full object-cover"
                                    />
                                  </div>
                                ) : (
                                  <div className="h-10 w-16 bg-zinc-900 rounded-lg flex items-center justify-center text-zinc-500 flex-shrink-0 border border-zinc-850">
                                    ⏳
                                  </div>
                                )}
                                <div className="max-w-[200px] truncate text-[10px] text-zinc-500 font-mono" title={scene.imagePrompt}>
                                  {scene.imagePrompt}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3.5 leading-relaxed max-w-xs break-words">
                              {scene.text}
                            </td>
                            <td className="px-4 py-3.5">
                              <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-medium border ${
                                scene.cameraEffect === "camera-shake" ? "bg-red-500/10 border-red-500/20 text-red-400" :
                                scene.cameraEffect?.startsWith("zoom") ? "bg-blue-500/10 border-blue-500/20 text-blue-400" :
                                scene.cameraEffect?.startsWith("pan") ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" :
                                "bg-zinc-500/10 border-zinc-500/20 text-zinc-400"
                              }`}>
                                {scene.cameraEffect === "zoom-in-fast" && "🔎 Zoom In Fast"}
                                {scene.cameraEffect === "zoom-out-slow" && "🔍 Zoom Out Slow"}
                                {scene.cameraEffect === "camera-shake" && "📳 Shake Action"}
                                {scene.cameraEffect === "zoom-in-spin" && "🌀 Zoom Spin"}
                                {scene.cameraEffect === "pan-left" && "⬅️ Pan Left"}
                                {scene.cameraEffect === "pan-right" && "➡️ Pan Right"}
                                {scene.cameraEffect === "pan-diagonal" && "↗️ Pan Diagonal"}
                                {!scene.cameraEffect && "🎬 Ken Burns"}
                              </span>
                            </td>
                            <td className="px-4 py-3.5">
                              <span className="text-[10px] font-mono text-zinc-500">
                                {scene.transition === "fade-to-black" && "🌑 Fade Black"}
                                {scene.transition === "glitch-cut" && "📺 Glitch Cut"}
                                {scene.transition === "white-flash" && "⚡ White Flash"}
                                {scene.transition === "cross-blur" && "🌫️ Cross Blur"}
                                {scene.transition === "cross-fade" && "🌸 Cross Fade"}
                                {!scene.transition && "⚡ Cut"}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </>
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
                  className={`group relative flex flex-col text-left rounded-2xl border p-5 transition-all duration-500 hover:-translate-y-1 hover:shadow-xl hover:shadow-purple-900/20 ${
                    selectedEpisode?.id === ep.id
                      ? "animate-glow-pulse bg-purple-950/20 z-10"
                      : "border-zinc-800/60 bg-zinc-900/30 backdrop-blur-sm hover:border-zinc-600 hover:bg-zinc-800/50"
                  }`}
                >
                  <div className="flex items-start justify-between w-full mb-3">
                    <div>
                      <h4 className="font-bold text-zinc-100 group-hover:text-purple-400 transition-colors text-sm">
                        {ep.title}
                      </h4>
                      <p className="text-[9px] text-zinc-500 font-mono mt-1 opacity-80">{ep.createdAt}</p>
                    </div>
                    <span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase ${
                      ep.status === "ready"
                        ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                        : ep.status === "pending"
                        ? "bg-amber-500/10 border-amber-500/20 text-amber-400 animate-pulse"
                        : "bg-red-500/10 border-red-500/20 text-red-400"
                    }`}>
                      {ep.status === "ready" ? "Готов" : ep.status === "pending" ? "Создается" : "Ошибка"}
                    </span>
                  </div>

                  <p className="line-clamp-2 text-xs text-zinc-400 mb-4 leading-relaxed flex-1">
                    {ep.prompt}
                  </p>

                  {/* Miniature Scene Previews Bento Style */}
                  {ep.status === "ready" && ep.scenes && ep.scenes.length > 0 && (
                    <div className="flex gap-1.5 mb-4 overflow-hidden rounded-xl bg-zinc-950/50 p-1.5 border border-zinc-800/40 w-full animate-float-subtle">
                      {ep.scenes.slice(0, 4).map((scene, sIdx) => (
                        <div key={sIdx} className="relative aspect-[9/16] flex-1 overflow-hidden rounded-lg border border-zinc-800/50 bg-zinc-900 shadow-sm">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img 
                            src={scene.imageUrl} 
                            alt=""
                            className={`h-full w-full object-cover transition-all duration-700 ${
                              selectedEpisode?.id === ep.id ? "grayscale-0 opacity-100" : "grayscale opacity-50 group-hover:grayscale-0 group-hover:opacity-100"
                            }`}
                          />
                        </div>
                      ))}
                      {ep.scenes.length > 4 && (
                        <div className="relative aspect-[9/16] flex-1 overflow-hidden rounded-lg border border-zinc-800/50 bg-zinc-900 shadow-sm flex items-center justify-center text-[10px] font-bold text-zinc-500 group-hover:text-purple-400 transition-colors">
                          +{ep.scenes.length - 4}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-between mt-auto pt-3 border-t border-zinc-800/60 w-full text-[10px] text-zinc-500 font-semibold">
                    <span className="flex items-center gap-1.5 bg-zinc-800/50 px-2 py-1 rounded-md text-zinc-300">
                      🎞️ {ep.scenes?.length || 0} сцен
                    </span>
                    <span className={`transition-all duration-300 flex items-center gap-1 ${
                      selectedEpisode?.id === ep.id ? "text-purple-400 translate-x-1" : "text-zinc-500 group-hover:text-purple-300 group-hover:translate-x-1"
                    }`}>
                      {selectedEpisode?.id === ep.id ? "Смотрим" : "Смотреть"} <span className="text-[8px]">▶</span>
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
