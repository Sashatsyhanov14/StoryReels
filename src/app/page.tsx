"use client";

import React, { useState, useEffect, useRef } from "react";
import { v4 as uuidv4 } from "uuid";
import { supabase } from "@/lib/supabase-client";
import { Icons } from "@/components/icons";
import { AnimatedSubtitles } from "@/components/AnimatedSubtitles";

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
    chips: ["Открыть металлическую дверь", "Сбежать через окно", "Подключиться к терминалу"],
  },
  {
    title: "Космическая Одиссея",
    emoji: "🚀",
    prompt: "Исследователь, открывающий гигантское светящееся кристаллическое сооружение на далекой планете.",
    color: "from-cyan-500 to-blue-600",
    theme: "space",
    chips: ["Исследовать кристалл", "Выйти в открытый космос", "Запустить гипердвигатель"],
  },
  {
    title: "Средневековое Волшебство",
    emoji: "🧙‍♂️",
    prompt: "Молодой волшебник, находящий скрытую светящуюся книгу заклинаний в темной древней библиотеке.",
    color: "from-emerald-500 to-teal-600",
    theme: "fantasy",
    chips: ["Открыть книгу", "Произнести заклинание", "Потушить факелы"],
  },
  {
    title: "Закат в стиле Синтвейв",
    emoji: "🌅",
    prompt: "Ретро-футуристический спорткар, мчащийся к гигантскому светящемуся солнцу по розовому шоссе.",
    color: "from-amber-500 to-rose-600",
    theme: "retro",
    chips: ["Врубить нитро-ускорение", "Резко свернуть на обочину", "Продолжать гнать вперед"],
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
        cameraEffect: "zoom-out-slow",
      },
      {
        imageUrl: "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=600&q=80",
        audioUrl: "#",
        text: "Детектив Каэль сканировал цифровые следы, оставленные неуловимым фантомным кодером.",
        imagePrompt: "cyberpunk detective examining glowing holographic clues",
        cameraEffect: "pan-right",
      },
      {
        imageUrl: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=600&q=80",
        audioUrl: "#",
        text: "Глубоко в недрах Района 9 массивный серверный стек пульсировал искусственной жизнью.",
        imagePrompt: "futuristic server room with green and red laser grids",
        cameraEffect: "camera-shake",
      },
    ],
  },
];

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [userId, setUserId] = useState("");
  const [tokenBalance, setTokenBalance] = useState(5);
  const [episodes, setEpisodes] = useState<Episode[]>(INITIAL_EPISODES);
  const [isRegistered, setIsRegistered] = useState(true);
  const [email, setEmail] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  // 5 Screens state machine
  // 'landing' | 'auth_sheet' | 'generating' | 'paywall' | 'player'
  const [currentScreen, setCurrentScreen] = useState<
    "landing" | "auth_sheet" | "generating" | "paywall" | "player"
  >("player");
  
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showPromptDrawer, setShowPromptDrawer] = useState(false);
  const [showDemoPayPrompt, setShowDemoPayPrompt] = useState(false);

  // Real-time generator states
  const [isGenerating, setIsGenerating] = useState(false);
  const [genStep, setGenStep] = useState<"idle" | "script" | "keyframes" | "voiceover" | "compiling">("idle");
  const [generationProgress, setGenerationProgress] = useState(0);
  const [createdEpisodeId, setCreatedEpisodeId] = useState<string | null>(null);
  const [pendingScenes, setPendingScenes] = useState<any[]>([]);

  // Simulation loader states
  const [loaderText, setLoaderText] = useState("Подключение к GPU...");
  const [simulationProgress, setSimulationProgress] = useState(0);

  // Player controls
  const [selectedEpisode, setSelectedEpisode] = useState<Episode | null>(INITIAL_EPISODES[0]);
  const [activeSceneIndex, setActiveSceneIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [transitionClass, setTransitionClass] = useState("");
  const [showChatController, setShowChatController] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<Array<{ sender: "ai" | "user"; text: string }>>([
    { sender: "ai", text: "Сюжет оборвался на самом интересном месте! Выберите продолжение или введите свой вариант:" }
  ]);

  const advanceToNextSceneRef = useRef<() => void>(() => {});
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Active scene timer for progress bars
  const [sceneProgress, setSceneProgress] = useState(0);
  const sceneProgressInterval = useRef<NodeJS.Timeout | null>(null);

  // Check auth session on load
  useEffect(() => {
    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        setIsRegistered(true);
        setUserId(session.user.email || session.user.id);
      }
    };
    checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setIsRegistered(true);
        setUserId(session.user.email || session.user.id);
      } else {
        setIsRegistered(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Sync user and fetch episodes on mount
  useEffect(() => {
    let savedUserId = localStorage.getItem("storyreels_user_id");

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
          const pendingEpisode = data.episodes.find((ep: Episode) => ep.status === "pending");
          if (pendingEpisode) {
            setSelectedEpisode(pendingEpisode);
            setCreatedEpisodeId(pendingEpisode.id);
            setPendingScenes(pendingEpisode.scenes);
            setIsGenerating(true);
            setCurrentScreen("player");
            resumeGeneration(pendingEpisode.id, savedUserId || "", pendingEpisode.scenes);
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

      setTimeout(() => {
        if (activeSceneIndex >= selectedEpisode.scenes.length - 1) {
          setIsPlaying(false);
          setShowChatController(true);
          // Set progress bar of the last item to 100%
          setSceneProgress(100);
        } else {
          setActiveSceneIndex((prev) => prev + 1);
          setSceneProgress(0);
        }
      }, 150);

      setTimeout(() => {
        setTransitionClass("");
      }, 300);
    };
  }, [selectedEpisode, activeSceneIndex]);

  // Audio system and timer simulation for story progress indicators
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

  // Handle active scene changes, audio loading, and progress intervals
  useEffect(() => {
    const audioInstance = audioRef.current;
    if (!audioInstance) return;

    audioInstance.pause();
    if (sceneProgressInterval.current) {
      clearInterval(sceneProgressInterval.current);
    }

    if (isPlaying && selectedEpisode && selectedEpisode.scenes.length > 0) {
      const activeScene = selectedEpisode.scenes[activeSceneIndex];
      const hasAudio = activeScene && activeScene.audioUrl && activeScene.audioUrl !== "#";

      if (hasAudio) {
        audioInstance.src = activeScene.audioUrl;
        audioInstance.play().catch((err) => {
          console.warn("Audio play prevented:", err);
        });

        // Track progress using audio duration
        sceneProgressInterval.current = setInterval(() => {
          if (audioInstance.duration) {
            const currentPercentage = (audioInstance.currentTime / audioInstance.duration) * 100;
            setSceneProgress(currentPercentage);
          }
        }, 100);
      } else {
        // Fallback progress interval (4.5s duration)
        const sceneDuration = 4500;
        let elapsed = 0;
        const tick = 100;

        sceneProgressInterval.current = setInterval(() => {
          elapsed += tick;
          const currentPercentage = (elapsed / sceneDuration) * 100;
          if (currentPercentage >= 100) {
            setSceneProgress(100);
            clearInterval(sceneProgressInterval.current!);
            advanceToNextSceneRef.current();
          } else {
            setSceneProgress(currentPercentage);
          }
        }, tick);
      }
    } else {
      setSceneProgress(0);
    }

    return () => {
      if (sceneProgressInterval.current) {
        clearInterval(sceneProgressInterval.current);
      }
    };
  }, [isPlaying, activeSceneIndex, selectedEpisode]);

  // Auth Action handlers
  const handleOAuthLogin = async (provider: "google" | "vk") => {
    try {
      setAuthLoading(true);
      await supabase.auth.signInWithOAuth({
        provider: provider as any,
        options: {
          redirectTo: typeof window !== "undefined" ? window.location.origin : "",
        },
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
          emailRedirectTo: typeof window !== "undefined" ? window.location.origin : "",
        },
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
    setTimeout(() => {
      setIsRegistered(true);
      setTokenBalance((prev) => prev + 10);
      setAuthLoading(false);
      // Close sheet and proceed
      startGenerationFlow();
    }, 1200);
  };

  // Switch to Auth Bottom Sheet or trigger directly if registered
  const handleStartGeneration = (customPrompt?: string) => {
    const activePrompt = customPrompt || prompt;
    if (!activePrompt.trim()) return;

    // Auth bypassed for UI prototyping
    startGenerationFlow(activePrompt);
  };

  // Start Screen 3 (loader bypassed) & backend insert
  const startGenerationFlow = async (activePrompt?: string) => {
    const finalPrompt = activePrompt || prompt;
    if (!finalPrompt.trim()) return;

    // Bypassed balance restriction for UI testing - auto-refills
    if (tokenBalance < 1) {
      setTokenBalance(10);
    }

    setIsGenerating(true);

    try {
      // 1. Create episode record in DB (generates script outline, costs 1 token)
      const response = await fetch("/api/episodes/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, prompt: finalPrompt }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Не удалось запустить создание эпизода");
      }

      const data = await response.json();
      const episodeId = data.episodeId;
      const scenes = data.scenes;

      setCreatedEpisodeId(episodeId);
      setPendingScenes(scenes);
      setTokenBalance((prev) => Math.max(0, prev - 1));
      setPrompt("");
      setShowPromptDrawer(false);

      // 2. Generate scenes in the background immediately (bypassing loader & paywall views)
      await resumeGeneration(episodeId, userId, scenes);

      // 3. Switch directly to player
      setCurrentScreen("player");
      setIsGenerating(false);
    } catch (err) {
      console.error(err);
      alert(`Ошибка инициализации: ${err instanceof Error ? err.message : String(err)}`);
      setCurrentScreen("landing");
      setIsGenerating(false);
    }
  };

  // Triggered when paywall is paid. Resumes rendering batches.
  const handlePayActivation = async () => {
    if (!createdEpisodeId || !pendingScenes.length) {
      // Fallback if DB insert didn't finish yet or failed
      alert("Пожалуйста, подождите завершения инициализации...");
      return;
    }

    setShowDemoPayPrompt(true); // Show checkout overlay
    
    // Simulate short payment processing (1.5s)
    setTimeout(async () => {
      setShowDemoPayPrompt(false);
      
      // Proceed to render scenes (run actual flux models)
      setCurrentScreen("generating");
      setLoaderText("Запуск рендеринга Flux...");
      
      // Animate progress from 89% to 99%
      let prog = 89;
      const progressTimer = setInterval(() => {
        prog = Math.min(99, prog + 1);
        setSimulationProgress(prog);
        if (prog >= 99) clearInterval(progressTimer);
      }, 300);

      // Start actual scene generation batch loops
      await resumeGeneration(createdEpisodeId, userId, pendingScenes);
      
      clearInterval(progressTimer);
      setSimulationProgress(100);
      setLoaderText("Рендеринг завершен!");

      // Transition to player after a small delay
      setTimeout(() => {
        setCurrentScreen("player");
        setIsGenerating(false);
      }, 500);

    }, 1500);
  };

  // Actual scene rendering via generation loop
  const resumeGeneration = async (episodeId: string, currentUserId: string, scenes: any[]) => {
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
        const currentProgress = Math.min(98, Math.round(89 + (k / pendingIndices.length) * 10));
        setSimulationProgress(currentProgress);
        
        const response = await fetch("/api/episodes/generate-scene", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ episodeId, sceneIndices: batch }),
        });
        
        if (!response.ok) {
          throw new Error(`Ошибка при рендере сцен: ${batch.map((idx) => idx + 1).join(", ")}`);
        }
        
        const data = await response.json();
        if (data.isCompleted) {
          break;
        }
      }

      // Sync and retrieve the ready episode
      const response = await fetch(`/api/episodes?userId=${currentUserId}`);
      if (response.ok) {
        const data = await response.json();
        const episodesList: Episode[] = data.episodes || [];
        setEpisodes(episodesList);
        
        const finishedEp = episodesList.find((ep) => ep.id === episodeId);
        if (finishedEp) {
          setSelectedEpisode(finishedEp);
          setActiveSceneIndex(0);
          setShowChatController(false);
          setIsPlaying(true);
        }
      }
    } catch (err) {
      console.error("Batch rendering failed:", err);
      alert(`Ошибка рендеринга: ${err instanceof Error ? err.message : String(err)}`);
      
      // Set status to failed in DB
      await fetch(`/api/episodes/fail`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ episodeId }),
      }).catch(console.error);

      // Refresh episodes
      const response = await fetch(`/api/episodes?userId=${currentUserId}`);
      if (response.ok) {
        const data = await response.json();
        setEpisodes(data.episodes || []);
      }
      
      setCurrentScreen("landing");
      setIsGenerating(false);
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
        // Mock fallback for sandbox
        const addRes = await fetch("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, addTokens: 5 }),
        });
        const addData = await addRes.json();
        if (addData.tokenBalance !== undefined) {
          setTokenBalance(addData.tokenBalance);
          alert(" Sandbox: Начислено +5 токенов в Supabase!");
        }
      }
    } catch (err) {
      console.error("Top up failed:", err);
      setTokenBalance((prev) => prev + 5);
      alert("Начислено +5 токенов (клиентский демо-режим)!");
    }
  };

  // Continue story from chat controller in Screen 4
  const handleChatSubmit = (e?: React.FormEvent, customText?: string) => {
    if (e) e.preventDefault();
    const messageText = customText || chatInput;
    if (!messageText.trim()) return;

    // Add user message to chat state
    setChatMessages((prev) => [...prev, { sender: "user", text: messageText }]);
    setChatInput("");

    // Initiate next episode creation using the chat choice as the prompt
    setTimeout(() => {
      // Transition back to generating step
      handleStartGeneration(messageText);
    }, 800);
  };

  // Get active preset prompt options for the chat controller
  const getActiveChips = () => {
    if (!selectedEpisode) return ["Идти вперед", "Осмотреться", "Бежать назад"];
    const foundPreset = PRESET_PROMPTS.find((p) =>
      selectedEpisode.prompt.toLowerCase().includes(p.theme)
    );
    return foundPreset ? foundPreset.chips : ["Искать другой выход", "Идти на таран", "Сдаться"];
  };

  // Screen click handles to skip previous/next stories in Instagram-style player
  const handlePlayerScreenClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const isLeftClick = clickX < rect.width * 0.33; // Left 33%

    if (isLeftClick) {
      if (activeSceneIndex > 0) {
        setActiveSceneIndex((prev) => prev - 1);
        setSceneProgress(0);
        setShowChatController(false);
      }
    } else {
      if (activeSceneIndex < selectedEpisode!.scenes.length - 1) {
        setActiveSceneIndex((prev) => prev + 1);
        setSceneProgress(0);
      } else {
        setIsPlaying(false);
        setShowChatController(true);
        setSceneProgress(100);
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#030303] text-zinc-100 flex flex-col items-center justify-center font-sans overflow-x-hidden relative selection:bg-purple-600/40 select-none">
      
      {/* Background neon blurred orbs for desktop environment */}
      <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[120px] pointer-events-none z-0 animate-pulse"></div>
      <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-cyan-600/10 rounded-full blur-[120px] pointer-events-none z-0 animate-pulse"></div>

      {/* Desktop Container (Side info panels + Phone mockup frame) */}
      <div className="lg:hidden w-full max-w-6xl z-10 flex flex-col md:flex-row items-center justify-center gap-12 px-6 py-6 sm:py-12">
        
        {/* Left Side: Product pitch on desktop screens */}
        <div className="hidden md:flex flex-col max-w-md gap-6 text-left">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-purple-600 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
              <span className="text-2xl font-bold tracking-tighter text-white">S</span>
            </div>
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-white">
                Story<span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">Reels</span>
              </h1>
              <p className="text-xs uppercase tracking-widest text-zinc-500 font-semibold font-mono">
                ИИ СТУДИЯ ИНТЕРАКТИВНЫХ СЕРИАЛОВ
              </p>
            </div>
          </div>

          <p className="text-sm text-zinc-400 leading-relaxed">
            Полноценный интерактивный кинотеатр в вертикальном формате. Напишите, как должен поступить герой, и нейросеть мгновенно сгенерирует сюжетную линию, кадры и русскую озвучку.
          </p>

          <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-5 backdrop-blur-md flex flex-col gap-4 text-xs">
            <div className="flex items-center gap-3">
              <div className="text-xl">⚙️</div>
              <div>
                <h4 className="font-bold text-white mb-0.5">Вайб-дизайн система</h4>
                <p className="text-zinc-500">Dark Mode, минимализм, стекло (glassmorphism) и неон.</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-xl">🎭</div>
              <div>
                <h4 className="font-bold text-white mb-0.5">Интерактивный плеер</h4>
                <p className="text-zinc-500">Интегрированный чат-контроллер в конце каждого ролика для продолжения истории.</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-xl">💳</div>
              <div>
                <h4 className="font-bold text-white mb-0.5">Микротранзакции</h4>
                <p className="text-zinc-500">Пэйволл на 19 ₽ перед рендерингом пилотной серии, подключенный к ЮKassa.</p>
              </div>
            </div>
          </div>

          <div className="text-zinc-600 text-[11px] font-mono">
            * Для мобильных устройств макет автоматически открывается на весь экран.
          </div>
        </div>

        {/* Center: Smartphone Mockup Frame */}
        <div className="w-full max-w-[390px] aspect-[9/19] h-[800px] relative z-20 flex-shrink-0 group-hover:scale-[1.01] transition-transform duration-500 sm:border-[10px] sm:border-zinc-800 sm:rounded-[3.2rem] sm:shadow-[0_0_80px_rgba(0,0,0,0.9),_0_0_120px_rgba(168,85,247,0.1)] sm:bg-black overflow-hidden
          max-sm:h-screen max-sm:w-screen max-sm:rounded-none max-sm:border-none max-sm:max-w-none max-sm:aspect-auto">
          
          {/* iOS Notch & Status Bar (Hidden on full mobile layouts to look native) */}
          <div className="absolute top-0 inset-x-0 h-10 z-50 flex items-center justify-between px-6 pointer-events-none select-none sm:flex hidden">
            <span className="text-[10px] font-semibold text-white/90">9:41</span>
            {/* Dynamic Island */}
            <div className="w-24 h-4.5 bg-black rounded-full absolute left-1/2 -translate-x-1/2 top-1.5 border border-zinc-800/40"></div>
            <div className="flex items-center gap-1.5 text-[10px] text-white/90">
              <span>📶</span>
              <span>5G</span>
              <span>🔋</span>
            </div>
          </div>

          {/* Device Screen Body */}
          <div className="w-full h-full relative overflow-hidden bg-black text-zinc-100 flex flex-col justify-between sm:rounded-[2.4rem] max-sm:rounded-none">
            
            {/* ========================================================================= */}
            {/* SCREEN 1: LANDING (ENTRANCE) */}
            {/* ========================================================================= */}
            {currentScreen === "landing" && (
              <div className="h-full w-full relative overflow-hidden bg-black flex flex-col justify-between animate-fade-in">
                {/* Background Loop Video */}
                <video
                  src="https://assets.mixkit.co/videos/preview/mixkit-cyberpunk-neon-city-scenery-at-night-40850-large.mp4"
                  className="absolute inset-0 w-full h-full object-cover brightness-50 opacity-80 z-0"
                  autoPlay
                  loop
                  muted
                  playsInline
                />
                
                {/* Header (Top) */}
                <header className="relative z-10 w-full px-5 pt-12 pb-4 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent">
                  <div className="flex items-center gap-2" onClick={() => setSidebarOpen(true)}>
                    <div className="h-7 w-7 rounded-lg bg-gradient-to-tr from-purple-600 to-pink-500 flex items-center justify-center cursor-pointer hover:opacity-90 active:scale-95 transition-all">
                      <span className="text-sm font-bold text-white">S</span>
                    </div>
                    <span className="font-extrabold text-sm tracking-tight text-white cursor-pointer" onClick={() => setSidebarOpen(true)}>
                      Storyreels
                    </span>
                  </div>
                  <span className="bg-white/10 backdrop-blur-md border border-white/20 px-2.5 py-0.5 rounded-full text-[9px] font-bold text-zinc-300 tracking-wide">
                    Серия 1
                  </span>
                </header>

                {/* Center Title */}
                <div className="relative z-10 px-6 flex-grow flex items-center justify-center">
                  <h2 className="text-2xl sm:text-3xl font-black text-center text-white drop-shadow-[0_4px_15px_rgba(0,0,0,0.9)] tracking-tight leading-tight select-none">
                    «Сюжет оборвался. Что сделает герой?»
                  </h2>
                </div>

                {/* Bottom-0 Fixed panel */}
                <div className="relative z-10 bg-gradient-to-t from-black via-black/90 to-transparent pt-28 pb-8 px-4 flex flex-col w-full">
                  {/* Fake input text/button trigger */}
                  <div 
                    onClick={() => setShowPromptDrawer(true)}
                    className="w-full bg-zinc-900/90 backdrop-blur-md border border-zinc-800 rounded-xl px-4 py-3 text-zinc-400 text-left text-xs mb-3.5 flex items-center justify-between shadow-lg cursor-pointer hover:border-zinc-700 hover:text-zinc-300 transition-all select-none active:scale-[0.99]"
                  >
                    <span>{prompt ? prompt : "Напиши свой вариант финала..."}</span>
                    <span>✨</span>
                  </div>

                  {/* Preset chips */}
                  <div className="flex gap-2 mb-4 justify-center">
                    <button 
                      onClick={() => {
                        setPrompt("Герой осторожно открывает ржавую железную дверь...");
                        handleStartGeneration("Герой осторожно открывает ржавую железную дверь...");
                      }}
                      className="bg-white/10 hover:bg-white/20 backdrop-blur text-white text-xs px-3.5 py-1.5 rounded-full border border-white/15 transition-all cursor-pointer select-none active:scale-95"
                    >
                      [Дверь]
                    </button>
                    <button 
                      onClick={() => {
                        setPrompt("Герой выбивает стекло и прыгает в открытое окно...");
                        handleStartGeneration("Герой выбивает стекло и прыгает в открытое окно...");
                      }}
                      className="bg-white/10 hover:bg-white/20 backdrop-blur text-white text-xs px-3.5 py-1.5 rounded-full border border-white/15 transition-all cursor-pointer select-none active:scale-95"
                    >
                      [Окно]
                    </button>
                  </div>

                  {/* CTA generate button */}
                  <button 
                    onClick={() => {
                      if (isGenerating) return;
                      if (!prompt) {
                        setShowPromptDrawer(true);
                      } else {
                        handleStartGeneration();
                      }
                    }}
                    disabled={isGenerating}
                    className="w-full py-4 rounded-2xl font-black text-xs uppercase tracking-wider text-black bg-white select-none active:scale-[0.98] transition-all duration-300 shadow-[0_0_20px_rgba(255,255,255,0.4)] disabled:opacity-75 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
                  >
                    {isGenerating ? (
                      <>
                        <div className="h-4.5 w-4.5 animate-spin rounded-full border-2 border-black border-t-transparent"></div>
                        Генерируем серию...
                      </>
                    ) : (
                      "Сгенерировать продолжение"
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Prompt Drawer slide up on click */}
            {showPromptDrawer && (
              <>
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-30 transition-opacity" onClick={() => setShowPromptDrawer(false)}></div>
                <div className="absolute bottom-0 inset-x-0 bg-zinc-950/95 backdrop-blur-2xl border-t border-zinc-900 rounded-t-[2rem] p-6 z-40 flex flex-col gap-4.5 animate-slide-up shadow-[0_-15px_45px_rgba(0,0,0,0.9)]">
                  <div className="w-12 h-1 bg-zinc-800 rounded-full mx-auto mb-1"></div>
                  
                  <div className="flex flex-col gap-1.5">
                    <h3 className="text-xs font-mono uppercase tracking-widest text-purple-400 font-black">
                      Генератор серии
                    </h3>
                    <p className="text-[10px] text-zinc-500 font-mono">
                      Опишите, что произойдет с героем дальше в этом эпизоде.
                    </p>
                  </div>

                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Например: Каэль подключается к терминалу и взламывает серверы корпорации, вызывая перегрузку сети..."
                    className="w-full h-28 bg-zinc-950 border border-zinc-900 rounded-2xl p-4 text-[11px] text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-purple-500/80 focus:shadow-[0_0_15px_rgba(168,85,247,0.15)] resize-none transition-all"
                  />

                  <div className="flex gap-3">
                    <button 
                      onClick={() => setShowPromptDrawer(false)}
                      className="flex-1 py-3.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800/80 rounded-xl text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400 hover:text-white transition-all active:scale-[0.98]"
                    >
                      Отмена
                    </button>
                    <button 
                      onClick={() => handleStartGeneration()}
                      disabled={!prompt.trim() || isGenerating}
                      className="flex-1 py-3.5 bg-white hover:bg-zinc-100 text-black rounded-xl text-[10px] font-mono font-black uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(255,255,255,0.15)]"
                    >
                      {isGenerating ? (
                        <>
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-black border-t-transparent"></div>
                          Рендер...
                        </>
                      ) : (
                        "Создать"
                      )}
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* ========================================================================= */}
            {/* SCREEN 2: AUTH BOTTOM SHEET */}
            {/* ========================================================================= */}
            {currentScreen === "auth_sheet" && (
              <div className="h-full w-full relative overflow-hidden bg-black flex flex-col justify-between">
                {/* Visual background placeholder from screen 1 */}
                <div className="absolute inset-0 bg-zinc-950 pointer-events-none opacity-40 z-0"></div>
                
                {/* Sheet Backdrop Blur Overlay */}
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-10" onClick={() => setCurrentScreen("player")}></div>
                
                {/* Bottom Sheet Modal */}
                <div className="absolute bottom-0 inset-x-0 bg-zinc-900/95 backdrop-blur-2xl border-t border-zinc-800 rounded-t-[2.5rem] p-6 z-20 flex flex-col gap-6 shadow-[0_-10px_40px_rgba(0,0,0,0.8)] animate-slide-up">
                  {/* Top Drag Handle */}
                  <div className="w-12 h-1 bg-zinc-700 rounded-full mx-auto mb-1"></div>
                  
                  {/* Content Head */}
                  <div className="text-center">
                    <h3 className="text-lg font-black text-white tracking-tight mb-1">
                      Куда сохранить сериал?
                    </h3>
                    <p className="text-[10px] text-zinc-400 max-w-[240px] mx-auto leading-relaxed">
                      Создайте профиль, чтобы отслеживать серии, копить токены и делиться сюжетами.
                    </p>
                  </div>

                  {/* Auth Buttons */}
                  <div className="flex flex-col gap-2.5 relative">
                    {authLoading && (
                      <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60 backdrop-blur-sm rounded-xl">
                        <div className="h-6 w-6 animate-spin rounded-full border-2 border-purple-500 border-t-transparent"></div>
                      </div>
                    )}
                    
                    {/* Telegram Login */}
                    <button 
                      onClick={handleTelegramLogin}
                      disabled={authLoading}
                      className="bg-[#2AABEE] hover:bg-[#229ED9] text-white py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-3 transition-all cursor-pointer shadow-lg active:scale-95"
                    >
                      <span className="text-base">✈️</span> Войти в 1 клик
                    </button>

                    {/* Google Login */}
                    <button 
                      onClick={() => handleOAuthLogin("google")}
                      disabled={authLoading}
                      className="bg-white hover:bg-zinc-100 text-black border border-zinc-200 py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-3 transition-all cursor-pointer shadow-md active:scale-95"
                    >
                      <span className="text-base font-serif font-black">G</span> Войти через Google
                    </button>
                  </div>

                  {/* Email Login Form (Magic Link) */}
                  <form onSubmit={handleMagicLink} className="relative mt-2">
                    <input 
                      type="email" 
                      placeholder="Или почта для волшебной ссылки" 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={authLoading}
                      className="w-full bg-black/40 border border-zinc-800 text-white placeholder-zinc-500 text-[10px] px-3.5 py-3 rounded-xl focus:outline-none focus:border-purple-500 transition-colors"
                    />
                    <button 
                      type="submit" 
                      disabled={authLoading || !email.includes("@")}
                      className="absolute right-1 top-1 bottom-1 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 px-3.5 rounded-lg text-[9px] font-bold text-white transition-colors"
                    >
                      Войти
                    </button>
                  </form>

                  {/* Cancel Button */}
                  <button 
                    onClick={() => setCurrentScreen("player")}
                    className="text-zinc-500 hover:text-zinc-400 text-xs font-semibold text-center mt-1 cursor-pointer transition-colors"
                  >
                    Вернуться назад
                  </button>
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* SCREEN 3: GENERATION LOADER & MICRO-PAYWALL */}
            {/* ========================================================================= */}
            {(currentScreen === "generating" || currentScreen === "paywall") && (
              <div className="h-full w-full relative overflow-hidden bg-black flex flex-col items-center justify-center p-6 animate-fade-in">
                
                {/* Generation loader text & bar */}
                <div className="text-center flex flex-col items-center gap-4 z-10">
                  <div className="relative mb-3">
                    <div className="h-16 w-16 rounded-full border-[3px] border-purple-500/10 border-t-purple-500 animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center text-xl animate-pulse">🧠</div>
                  </div>
                  <h3 className="text-sm font-bold text-white tracking-wider animate-pulse duration-1000">
                    {loaderText}
                  </h3>
                  
                  {/* Progress bar container */}
                  <div className="w-48 h-1 bg-zinc-900 rounded-full overflow-hidden relative shadow-[0_0_10px_rgba(0,0,0,0.5)]">
                    <div 
                      className="h-full bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500 rounded-full shadow-[0_0_15px_#a855f7] transition-all duration-300"
                      style={{ width: `${simulationProgress}%` }}
                    ></div>
                  </div>
                  <span className="text-[10px] font-mono text-zinc-500 font-bold">
                    {simulationProgress}%
                  </span>
                </div>

                {/* State 2 Paywall Modal Overlay */}
                {currentScreen === "paywall" && (
                  <div className="absolute inset-0 bg-black/70 backdrop-blur-sm z-20 flex items-center justify-center p-4">
                    <div className="bg-zinc-950/80 backdrop-blur-xl border border-zinc-900/80 rounded-3xl p-5.5 text-center shadow-[0_10px_50px_rgba(168,85,247,0.25)] max-w-[90%] z-30 animate-scale-in">
                      
                      {/* Discount Badge */}
                      <span className="inline-block bg-gradient-to-r from-red-500 to-pink-500 text-white text-[9px] font-black tracking-widest px-2.5 py-1 rounded-md uppercase mb-4 shadow-[0_0_15px_rgba(239,68,68,0.4)]">
                        СКИДКА 85%
                      </span>

                      {/* Paywall Copy */}
                      <h4 className="text-sm font-extrabold text-white tracking-tight mb-2 leading-snug">
                        Рендеринг готов к запуску.
                      </h4>
                      <p className="text-[10px] text-zinc-400 leading-relaxed mb-6">
                        Активируйте генерацию пилотной серии прямо сейчас всего за <strong className="text-purple-400">19 ₽</strong>. Включает 15 полноценных кадров ИИ и озвучку.
                      </p>

                      {/* Payment buttons container */}
                      <div className="flex flex-col gap-2.5">
                        {/* Shimmer pay button */}
                        <button 
                          onClick={handlePayActivation}
                          className="w-full relative overflow-hidden py-3.5 rounded-xl font-black text-xs uppercase tracking-wider text-white bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 bg-[size:200%_auto] animate-shimmer shadow-[0_0_20px_rgba(168,85,247,0.4)] hover:scale-[1.01] active:scale-[0.98] transition-all cursor-pointer"
                        >
                          Оплатить 19 ₽
                        </button>

                        {/* Sandbox bypass for developers */}
                        <button 
                          onClick={() => {
                            setSimulationProgress(100);
                            setCurrentScreen("generating");
                            setLoaderText("Запуск демо-рендеринга...");
                            setTimeout(async () => {
                              if (createdEpisodeId) {
                                await resumeGeneration(createdEpisodeId, userId, pendingScenes);
                              }
                              setCurrentScreen("player");
                              setIsGenerating(false);
                            }, 1200);
                          }}
                          className="text-zinc-500 hover:text-zinc-400 text-[9px] tracking-wide font-bold uppercase transition-colors py-1 cursor-pointer"
                        >
                          [ Демо-режим (0 токенов) ]
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Secure Checkout Overlay during simulation */}
                {showDemoPayPrompt && (
                  <div className="absolute inset-0 bg-black/90 backdrop-blur-md z-40 flex flex-col items-center justify-center p-6 text-center animate-fade-in">
                    <div className="h-10 w-10 animate-spin rounded-full border-2 border-purple-500 border-t-transparent mb-4"></div>
                    <h4 className="text-sm font-bold text-white mb-1">Соединение с ЮKassa...</h4>
                    <p className="text-[10px] text-zinc-500 font-mono">Безопасная оплата 19.00 RUB</p>
                    <div className="mt-8 flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-[9px] font-semibold text-zinc-400">
                      <span>🔒</span> Защищено шифрованием SSL
                    </div>
                  </div>
                )}

              </div>
            )}

            {/* ========================================================================= */}
            {/* SCREEN 4: MAIN PLAYER */}
            {/* ========================================================================= */}
            {currentScreen === "player" && selectedEpisode && (
              <div className="h-full w-full bg-black relative flex flex-col justify-between overflow-hidden animate-fade-in">
                
                {/* Layer 1: Media (Video / Pan Image Animation) */}
                <div 
                  onClick={handlePlayerScreenClick}
                  className="absolute inset-0 z-0 h-full w-full overflow-hidden flex items-center justify-center cursor-pointer"
                >
                  {selectedEpisode.scenes.map((scene, idx) => {
                    const isActive = idx === activeSceneIndex;
                    const isVideo = scene.imageUrl.endsWith(".mp4") || scene.imageUrl.includes("video");

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
                            ? scene.cameraEffect === "zoom-in-fast"
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
                              : idx % 2 === 0
                              ? "animate-ken-burns-in"
                              : "animate-ken-burns-out"
                            : ""
                        }`}
                      />
                    );
                  })}

                  {/* Transition Screen Overlay */}
                  {transitionClass && (
                    <div className={`absolute inset-0 z-20 pointer-events-none ${
                      transitionClass === "fade-to-black" ? "animate-fade-to-black-transition" :
                      transitionClass === "glitch-cut" ? "animate-glitch-cut-transition" :
                      transitionClass === "white-flash" ? "animate-white-flash-transition" :
                      transitionClass === "cross-blur" ? "animate-cross-blur-transition" :
                      transitionClass === "cross-fade" ? "animate-cross-fade-transition" : ""
                    }`} />
                  )}

                  {/* Pause Button Overlay indicator */}
                  {!isPlaying && !showChatController && (
                    <div className="absolute inset-0 bg-black/30 z-20 flex items-center justify-center pointer-events-none animate-fade-in">
                      <div className="h-14 w-14 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white border border-white/20">
                        <Icons.Play className="w-5 h-5 fill-white text-white translate-x-0.5" />
                      </div>
                    </div>
                  )}
                </div>

                {/* Layer 2: Player UI overlays */}
                <div className="relative z-10 w-full flex flex-col justify-between h-full pointer-events-none">
                  
                  {/* Top Stories Progress Indicators */}
                  <div className="w-full pt-16 pb-3 px-4 flex flex-col gap-3 bg-gradient-to-b from-black/90 via-black/40 to-transparent">
                    {/* Progress bars row */}
                    <div className="flex gap-1.5 w-full">
                      {selectedEpisode.scenes.map((_, idx) => {
                        const isWatched = idx < activeSceneIndex;
                        const isCurrent = idx === activeSceneIndex;
                        
                        return (
                          <div key={idx} className="h-[3px] flex-1 bg-white/15 rounded-full overflow-hidden">
                            <div 
                              className={`h-full transition-all ease-linear ${
                                isWatched 
                                  ? "w-full bg-purple-500 shadow-[0_0_8px_#a855f7]" 
                                  : isCurrent 
                                  ? "bg-gradient-to-r from-purple-500 to-pink-500 shadow-[0_0_10px_#d946ef]" 
                                  : "w-0 bg-transparent"
                              }`}
                              style={isCurrent ? { width: `${sceneProgress}%` } : {}}
                            />
                          </div>
                        );
                      })}
                    </div>

                    {/* Header Controls inside player */}
                    <div className="flex justify-between items-center pointer-events-auto">
                      {/* Sidebar Menu icon */}
                      <button 
                        onClick={() => setSidebarOpen(true)}
                        className="h-10 w-10 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center text-white hover:bg-black/60 hover:border-white/20 active:scale-95 transition-all shadow-lg"
                        title="Моя библиотека"
                      >
                        <Icons.List className="w-5 h-5" />
                      </button>

                      {/* Episode Title Badge */}
                      <div className="bg-zinc-950/60 backdrop-blur-md border border-white/10 px-4 py-1.5 rounded-full flex flex-col items-center shadow-md">
                        <span className="text-[10px] font-mono tracking-widest text-white uppercase font-black">
                          {selectedEpisode.title}
                        </span>
                        <span className="text-[8px] text-zinc-400 font-mono tracking-wide mt-0.5">
                          кадр {activeSceneIndex + 1} из {selectedEpisode.scenes.length}
                        </span>
                      </div>

                      {/* New story button */}
                      <button 
                        onClick={() => {
                          setPrompt("");
                          setShowPromptDrawer(true);
                        }}
                        className="h-10 w-10 rounded-full bg-purple-500/10 backdrop-blur-md border border-purple-500/20 flex items-center justify-center text-purple-300 hover:bg-purple-500/20 active:scale-95 transition-all shadow-lg shadow-purple-500/5"
                        title="Создать сериал"
                      >
                        <Icons.Sparkles className="w-5 h-5 fill-purple-400/25" />
                      </button>
                    </div>
                  </div>

                  {/* CapCut-style Animated Subtitles */}
                  {!showChatController && selectedEpisode.scenes[activeSceneIndex] && (
                    <div className="mt-auto mb-36 px-4 w-full flex justify-center text-center pointer-events-none z-30">
                      <AnimatedSubtitles
                        text={selectedEpisode.scenes[activeSceneIndex].text}
                        sceneKey={activeSceneIndex}
                        isPlaying={isPlaying}
                      />
                    </div>
                  )}
                </div>

                {/* Layer 3: Chat Controller (Slides up on final scene completion) */}
                <div 
                  className={`absolute bottom-0 inset-x-0 z-30 transition-transform duration-500 ease-out flex flex-col ${
                    showChatController ? "translate-y-0" : "translate-y-full"
                  }`}
                >
                  <div className="bg-black/90 backdrop-blur-xl border-t border-zinc-800 p-4.5 flex flex-col gap-4 shadow-[0_-15px_35px_rgba(0,0,0,0.9)] w-full">
                    
                    {/* Drag decoration handle */}
                    <div className="w-10 h-1 bg-zinc-800 rounded-full mx-auto mb-1"></div>

                    {/* Messages Stack */}
                    <div className="flex flex-col gap-3">
                      {chatMessages.map((msg, idx) => (
                        <div 
                          key={idx}
                          className={`flex max-w-[85%] text-[11px] leading-relaxed px-3.5 py-2.5 rounded-2xl ${
                            msg.sender === "ai"
                              ? "bg-zinc-900 border border-zinc-800 text-zinc-300 rounded-tl-none self-start"
                              : "bg-white text-black font-semibold rounded-tr-none self-end"
                          }`}
                        >
                          {msg.text}
                        </div>
                      ))}
                    </div>

                    {/* Chips preset options */}
                    <div className="flex gap-2 overflow-x-auto pb-1.5 scrollbar-none scroll-smooth select-none w-full pointer-events-auto">
                      {getActiveChips().map((chipText, cIdx) => (
                        <button
                          key={cIdx}
                          onClick={(e) => {
                            if (isGenerating) return;
                            handleChatSubmit(e, chipText);
                          }}
                          disabled={isGenerating}
                          className="bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-purple-300 text-[10px] font-bold px-3.5 py-2 rounded-full whitespace-nowrap transition-colors cursor-pointer select-none active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {chipText}
                        </button>
                      ))}
                    </div>

                    {/* Real Text Input */}
                    <form 
                      onSubmit={handleChatSubmit}
                      className="flex gap-2 w-full pointer-events-auto items-center"
                    >
                      <input 
                        type="text"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        placeholder={isGenerating ? "Идет генерация новой серии..." : "Напиши свой вариант финала..."}
                        disabled={isGenerating}
                        className="flex-grow bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-[11px] text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                      <button 
                        type="submit"
                        disabled={!chatInput.trim() || isGenerating}
                        className="h-10 w-10 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-xl flex items-center justify-center transition-colors cursor-pointer active:scale-95 flex-shrink-0"
                      >
                        {isGenerating ? (
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                        ) : (
                          <Icons.ArrowRight className="w-4 h-4" />
                        )}
                      </button>
                    </form>

                  </div>
                </div>

              </div>
            )}

            {currentScreen === "player" && !selectedEpisode && (
              <div className="h-full w-full bg-black relative flex flex-col justify-center items-center px-6 text-center animate-fade-in">
                {/* Background ambient neon glow */}
                <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-48 h-48 bg-purple-600/10 rounded-full blur-[80px] pointer-events-none"></div>
                <div className="absolute bottom-1/4 left-1/3 w-36 h-36 bg-pink-600/10 rounded-full blur-[60px] pointer-events-none"></div>

                {/* Glassmorphic card */}
                <div className="w-full bg-zinc-950/40 border border-zinc-900 backdrop-blur-xl rounded-3xl p-6.5 flex flex-col gap-6 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
                  <div className="h-16 w-16 rounded-2xl bg-gradient-to-tr from-purple-600 to-pink-500 flex items-center justify-center border border-purple-400/20 shadow-[0_0_20px_rgba(168,85,247,0.3)] mx-auto animate-pulse-slow">
                    <Icons.Sparkles className="w-8 h-8 text-white" />
                  </div>

                  <div className="flex flex-col gap-2">
                    <h3 className="text-base font-black text-white uppercase tracking-wider">Создайте свой первый сериал</h3>
                    <p className="text-[11px] text-zinc-500 leading-relaxed">
                      У вас пока нет активных историй. Введите любую идею или выберите один из шаблонов, чтобы сгенерировать уникальный интерактивный сериал с ИИ-озвучкой и кадрами.
                    </p>
                  </div>

                  {/* Preset chips inside empty state dashboard */}
                  <div className="flex flex-wrap gap-2 justify-center py-2">
                    {PRESET_PROMPTS.map((item, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setPrompt(item.prompt);
                          setShowPromptDrawer(true);
                        }}
                        className="bg-zinc-900/50 hover:bg-zinc-900/80 border border-zinc-800 text-[10px] text-zinc-300 font-bold px-3 py-1.5 rounded-xl transition-all cursor-pointer active:scale-95 flex items-center gap-1.5"
                      >
                        <span>{item.emoji}</span>
                        {item.title}
                      </button>
                    ))}
                  </div>

                  <button 
                    onClick={() => {
                      setPrompt("");
                      setShowPromptDrawer(true);
                    }}
                    className="w-full py-3.5 bg-white text-black font-black text-xs uppercase tracking-wider rounded-xl transition-all hover:scale-[1.01] active:scale-[0.98] shadow-[0_0_20px_rgba(255,255,255,0.15)] flex items-center justify-center gap-2"
                  >
                    <Icons.Sparkles className="w-4 h-4 text-purple-600 fill-purple-600" />
                    Начать генерацию
                  </button>
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* SCREEN 5: SIDEBAR (LIBRARY) */}
            {/* ========================================================================= */}
            {sidebarOpen && (
              <>
                {/* Sidebar backdrop blur overlay */}
                <div 
                  className="absolute inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity" 
                  onClick={() => setSidebarOpen(false)}
                ></div>
                
                {/* Sidebar Container */}
                <div className="absolute left-0 top-0 bottom-0 w-[80%] max-w-[285px] bg-zinc-950/95 backdrop-blur-2xl border-r border-zinc-900 z-50 flex flex-col justify-between shadow-[15px_0_50px_rgba(0,0,0,0.95)] animate-slide-right-panel">
                  
                  {/* Sidebar Header */}
                  <div className="p-5 border-b border-zinc-900/60 flex flex-col gap-4.5">
                    <div className="flex items-center gap-3">
                      {/* Avatar placeholder */}
                      <div className="h-10 w-10 rounded-full bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shadow-[0_0_15px_rgba(168,85,247,0.15)]">
                        <span className="font-mono font-black text-purple-300 text-xs">
                          {userId ? userId.substring(0, 2).toUpperCase() : "G"}
                        </span>
                      </div>
                      <div className="flex flex-col overflow-hidden">
                        <span className="text-[10px] font-mono text-zinc-400 font-bold truncate">
                          {userId || "Гость"}
                        </span>
                        <span className="text-[8px] text-purple-400 uppercase tracking-widest font-black mt-0.5">
                          СТАТУС: АКТИВЕН
                        </span>
                      </div>
                    </div>

                    {/* Token Balance Card */}
                    <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-4 flex justify-between items-center shadow-inner">
                      <div className="flex flex-col">
                        <span className="text-[8px] text-zinc-500 uppercase tracking-wider font-bold">Баланс</span>
                        <span className="text-xs font-black text-white flex items-center gap-1.5 mt-0.5">
                          {tokenBalance} токенов
                        </span>
                      </div>
                      <button 
                        onClick={() => {
                          setSidebarOpen(false);
                          handleTopUp();
                        }}
                        className="bg-purple-600 hover:bg-purple-500 text-white text-[9px] font-mono font-bold uppercase tracking-wider px-3.5 py-2 rounded-xl transition-all cursor-pointer active:scale-95 shadow-[0_0_15px_rgba(168,85,247,0.25)]"
                      >
                        Пополнить
                      </button>
                    </div>
                  </div>

                  {/* Series List (vertical scroll) */}
                  <div className="flex-grow overflow-y-auto px-4 py-4 flex flex-col gap-3 scrollbar-none">
                    <h4 className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest pl-1 font-bold">
                      Моя библиотека
                    </h4>

                    {episodes.map((ep) => (
                      <button
                        key={ep.id}
                        onClick={() => {
                          setSelectedEpisode(ep);
                          setActiveSceneIndex(0);
                          setShowChatController(false);
                          setIsPlaying(false);
                          setSidebarOpen(false);
                          setCurrentScreen("player");
                        }}
                        className={`flex gap-3 text-left rounded-xl p-2.5 transition-all border ${
                          selectedEpisode?.id === ep.id
                            ? "bg-purple-950/20 border-purple-500/35"
                            : "border-transparent hover:bg-zinc-900/40 hover:border-zinc-900"
                        }`}
                      >
                        {/* Thumbnail image or placeholder */}
                        <div className="h-12 w-12 rounded-lg bg-zinc-900 border border-zinc-800 overflow-hidden flex-shrink-0 flex items-center justify-center">
                          {ep.scenes && ep.scenes[0] && ep.scenes[0].imageUrl ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img 
                              src={ep.scenes[0].imageUrl} 
                              alt="" 
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <span className="text-xs">🎞️</span>
                          )}
                        </div>

                        {/* Title & Stats */}
                        <div className="flex flex-col justify-center overflow-hidden">
                          <h5 className="text-[11px] font-bold text-white truncate max-w-[150px]">
                            {ep.title}
                          </h5>
                          <span className="text-[8px] text-zinc-500 font-mono mt-0.5 uppercase tracking-wide">
                            {ep.scenes ? `${ep.scenes.length} кадров` : "0 кадров"}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* Sidebar Footer */}
                  <div className="p-5 border-t border-zinc-900 flex justify-between items-center">
                    <button 
                      onClick={() => {
                        setSidebarOpen(false);
                        setPrompt("");
                        setShowPromptDrawer(true);
                      }}
                      className="text-zinc-400 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Icons.Sparkles className="w-4 h-4 text-purple-400" /> Создать новый
                    </button>
                    
                    <button 
                      onClick={async () => {
                        await supabase.auth.signOut();
                        setIsRegistered(true);
                        setSidebarOpen(false);
                        setCurrentScreen("player");
                      }}
                      className="text-red-500/80 hover:text-red-400 text-[10px] font-bold uppercase transition-colors cursor-pointer"
                    >
                      Выйти
                    </button>
                  </div>

                </div>
              </>
            )}

            {/* Bottom Safe Area bar decorator (virtual iOS home line) */}
            <div className="absolute bottom-1 inset-x-0 h-1 z-50 pointer-events-none sm:block hidden">
              <div className="w-32 h-1 bg-white/20 rounded-full mx-auto"></div>
            </div>

          </div>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* DESKTOP DASHBOARD (GRID VIEW FOR SCREEN >= 1024px) */}
      {/* ========================================================================= */}
      {(currentScreen === "player" || currentScreen === "generating" || currentScreen === "paywall" || currentScreen === "auth_sheet") && (
        <div className="hidden lg:flex w-full h-screen bg-[#030303] overflow-hidden text-zinc-200 z-10 relative">
          
          {/* Left Sidebar (Library & Profile) */}
          <aside className="w-80 bg-zinc-950/60 border-r border-zinc-900 flex flex-col justify-between h-full">
            {/* Sidebar Top: Logo */}
            <div className="p-6 border-b border-zinc-900 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-purple-600 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
                  <span className="text-lg font-bold text-white">S</span>
                </div>
                <div>
                  <h1 className="text-lg font-extrabold tracking-tight text-white leading-none">
                    Story<span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">Reels</span>
                  </h1>
                  <span className="text-[8px] font-mono text-zinc-500 tracking-wider font-bold">STUDIO WORKSPACE</span>
                </div>
              </div>
            </div>

            {/* Sidebar Middle: Library List */}
            <div className="flex-grow overflow-y-auto p-4 flex flex-col gap-3 scrollbar-none">
              <div className="flex justify-between items-center px-1 mb-1">
                <h4 className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">
                  Моя библиотека
                </h4>
                <span className="text-[10px] bg-purple-950/40 text-purple-400 px-2 py-0.5 rounded-full font-mono border border-purple-500/25">
                  {episodes.length}
                </span>
              </div>

              {episodes.length === 0 ? (
                <div className="text-center py-8 text-zinc-600 text-xs">
                  Библиотека пуста
                </div>
              ) : (
                episodes.map((ep) => (
                  <button
                    key={ep.id}
                    onClick={() => {
                      setSelectedEpisode(ep);
                      setActiveSceneIndex(0);
                      setShowChatController(false);
                      setIsPlaying(false);
                    }}
                    className={`flex gap-3 text-left rounded-2xl p-3 transition-all border ${
                      selectedEpisode?.id === ep.id
                        ? "bg-purple-950/20 border-purple-500/40 shadow-[0_0_15px_rgba(168,85,247,0.05)]"
                        : "border-zinc-900/40 bg-zinc-900/10 hover:bg-zinc-900/30 hover:border-zinc-800"
                    }`}
                  >
                    <div className="h-12 w-12 rounded-xl bg-zinc-900 border border-zinc-800 overflow-hidden flex-shrink-0 flex items-center justify-center shadow-inner">
                      {ep.scenes && ep.scenes[0] && ep.scenes[0].imageUrl ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img 
                          src={ep.scenes[0].imageUrl} 
                          alt="" 
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="text-lg">🎞️</span>
                      )}
                    </div>
                    <div className="flex flex-col justify-center overflow-hidden">
                      <h5 className="text-xs font-bold text-white truncate max-w-[170px]">
                        {ep.title}
                      </h5>
                      <span className="text-[9px] text-zinc-500 font-mono mt-1 uppercase tracking-wide">
                        {ep.scenes ? `${ep.scenes.length} кадров` : "0 кадров"}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>

            {/* Sidebar Bottom: Profile */}
            <div className="p-6 border-t border-zinc-900 bg-zinc-900/10 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="h-8.5 w-8.5 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center font-bold text-sm text-purple-400">
                    U
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-white">Пользователь</span>
                    <span className="text-[9px] text-zinc-500 font-mono uppercase">Баланс: {tokenBalance} 🪙</span>
                  </div>
                </div>
                
                <button 
                  onClick={async () => {
                    await supabase.auth.signOut();
                    setIsRegistered(true);
                    setCurrentScreen("player");
                  }}
                  className="text-red-500/80 hover:text-red-400 text-[10px] font-bold uppercase transition-colors p-1.5 cursor-pointer"
                >
                  Выйти
                </button>
              </div>
            </div>
          </aside>

          {/* Main Center Area */}
          <main className="flex-grow flex h-full overflow-hidden bg-black/20">
            
            {/* Center Column: The Active Player */}
            <div className="flex-1 flex flex-col items-center justify-center p-6 border-r border-zinc-900 h-full overflow-y-auto scrollbar-none">
              {selectedEpisode ? (
                <div className="flex flex-col items-center gap-6 w-full max-w-[480px]">
                  
                  {/* Header title */}
                  <div className="text-center w-full">
                    <h2 className="text-base font-black text-white uppercase tracking-wider mb-1">{selectedEpisode.title}</h2>
                    <p className="text-[10px] text-zinc-500 font-mono">кадр {activeSceneIndex + 1} из {selectedEpisode.scenes.length}</p>
                  </div>

                  {/* Vertical Story Player Screen */}
                  <div className="relative w-full aspect-[9/16] max-h-[580px] bg-zinc-950 border border-zinc-800 rounded-3xl overflow-hidden shadow-[0_30px_70px_rgba(0,0,0,0.8)]">
                    {/* Media Content */}
                    <div className="w-full h-full relative" onClick={handlePlayerScreenClick}>
                      {selectedEpisode.scenes[activeSceneIndex] && (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img 
                          src={selectedEpisode.scenes[activeSceneIndex].imageUrl} 
                          alt="" 
                          className="w-full h-full object-cover select-none"
                        />
                      )}

                      {/* Progress bars row at the top */}
                      <div className="absolute top-4 inset-x-3 z-30 flex gap-1 pointer-events-none">
                        {selectedEpisode.scenes.map((_, idx) => {
                          const isWatched = idx < activeSceneIndex;
                          const isCurrent = idx === activeSceneIndex;
                          return (
                            <div key={idx} className="h-1 flex-1 bg-white/20 rounded-full overflow-hidden">
                              <div 
                                className={`h-full transition-all ease-linear ${
                                  isWatched ? "w-full bg-white" : isCurrent ? "bg-white" : "w-0 bg-transparent"
                                }`}
                                style={isCurrent ? { width: `${sceneProgress}%` } : {}}
                              />
                            </div>
                          );
                        })}
                      </div>

                      {/* Play/Pause Overlay indicator */}
                      {!isPlaying && !showChatController && (
                        <div className="absolute inset-0 bg-black/20 z-20 flex items-center justify-center pointer-events-none">
                          <div className="h-14 w-14 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white border border-white/20">
                            <Icons.Play className="w-5 h-5 fill-white text-white translate-x-0.5" />
                          </div>
                        </div>
                      )}

                      {/* Interactive overlay buttons inside player */}
                      <div className="absolute bottom-5 inset-x-4 z-30 flex justify-center items-center pointer-events-auto w-full">
                        {/* CapCut-style Animated Subtitles */}
                        {!showChatController && selectedEpisode.scenes[activeSceneIndex] && (
                          <AnimatedSubtitles
                            text={selectedEpisode.scenes[activeSceneIndex].text}
                            sceneKey={activeSceneIndex}
                            isPlaying={isPlaying}
                          />
                        )}
                      </div>
                    </div>

                    {/* Active Simulation Progress Overlay */}
                    {(isGenerating || currentScreen === "generating") && (
                      <div className="absolute inset-0 bg-black/95 z-40 flex flex-col items-center justify-center p-6 text-center animate-fade-in">
                        <div className="relative mb-4">
                          <div className="h-16 w-16 rounded-full border-[3px] border-purple-500/10 border-t-purple-500 animate-spin"></div>
                          <div className="absolute inset-0 flex items-center justify-center text-xl animate-pulse">🧠</div>
                        </div>
                        <h3 className="text-xs font-bold text-white tracking-wider animate-pulse duration-1000 mb-2">
                          {genStep === "idle" ? loaderText : 
                           genStep === "script" ? "Генерация сюжета..." :
                           genStep === "keyframes" ? "Рендеринг кадров..." :
                           genStep === "voiceover" ? "Синтез озвучки..." : "Сборка серии..."}
                        </h3>
                        <div className="w-36 h-1 bg-zinc-900 rounded-full overflow-hidden relative shadow-[0_0_10px_rgba(0,0,0,0.5)] mb-1">
                          <div 
                            className="h-full bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500 rounded-full shadow-[0_0_15px_#a855f7] transition-all duration-300"
                            style={{ width: `${isGenerating ? generationProgress : simulationProgress}%` }}
                          ></div>
                        </div>
                        <span className="text-[9px] font-mono text-zinc-500 font-bold">{isGenerating ? generationProgress : simulationProgress}%</span>
                      </div>
                    )}

                    {/* Active Paywall Modal Overlay */}
                    {currentScreen === "paywall" && (
                      <div className="absolute inset-0 bg-black/90 backdrop-blur-md z-45 flex items-center justify-center p-4">
                        <div className="bg-zinc-950/80 backdrop-blur-xl border border-zinc-900/80 rounded-3xl p-5 text-center shadow-2xl max-w-[90%] animate-scale-in">
                          <h4 className="text-xs font-black text-white uppercase tracking-wider mb-2">Создание пилотной серии</h4>
                          <p className="text-[10px] text-zinc-500 mb-4 leading-relaxed">
                            Для запуска ИИ-генерации (сценарий, Flux-кадры, озвучка) требуется оплатить 19 ₽.
                          </p>
                          
                          <div className="flex flex-col gap-2">
                            <button 
                              onClick={handlePayActivation}
                              className="w-full py-3 rounded-xl font-black text-[10px] uppercase tracking-wider text-white bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 bg-[size:200%_auto] animate-shimmer shadow-[0_0_15px_rgba(168,85,247,0.4)] hover:scale-[1.01] transition-all cursor-pointer"
                            >
                              Оплатить 19 ₽
                            </button>
                            
                            {/* Dev sandbox bypass */}
                            <button 
                              onClick={() => {
                                setSimulationProgress(100);
                                setCurrentScreen("player");
                                setIsGenerating(true);
                                setLoaderText("Запуск демо-рендеринга...");
                                setTimeout(async () => {
                                  if (createdEpisodeId) {
                                    await resumeGeneration(createdEpisodeId, userId, pendingScenes);
                                  }
                                  setIsGenerating(false);
                                }, 1200);
                              }}
                              className="text-zinc-500 hover:text-zinc-400 text-[8px] tracking-wide font-bold uppercase transition-colors py-1 cursor-pointer"
                            >
                              [ Демо-режим ]
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                  </div>

                  {/* Subtitle bottom banner if not in play */}
                {showChatController && (
                  <div className="w-full bg-purple-950/15 border border-purple-500/20 backdrop-blur-md rounded-2xl p-4 text-center animate-scale-in">
                    <p className="text-purple-300 text-xs font-semibold">
                      Сцена завершилась. Выберите продолжение истории на панели справа.
                    </p>
                  </div>
                )}

              </div>
            ) : (
              /* Empty State view */
              <div className="flex flex-col items-center justify-center max-w-sm text-center gap-6 p-6 bg-zinc-950/20 border border-zinc-900 rounded-3xl backdrop-blur-xl">
                <div className="h-14 w-14 rounded-2xl bg-gradient-to-tr from-purple-600 to-pink-500 flex items-center justify-center border border-purple-400/20 shadow-[0_0_20px_rgba(168,85,247,0.35)]">
                  <Icons.Sparkles className="w-6 h-6 text-white" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">Создайте свой первый сериал</h3>
                  <p className="text-[10px] text-zinc-500 leading-relaxed">
                    Введите любую креативную идею или выберите готовый пресет на панели справа, чтобы начать генерацию.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Generation workspace */}
          <div className="w-96 p-6 flex flex-col gap-6 overflow-y-auto h-full scrollbar-none border-l border-zinc-900 bg-zinc-950/10">
            
            {/* Box 1: Generation Control */}
            <div className="bg-zinc-950/50 border border-zinc-900 rounded-3xl p-5 backdrop-blur-md flex flex-col gap-4">
              <div className="flex items-center gap-2 border-b border-zinc-900 pb-3">
                <Icons.Sparkles className="w-4 h-4 text-purple-400" />
                <h3 className="text-xs font-black text-white uppercase tracking-wider">Генератор серии</h3>
              </div>

              {/* Text Area */}
              <div className="flex flex-col gap-2.5">
                <label className="text-[9px] text-zinc-500 font-mono uppercase tracking-widest">
                  Что произойдет дальше?
                </label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Опишите действие, например: Герой выбивает ржавую дверь плечом и прыгает в темную вентиляционную шахту..."
                  className="w-full h-28 bg-black border border-zinc-800 rounded-xl p-3 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-purple-500 resize-none transition-colors"
                />
              </div>

              {/* Active Choices from parsing if ready */}
              {selectedEpisode && showChatController && (
                <div className="flex flex-col gap-2">
                  <span className="text-[8px] text-purple-400 font-mono uppercase tracking-widest">
                    Варианты на выбор:
                  </span>
                  <div className="flex flex-col gap-1.5">
                    {getActiveChips().map((chipText, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setPrompt(chipText);
                        }}
                        className="text-left bg-purple-950/15 hover:bg-purple-950/30 border border-purple-500/20 text-purple-300 text-xs px-3.5 py-2.5 rounded-xl transition-all cursor-pointer hover:border-purple-500/40"
                      >
                        {chipText}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Generate button */}
              <button
                onClick={() => handleStartGeneration()}
                disabled={isGenerating}
                className="w-full relative overflow-hidden py-3.5 rounded-xl font-black text-xs uppercase tracking-wider text-black bg-white select-none active:scale-[0.98] transition-all duration-300 shadow-[0_0_20px_rgba(255,255,255,0.15)] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
              >
                {isGenerating ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-black border-t-transparent"></div>
                    Создание...
                  </>
                ) : (
                  <>
                    <Icons.Sparkles className="w-3.5 h-3.5" />
                    Запустить рендер
                  </>
                )}
              </button>
            </div>

            {/* Box 2: Preset Inspirations */}
            <div className="bg-zinc-950/50 border border-zinc-900 rounded-3xl p-5 backdrop-blur-md flex flex-col gap-4">
              <h4 className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">
                Готовые идеи и сюжеты
              </h4>
              <div className="grid grid-cols-1 gap-2.5">
                {PRESET_PROMPTS.map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setPrompt(item.prompt);
                    }}
                    className="flex items-center gap-3 text-left p-2.5 rounded-xl bg-zinc-900/30 border border-zinc-900 hover:bg-zinc-900/60 hover:border-zinc-800 transition-all group"
                  >
                    <span className="text-lg group-hover:scale-110 transition-transform">{item.emoji}</span>
                    <div className="flex flex-col">
                      <span className="text-[11px] font-bold text-white">{item.title}</span>
                      <span className="text-[8px] text-zinc-500 font-mono mt-0.5 truncate max-w-[210px]">{item.prompt}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

          </div>
        </main>

        {/* Auth Sheet Overlay for Desktop */}
        {currentScreen === "auth_sheet" && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-6 animate-fade-in">
            <div className="bg-zinc-950/80 backdrop-blur-xl border border-zinc-900 rounded-3xl p-8 max-w-sm w-full text-center shadow-[0_20px_50px_rgba(168,85,247,0.15)] flex flex-col gap-6 animate-scale-in">
              <div className="w-12 h-1 bg-zinc-800 rounded-full mx-auto mb-1"></div>
              <div>
                <h3 className="text-lg font-black text-white tracking-tight mb-1">Куда сохранить сериал?</h3>
                <p className="text-[10px] text-zinc-500 leading-relaxed">
                  Создайте профиль, чтобы сохранять серии, отслеживать прогресс и тратить токены.
                </p>
              </div>

              {/* OAuth / Auth Buttons */}
              <div className="flex flex-col gap-3 relative">
                {authLoading && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60 backdrop-blur-sm rounded-xl">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-purple-500 border-t-transparent"></div>
                  </div>
                )}
                
                <button 
                  onClick={handleTelegramLogin}
                  disabled={authLoading}
                  className="bg-[#2AABEE] hover:bg-[#229ED9] text-white py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-3 transition-all cursor-pointer shadow-lg active:scale-95"
                >
                  Войти через Telegram
                </button>

                <button 
                  onClick={() => handleOAuthLogin("google")}
                  disabled={authLoading}
                  className="bg-white hover:bg-zinc-100 text-black border border-zinc-200 py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-3 transition-all cursor-pointer shadow-md active:scale-95"
                >
                  Войти через Google
                </button>
              </div>

              {/* Email Form */}
              <form onSubmit={handleMagicLink} className="relative mt-2">
                <input 
                  type="email" 
                  placeholder="Или почта для входа" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={authLoading}
                  className="w-full bg-black/60 border border-zinc-800 text-white placeholder-zinc-500 text-[10px] px-3.5 py-3 rounded-xl focus:outline-none focus:border-purple-500 transition-colors"
                />
                <button 
                  type="submit" 
                  disabled={authLoading || !email.includes("@")}
                  className="absolute right-1.5 top-1.5 bottom-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 px-3.5 rounded-lg text-[9px] font-bold text-white transition-colors"
                >
                  Войти
                </button>
              </form>

              <button 
                onClick={() => setCurrentScreen("player")}
                className="text-zinc-500 hover:text-zinc-400 text-xs font-semibold cursor-pointer transition-colors"
              >
                Вернуться в плеер
              </button>
            </div>
          </div>
        )}

      </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes shimmer {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .animate-shimmer {
          background-size: 200% auto;
          animation: shimmer 3s linear infinite;
        }

        @keyframes slide-up {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .animate-slide-up {
          animation: slide-up 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        @keyframes slide-right-panel {
          from { transform: translateX(-100%); }
          to { transform: translateX(0); }
        }
        .animate-slide-right-panel {
          animation: slide-right-panel 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        .scrollbar-none::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-none {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }

        @keyframes scale-in {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        .animate-scale-in {
          animation: scale-in 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}} />
    </div>
  );
}
