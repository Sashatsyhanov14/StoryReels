"use client";

import React, { useState, useEffect, useRef } from "react";
import { v4 as uuidv4 } from "uuid";
import { supabase } from "@/lib/supabase-client";
import { ChatEpisode, ChatMessage } from "@/lib/chat-types";

const INITIAL_EPISODES: ChatEpisode[] = [];

// High-end minimalist preset templates
const PRESETS = [
  { label: "Запертый подвал", text: "Я очнулся в темном запертом подвале, и на мой телефон приходит странное сообщение..." },
  { label: "Ночной звонок", text: "Звонок со скрытого номера посреди ночи. Голос шепчет, что он стоит прямо за моей дверью..." },
  { label: "Вторжение в дом", text: "Я один дома. Родители уехали. Вдруг на умный замок приходит уведомление, что кто-то вошел..." },
  { label: "Жуткий ИИ", text: "Новый чат-бот с искусственным интеллектом начинает присылать мне фотографии моих окон снаружи..." }
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
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: currentUserId }),
      });
      const data = await response.json();
      if (data.tokenBalance !== undefined) setTokenBalance(data.tokenBalance);

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
      alert("Недостаточно токенов! Используйте кнопку пополнения.");
      return;
    }

    setIsGenerating(true);
    try {
      const response = await fetch("/api/episodes/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, prompt }),
      });

      if (!response.ok) throw new Error("Ошибка создания истории");

      const data = await response.json();
      setTokenBalance((prev) => Math.max(0, prev - 1));
      setPrompt("");
      setSidebarOpen(false);

      await fetchData(userId);
      
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
      alert("Не удалось сгенерировать историю. Попробуйте ещё раз.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleTap = () => {
    if (!selectedEpisode || isTyping || showPaywall) return;
    
    const messages = selectedEpisode.messages;
    if (revealedIndex >= messages.length - 1) return;
    
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
        alert("Оплата прошла успешно! Продолжение разблокировано.");
        setShowPaywall(false);
        setSelectedEpisode({
          ...selectedEpisode,
          unlockedTillIndex: selectedEpisode.messages.length
        });
        setTimeout(() => setRevealedIndex(prev => prev + 1), 100);
      }
    } catch (err) {
      console.error("Payment initiation failed", err);
      alert("Не удалось провести платеж.");
    }
  };

  const getInterlocutorName = () => {
    if (!selectedEpisode) return "Собеседник";
    const otherMsg = selectedEpisode.messages.find(m => m.sender !== "Ты");
    return otherMsg ? otherMsg.sender : "Собеседник";
  };

  const interlocutorName = getInterlocutorName();

  return (
    <div className="flex h-screen bg-[#09090b] text-[#f4f4f5] overflow-hidden select-none antialiased font-sans">
      
      {/* Sidebar - Premium Glass Panel */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-80 bg-zinc-950/60 backdrop-blur-xl border-r border-zinc-900/60 transform transition-transform duration-300 md:relative md:translate-x-0 flex flex-col ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        
        {/* Sidebar Header */}
        <div className="p-6 border-b border-zinc-900/60 flex justify-between items-center bg-zinc-950/40">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/10">
              <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <h1 className="text-base font-bold tracking-tight text-white font-display">
              StoryReels
            </h1>
          </div>
          <button className="md:hidden text-zinc-400 hover:text-white p-1" onClick={() => setSidebarOpen(false)}>
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        
        {/* Token Balance Dashboard */}
        <div className="p-5 border-b border-zinc-900/60 bg-zinc-950/20 flex flex-col">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-violet-600/5 rounded-full blur-2xl pointer-events-none" />
            <span className="text-[10px] text-zinc-400 uppercase tracking-wider font-bold block mb-1">
              Баланс токенов
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-bold text-white tracking-tight font-display">
                {tokenBalance}
              </span>
              <span className="text-[10px] text-violet-400 font-semibold uppercase tracking-wider">историй</span>
            </div>
            <button 
              onClick={handleAddFreeTokens}
              className="mt-3.5 w-full bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 text-xs font-semibold py-2 px-4 rounded-xl transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
            >
              <svg className="w-3.5 h-3.5 text-violet-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
              Пополнить баланс (+5)
            </button>
          </div>
        </div>

        {/* Generate Section */}
        <div className="p-5 border-b border-zinc-900/60 flex flex-col gap-4">
          <form onSubmit={handleStartGeneration} className="flex flex-col gap-3.5">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                Какая история вас интересует?
              </label>
              <textarea 
                placeholder="Опишите сюжет истории..." 
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                rows={2}
                className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl p-3 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-violet-500/80 transition-all resize-none shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)]"
              />
            </div>

            {/* Presets */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[9px] font-bold text-zinc-500 tracking-wider">ПОПУЛЯРНЫЕ ШАБЛОНЫ:</span>
              <div className="flex flex-wrap gap-1.5">
                {PRESETS.map((cmd, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setPrompt(cmd.text)}
                    className="text-[10px] bg-zinc-900/60 hover:bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800/80 px-2.5 py-1.5 rounded-full transition-all cursor-pointer active:scale-[0.96]"
                  >
                    {cmd.label}
                  </button>
                ))}
              </div>
            </div>

            <button 
              disabled={isGenerating || !prompt.trim()}
              className="mt-2 w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl text-xs transition-all shadow-lg active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
            >
              {isGenerating ? (
                <>
                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Создание чата...
                </>
              ) : (
                "Создать историю (1 токен)"
              )}
            </button>
          </form>
        </div>

        {/* Saved Stories */}
        <div className="flex-1 overflow-y-auto p-5 scrollbar-none flex flex-col gap-3">
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider px-1">
            АКТИВНЫЕ ИСТОРИИ
          </span>
          {episodes.length === 0 ? (
            <div className="text-center py-8 text-xs text-zinc-600">
              Нет активных историй
            </div>
          ) : (
            episodes.map(ep => {
              const isSelected = selectedEpisode?.id === ep.id;
              const isLocked = ep.unlockedTillIndex < ep.messages.length;
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
                  className={`w-full text-left p-4 rounded-2xl border flex flex-col gap-2.5 transition-all cursor-pointer active:scale-[0.98] ${
                    isSelected 
                      ? 'bg-zinc-900 border-zinc-800 text-white shadow-md' 
                      : 'bg-transparent border-zinc-900/30 text-zinc-400 hover:border-zinc-800 hover:text-zinc-200'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 w-full">
                    <span className="font-bold text-xs truncate flex-1 tracking-wide font-display">
                      {ep.title ? ep.title : "Интерактивный чат"}
                    </span>
                    {isLocked ? (
                      <span className="text-violet-400 text-[9px] font-bold bg-violet-400/10 border border-violet-400/20 px-2 py-0.5 rounded-full uppercase tracking-wider">Premium</span>
                    ) : (
                      <span className="text-emerald-500 text-[9px] font-bold bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full uppercase tracking-wider">Secure</span>
                    )}
                  </div>
                  
                  <div className="flex items-center justify-between text-[9px] text-zinc-500 w-full">
                    <span>Сообщений: {ep.messages.length}</span>
                    {isSelected && <span>Прогресс: {readProgress}%</span>}
                  </div>
                  
                  {isSelected && (
                    <div className="w-full h-1 bg-zinc-950 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-violet-600 to-indigo-500 rounded-full transition-all duration-300"
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

      {/* Main chat window */}
      <main className="flex-1 relative flex flex-col bg-zinc-950 h-full" onClick={handleTap}>
        
        {/* Header */}
        <header className="absolute top-0 inset-x-0 h-16 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-900/60 z-30 flex items-center justify-between px-6 shadow-sm">
          <div className="flex items-center gap-3">
            <button 
              className="md:hidden text-zinc-400 hover:text-white p-1" 
              onClick={(e) => { e.stopPropagation(); setSidebarOpen(true); }}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="4" x2="20" y1="12" y2="12" />
                <line x1="4" x2="20" y1="6" y2="6" />
                <line x1="4" x2="20" y1="18" y2="18" />
              </svg>
            </button>
            
            {selectedEpisode ? (
              <div className="flex items-center gap-3">
                <div className="relative w-8 h-8 rounded-full bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center font-bold text-xs text-white shadow-md shadow-violet-500/10 font-display">
                  {interlocutorName.substring(0, 1).toUpperCase()}
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-zinc-950 rounded-full animate-pulse-ring" />
                </div>
                <div>
                  <h2 className="text-xs md:text-sm font-bold text-white tracking-wide">
                    {interlocutorName}
                  </h2>
                  <span className="text-[9px] text-zinc-500 tracking-wider">
                    {isTyping ? "Печатает..." : "В сети"}
                  </span>
                </div>
              </div>
            ) : (
              <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">
                Выберите диалог
              </h2>
            )}
          </div>
        </header>

        {/* Chat Messages */}
        <section 
          ref={chatContainerRef} 
          className="flex-1 overflow-y-auto pt-20 pb-24 px-4 md:px-6 scroll-smooth scrollbar-none flex flex-col"
        >
          {selectedEpisode ? (
            <div className="flex flex-col gap-4 max-w-xl w-full mx-auto mt-auto">
              
              {selectedEpisode.messages.slice(0, revealedIndex + 1).map((msg, idx) => {
                const isMe = msg.sender === "Ты";
                
                return (
                  <div 
                    key={idx} 
                    className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} animate-message`}
                  >
                    <div 
                      className={`px-4.5 py-3 text-[13px] leading-relaxed max-w-[80%] rounded-2xl shadow-sm transition-all duration-200 ${
                        isMe 
                          ? 'bg-gradient-to-tr from-violet-600 to-indigo-600 text-white rounded-tr-sm shadow-violet-950/10' 
                          : 'bg-zinc-900/80 border border-zinc-800/40 text-zinc-100 rounded-tl-sm'
                      }`}
                    >
                      {msg.text}
                    </div>
                  </div>
                );
              })}
              
              {/* Typing indicator */}
              {isTyping && (
                <div className="flex flex-col items-start animate-message">
                  <div className="bg-zinc-900/60 border border-zinc-800/40 px-4 py-3 rounded-2xl rounded-tl-sm flex gap-1.5 items-center shadow-sm">
                    <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                    <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="h-full flex-1 flex items-center justify-center text-zinc-500 flex-col gap-4 text-center">
              <div className="w-14 h-14 rounded-2xl border border-zinc-800 flex items-center justify-center bg-zinc-900/40 shadow-lg animate-float-subtle">
                <svg className="w-6 h-6 text-violet-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <div className="max-w-xs">
                <h3 className="text-zinc-300 font-bold text-sm mb-1 uppercase tracking-wider font-display">
                  Диалог не выбран
                </h3>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  Выберите историю в боковой панели или создайте новую с помощью искусственного интеллекта.
                </p>
              </div>
            </div>
          )}
        </section>

        {/* Tap Helper */}
        {selectedEpisode && !showPaywall && (
          <div className="absolute bottom-6 inset-x-0 flex justify-center pointer-events-none z-20">
            <div className="bg-zinc-900/90 backdrop-blur-sm px-5 py-2.5 rounded-full border border-zinc-800 text-[11px] font-semibold text-zinc-300 shadow-2xl tracking-wide flex items-center gap-2 animate-float-subtle">
              <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-ping" />
              Нажмите на экран для продолжения
            </div>
          </div>
        )}

        {/* Paywall Overlay */}
        {showPaywall && (
          <div className="absolute inset-0 z-50 flex items-center justify-center p-4">
            
            {/* Blurred backdrop */}
            <div className="absolute inset-0 bg-zinc-950/80 backdrop-blur-md transition-all" onClick={(e) => e.stopPropagation()} />
            
            <div className="relative bg-zinc-900 border border-zinc-800/80 rounded-3xl p-7 max-w-sm w-full text-center shadow-2xl flex flex-col gap-6 animate-modal-enter" onClick={(e) => e.stopPropagation()}>
              <div className="absolute top-0 right-0 w-24 h-24 bg-violet-600/5 rounded-full blur-2xl pointer-events-none" />
              
              {/* Lock SVG */}
              <div className="w-12 h-12 bg-gradient-to-tr from-violet-600 to-indigo-600 text-white rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-violet-500/10">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </div>
              
              <div>
                <h3 className="text-base font-bold text-white tracking-tight font-display mb-1.5">
                  Разблокировать продолжение
                </h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  История прервалась на самом интересном месте. Разблокируйте её прямо сейчас, чтобы узнать финал.
                </p>
              </div>

              {/* Specs */}
              <div className="bg-zinc-950 rounded-2xl border border-zinc-800/80 p-4 text-left flex flex-col gap-2.5 text-xs text-zinc-300">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-violet-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Разблокировка всей истории
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-violet-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Безлимитное время чтения
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-violet-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Сохранение прогресса
                </div>
              </div>

              {/* Pay button */}
              <button 
                onClick={handlePay} 
                className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold py-3.5 rounded-xl transition-all cursor-pointer text-xs uppercase tracking-wider font-display shadow-lg shadow-violet-500/10 active:scale-[0.98]"
              >
                Разблокировать историю за 100 ₽
              </button>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
