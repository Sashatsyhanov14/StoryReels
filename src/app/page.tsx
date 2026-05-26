"use client";

import React, { useState, useEffect, useRef } from "react";
import { v4 as uuidv4 } from "uuid";
import { supabase } from "@/lib/supabase-client";
import { ChatEpisode, ChatMessage } from "@/lib/chat-types";

const INITIAL_EPISODES: ChatEpisode[] = [];

// Quick templates for fast prompt generation
const TEMPLATES = [
  { label: "🚪 Запертый подвал", text: "Я очнулся в темном запертом подвале, и на мой телефон приходит странное сообщение..." },
  { label: "📞 Звонок в 3:00", text: "Звонок со скрытого номера посреди ночи. Голос шепчет, что он стоит прямо за моей дверью..." },
  { label: "👁️ Чужой в доме", text: "Я один дома. Родители уехали. Вдруг на умный замок приходит уведомление, что кто-то вошел..." },
  { label: "🤖 Жуткий ИИ", text: "Новый чат-бот с искусственным интеллектом начинает присылать мне фотографии моих окон снаружи..." }
];

export default function Home() {
  const [userId, setUserId] = useState("");
  const [tokenBalance, setTokenBalance] = useState(5);
  const [episodes, setEpisodes] = useState<ChatEpisode[]>(INITIAL_EPISODES);
  const [selectedEpisode, setSelectedEpisode] = useState<ChatEpisode | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Chat mechanics
  const [revealedIndex, setRevealedIndex] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // New episode creation
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    // Auth & Init
    const initAuth = async () => {
      let savedUserId = localStorage.getItem("storyreels_user_id");
      if (!savedUserId || savedUserId.startsWith("usr_")) {
        savedUserId = uuidv4();
        localStorage.setItem("storyreels_user_id", savedUserId);
      }
      setUserId(savedUserId);
      fetchData(savedUserId);
    };
    initAuth();
  }, []);

  const fetchData = async (currentUserId: string) => {
    try {
      // Sync user
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: currentUserId }),
      });
      const data = await response.json();
      if (data.tokenBalance !== undefined) setTokenBalance(data.tokenBalance);

      // Fetch episodes
      const epResponse = await fetch(`/api/episodes?userId=${currentUserId}`);
      const epData = await epResponse.json();
      if (epData.episodes) {
        setEpisodes(epData.episodes);
        if (epData.episodes.length > 0 && !selectedEpisode) {
          setSelectedEpisode(epData.episodes[0]);
          setRevealedIndex(0);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddFreeTokens = async () => {
    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, addTokens: 5 }),
      });
      const data = await response.json();
      if (data.tokenBalance !== undefined) {
        setTokenBalance(data.tokenBalance);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleStartGeneration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isGenerating) return;
    if (tokenBalance < 1) {
      alert("Недостаточно токенов! Используйте кнопку ниже, чтобы добавить токенов для тестирования.");
      return;
    }

    setIsGenerating(true);
    try {
      const response = await fetch("/api/episodes/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, prompt }),
      });

      if (!response.ok) throw new Error("Ошибка генерации истории");

      const data = await response.json();
      setTokenBalance((prev) => Math.max(0, prev - 1));
      setPrompt("");
      setSidebarOpen(false);

      // Reload episodes
      await fetchData(userId);
      
      // Auto-select new episode
      const updatedRes = await fetch(`/api/episodes?userId=${userId}`);
      const updatedData = await updatedRes.json();
      if (updatedData.episodes && updatedData.episodes.length > 0) {
        const newEp = updatedData.episodes.find((ep: any) => ep.id === data.episodeId);
        if (newEp) {
          setSelectedEpisode(newEp);
          setRevealedIndex(0);
        }
      }
    } catch (err) {
      console.error(err);
      alert("Ошибка при создании истории. Возможно, ИИ перегружен.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleTap = () => {
    if (!selectedEpisode || isTyping || showPaywall) return;
    
    const messages = selectedEpisode.messages;
    if (revealedIndex >= messages.length - 1) return; // End of story
    
    // Check Cliffhanger block
    const currentMsg = messages[revealedIndex];
    if (revealedIndex >= selectedEpisode.unlockedTillIndex && currentMsg.isCliffhanger) {
      setShowPaywall(true);
      return;
    }

    const nextMsg = messages[revealedIndex + 1];
    
    if (nextMsg.typingDelayMs > 0) {
      setIsTyping(true);
      scrollToBottom();
      setTimeout(() => {
        setIsTyping(false);
        setRevealedIndex((prev) => prev + 1);
        scrollToBottom();
      }, nextMsg.typingDelayMs);
    } else {
      setRevealedIndex((prev) => prev + 1);
      scrollToBottom();
    }
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      if (chatContainerRef.current) {
        chatContainerRef.current.scrollTo({
          top: chatContainerRef.current.scrollHeight,
          behavior: 'smooth'
        });
      }
    }, 80);
  };

  const handlePay = async () => {
    if (!selectedEpisode) return;
    try {
      const response = await fetch("/api/yookassa/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, episodeId: selectedEpisode.id }),
      });
      const data = await response.json();
      
      if (data.confirmation_url) {
        window.location.href = data.confirmation_url;
      } else {
        // Mock unlock for sandbox
        alert("Режим тестирования: Клиффхэнгер разблокирован бесплатно!");
        setShowPaywall(false);
        
        // Update local episode logic to unlock everything
        setSelectedEpisode({
          ...selectedEpisode,
          unlockedTillIndex: selectedEpisode.messages.length
        });
        
        // Tap to show next automatically
        setTimeout(() => setRevealedIndex(prev => prev + 1), 100);
      }
    } catch (err) {
      console.error("Payment failed", err);
      alert("Ошибка платежа");
    }
  };

  // Helper to extract interlocutor name
  const getInterlocutorName = () => {
    if (!selectedEpisode) return "Собеседник";
    const otherMsg = selectedEpisode.messages.find(m => m.sender !== "Ты");
    return otherMsg ? otherMsg.sender : "Собеседник";
  };

  const interlocutorName = getInterlocutorName();

  return (
    <div className="flex h-screen bg-[#09090b] text-zinc-100 overflow-hidden font-sans select-none antialiased">
      
      {/* Sidebar Panel */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-80 bg-zinc-950/80 backdrop-blur-xl border-r border-zinc-900 transform transition-transform duration-300 md:relative md:translate-x-0 flex flex-col ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        
        {/* Sidebar Header */}
        <div className="p-5 border-b border-zinc-900 flex justify-between items-center bg-zinc-950/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
              <span className="text-white text-base font-black">SR</span>
            </div>
            <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-purple-400 via-pink-400 to-rose-400 bg-clip-text text-transparent">
              StoryReels Chat
            </h1>
          </div>
          <button className="md:hidden text-zinc-400 hover:text-white" onClick={() => setSidebarOpen(false)}>
            ✕
          </button>
        </div>
        
        {/* Token Balance Dashboard Card */}
        <div className="p-5 border-b border-zinc-900 bg-zinc-950/20 flex flex-col gap-3">
          <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-800 p-4 shadow-xl">
            <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/10 rounded-full blur-2xl pointer-events-none" />
            <span className="text-xs text-zinc-500 uppercase tracking-widest font-semibold">Ваш Баланс</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl font-black text-purple-400 tracking-tight">{tokenBalance}</span>
              <span className="text-xs text-zinc-400 font-medium">токенов</span>
            </div>
            <button 
              onClick={handleAddFreeTokens}
              className="mt-3 w-full bg-zinc-800/80 hover:bg-zinc-800 text-xs font-semibold py-2 px-3 rounded-lg border border-zinc-700/60 hover:border-zinc-600 transition-all text-zinc-300 active:scale-[0.98] flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5v14"/>
              </svg> Добавить токенов (Тест)
            </button>
          </div>
        </div>

        {/* Create Story Form */}
        <div className="p-5 border-b border-zinc-900 flex flex-col gap-4">
          <form onSubmit={handleStartGeneration} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Создать историю</label>
              <textarea 
                placeholder="Опишите завязку (например: я заперт в лифте с маньяком...)" 
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                rows={2}
                className="w-full bg-zinc-900/60 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all resize-none"
              />
            </div>

            {/* Prompt Templates */}
            <div className="flex flex-wrap gap-1.5 mt-1">
              {TEMPLATES.map((tmpl, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setPrompt(tmpl.text)}
                  className="text-[11px] bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-800/80 px-2 py-1 rounded-md transition-all cursor-pointer truncate max-w-[125px]"
                >
                  {tmpl.label}
                </button>
              ))}
            </div>

            <button 
              disabled={isGenerating || !prompt.trim()}
              className="mt-2 w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-2.5 rounded-xl text-sm transition-all shadow-lg shadow-purple-950/30 active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
            >
              {isGenerating ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Генерация истории...
                </>
              ) : (
                "Начать историю (1 токен)"
              )}
            </button>
          </form>
        </div>

        {/* Stories List */}
        <div className="flex-1 overflow-y-auto p-4 scrollbar-none flex flex-col gap-2">
          <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider px-2 mb-1">Ваши истории</span>
          {episodes.length === 0 ? (
            <div className="text-center py-8 text-sm text-zinc-600">
              Пока нет созданных историй.
            </div>
          ) : (
            episodes.map(ep => {
              const isSelected = selectedEpisode?.id === ep.id;
              const isLocked = ep.unlockedTillIndex < ep.messages.length;
              // Calculate progress percentage
              const readProgress = ep.messages.length > 0 
                ? Math.min(100, Math.round(((revealedIndex && isSelected ? revealedIndex : 0) / ep.messages.length) * 100))
                : 0;

              return (
                <button
                  key={ep.id}
                  onClick={() => {
                    setSelectedEpisode(ep);
                    setRevealedIndex(0);
                    setSidebarOpen(false);
                  }}
                  className={`relative w-full text-left p-3.5 rounded-xl transition-all border group flex flex-col gap-2 cursor-pointer ${
                    isSelected 
                      ? 'bg-zinc-900 border-zinc-800 shadow-md shadow-black/30 text-white' 
                      : 'bg-transparent border-transparent text-zinc-400 hover:bg-zinc-900/40 hover:text-zinc-200'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 w-full">
                    <span className="font-semibold text-sm truncate flex-1">{ep.title}</span>
                    {isLocked ? (
                      <span className="text-amber-500 text-xs flex items-center" title="Требуется разблокировка">🔒</span>
                    ) : (
                      <span className="text-emerald-500 text-xs flex items-center" title="Полностью открыто">✓</span>
                    )}
                  </div>
                  
                  {/* Progress Indicators */}
                  <div className="flex items-center justify-between text-[11px] text-zinc-500 w-full">
                    <span>{ep.messages.length} реплик</span>
                    {isSelected && <span>Прогресс: {readProgress}%</span>}
                  </div>
                  
                  {/* Linear Progress Bar */}
                  {isSelected && (
                    <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-300"
                        style={{ width: `${readProgress}%` }}
                      />
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className="flex-1 relative flex flex-col bg-[#0b0b0e] h-full" onClick={handleTap}>
        
        {/* Glassmorphic Header */}
        <header className="absolute top-0 inset-x-0 h-16 bg-zinc-950/70 backdrop-blur-xl border-b border-zinc-900/80 z-30 flex items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-3">
            <button 
              className="md:hidden text-zinc-400 hover:text-white p-1 rounded-lg" 
              onClick={(e) => { e.stopPropagation(); setSidebarOpen(true); }}
            >
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="4" x2="20" y1="12" y2="12" />
                <line x1="4" x2="20" y1="6" y2="6" />
                <line x1="4" x2="20" y1="18" y2="18" />
              </svg>
            </button>
            
            {selectedEpisode ? (
              <div className="flex items-center gap-3">
                {/* Status Avatar */}
                <div className="relative w-9 h-9 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center font-bold text-sm text-purple-400 shadow-md">
                  {interlocutorName.substring(0, 1)}
                  {/* Pulsating online dot */}
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-[#0b0b0e] rounded-full animate-pulse-ring" />
                </div>
                <div>
                  <h2 className="text-sm md:text-base font-bold text-zinc-100 leading-tight">{interlocutorName}</h2>
                  <span className="text-[11px] text-emerald-400 font-medium tracking-wide">
                    {isTyping ? "печатает..." : "в сети"}
                  </span>
                </div>
              </div>
            ) : (
              <h2 className="text-base font-bold text-zinc-400">Нет выбранного диалога</h2>
            )}
          </div>
        </header>

        {/* Messages Feed */}
        <section 
          ref={chatContainerRef} 
          className="flex-1 overflow-y-auto pt-24 pb-28 px-4 md:px-6 scroll-smooth scrollbar-none flex flex-col"
        >
          {selectedEpisode ? (
            <div className="flex flex-col gap-4 max-w-2xl w-full mx-auto mt-auto">
              
              {/* Scenario Summary Banner (CoT context) */}
              <div className="mb-6 p-4 rounded-xl bg-zinc-950/40 border border-zinc-900/60 text-xs text-zinc-500 leading-relaxed text-center italic">
                Все события и персонажи являются вымышленными. Нажмите в любой области экрана чата для продвижения по истории.
              </div>

              {selectedEpisode.messages.slice(0, revealedIndex + 1).map((msg, idx) => {
                const isMe = msg.sender === "Ты";
                return (
                  <div 
                    key={idx} 
                    className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} animate-message`}
                  >
                    {!isMe && (
                      <span className="text-[11px] text-zinc-500 font-semibold mb-1 ml-2">
                        {msg.sender}
                      </span>
                    )}
                    <div 
                      className={`relative px-4 py-2.5 rounded-2xl max-w-[85%] text-[14.5px] leading-relaxed shadow-lg ${
                        isMe 
                          ? 'bg-gradient-to-br from-purple-600 to-indigo-600 rounded-tr-sm text-white shadow-purple-950/20' 
                          : 'bg-zinc-900 border border-zinc-800/80 rounded-tl-sm text-zinc-100 shadow-black/20'
                      }`}
                    >
                      {msg.text}
                    </div>
                  </div>
                );
              })}
              
              {/* Dynamic Animated Typing Bubble */}
              {isTyping && (
                <div className="flex items-start mt-1 animate-message">
                  <div className="bg-zinc-900 border border-zinc-800 rounded-2xl rounded-tl-sm px-4 py-3.5 flex gap-1.5 items-center shadow-lg">
                    <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="h-full flex-1 flex items-center justify-center text-zinc-500 flex-col gap-4 text-center">
              <div className="w-20 h-20 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-4xl shadow-xl animate-float-subtle">
                👋
              </div>
              <div className="max-w-xs">
                <h3 className="text-zinc-200 font-bold text-base mb-1">Добро пожаловать в StoryReels Chat!</h3>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  Создайте новую страшную или захватывающую переписку в боковой панели слева, либо выберите одну из готовых.
                </p>
              </div>
            </div>
          )}
        </section>

        {/* Floating Tap Prompt bar */}
        {selectedEpisode && !showPaywall && (
          <div className="absolute bottom-6 inset-x-0 flex justify-center pointer-events-none z-20">
            <div className="bg-zinc-950/80 backdrop-blur-md px-5 py-2.5 rounded-full border border-zinc-800 text-xs font-semibold text-zinc-400 shadow-2xl flex items-center gap-2 animate-float-subtle">
              <span className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-ping" />
              Коснитесь экрана для чтения
            </div>
          </div>
        )}

        {/* Premium Paywall Glassmorphic Overlay */}
        {showPaywall && (
          <div className="absolute inset-0 z-50 flex items-center justify-center p-4">
            
            {/* Dark blurred background block */}
            <div className="absolute inset-0 bg-[#07070a]/70 backdrop-blur-lg transition-all" onClick={(e) => e.stopPropagation()} />
            
            <div className="relative bg-zinc-950/90 border border-zinc-800/80 rounded-2xl p-6 md:p-8 max-w-sm w-full text-center shadow-2xl flex flex-col gap-6 animate-modal-enter" onClick={(e) => e.stopPropagation()}>
              <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
              
              {/* Floating Shield/Lock Logo */}
              <div className="w-16 h-16 bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30 text-purple-400 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-purple-950/20 animate-float-subtle">
                <span className="text-3xl">🔒</span>
              </div>
              
              <div>
                <h3 className="text-xl font-black text-white mb-2 leading-tight tracking-tight">История оборвалась на самом интересном!</h3>
                <p className="text-xs text-zinc-400 leading-relaxed max-w-xs mx-auto">
                  Кульминация близка! Узнайте, выживет ли главный герой и чем закончится этот кошмар.
                </p>
              </div>

              {/* Paywall Benefits list */}
              <div className="bg-zinc-900/50 rounded-xl border border-zinc-800/80 p-3 text-left flex flex-col gap-2">
                <div className="flex items-center gap-2 text-xs text-zinc-300">
                  <span className="text-purple-400 font-bold text-sm">✓</span> Полный доступ к финалу истории
                </div>
                <div className="flex items-center gap-2 text-xs text-zinc-300">
                  <span className="text-purple-400 font-bold text-sm">✓</span> Чтение в интерактивном темпе
                </div>
                <div className="flex items-center gap-2 text-xs text-zinc-300">
                  <span className="text-purple-400 font-bold text-sm">✓</span> Сохранение в библиотеке навсегда
                </div>
              </div>

              {/* Action Button */}
              <button 
                onClick={handlePay} 
                className="w-full bg-gradient-to-r from-purple-600 via-pink-600 to-rose-600 text-white font-bold py-3.5 rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-purple-950/50 cursor-pointer text-sm"
              >
                Разблокировать за 100 ₽
              </button>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
