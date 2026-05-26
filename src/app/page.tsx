"use client";

import React, { useState, useEffect, useRef } from "react";
import { v4 as uuidv4 } from "uuid";
import { supabase } from "@/lib/supabase-client";
import { ChatEpisode, ChatMessage } from "@/lib/chat-types";

const INITIAL_EPISODES: ChatEpisode[] = [];

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
  
  // Mobile-first navigation: "chats" (list of active chats) or "chat" (messages inside selected chat)
  const [activeMobileView, setActiveMobileView] = useState<"chats" | "chat">("chats");
  
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

      await fetchData(userId);
      
      const updatedRes = await fetch(`/api/episodes?userId=${userId}`);
      const updatedData = await updatedRes.json();
      if (updatedData.episodes && updatedData.episodes.length > 0) {
        const newEp = updatedData.episodes.find((ep: any) => ep.id === data.episodeId);
        if (newEp) {
          setSelectedEpisode(newEp);
          setRevealedIndex(0);
          setActiveMobileView("chat"); // Navigate directly to chat screen
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
    <div className="flex h-screen bg-[#0e1621] text-[#f5f5f5] overflow-hidden select-none antialiased font-sans">
      
      {/* Chats List Panel (Sidebar) */}
      <aside className={`w-full md:w-80 flex-shrink-0 bg-[#17212b] border-r border-[#101921] flex flex-col h-full ${activeMobileView === "chat" ? "hidden md:flex" : "flex"}`}>
        
        {/* Sidebar Header */}
        <div className="p-4 border-b border-[#101921] flex justify-between items-center bg-[#17212b] min-h-[60px]">
          <div className="flex items-center gap-3">
            <button className="text-zinc-400 hover:text-white p-2 min-w-[40px] min-h-[40px] flex items-center justify-center">
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <h1 className="text-md font-bold tracking-tight text-white font-display">
              StoryReels
            </h1>
          </div>
          <span className="text-[10px] bg-[#766ac8]/20 text-[#8774e1] font-bold px-2.5 py-1 rounded-full border border-[#766ac8]/30">
            {tokenBalance} токенов
          </span>
        </div>
        
        {/* Quick Refill */}
        <div className="p-4 bg-[#17212b] border-b border-[#101921]">
          <button 
            onClick={handleAddFreeTokens}
            className="w-full bg-[#766ac8] hover:bg-[#685bb3] text-white text-xs font-semibold py-3 px-4 rounded-lg transition-all duration-150 active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer shadow-md min-h-[44px]"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
            Начислить +5 токенов
          </button>
        </div>

        {/* Generate / Input Box */}
        <div className="p-4 border-b border-[#101921] bg-[#141d26] flex flex-col gap-3">
          <form onSubmit={handleStartGeneration} className="flex flex-col gap-3">
            <textarea 
              placeholder="Введите описание сюжета..." 
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              rows={2}
              className="w-full bg-[#17212b] border border-[#202b36] rounded-xl p-3 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-[#766ac8] transition-all resize-none"
            />

            {/* Presets Grid */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[9px] font-bold text-zinc-500 tracking-wider">ШАБЛОНЫ:</span>
              <div className="grid grid-cols-2 gap-1.5">
                {PRESETS.map((cmd, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setPrompt(cmd.text)}
                    className="text-[10px] bg-[#17212b] hover:bg-[#202b36] text-zinc-400 hover:text-zinc-200 border border-[#202b36] px-2.5 py-2 rounded-lg text-left transition-all truncate cursor-pointer min-h-[38px] flex items-center"
                  >
                    {cmd.label}
                  </button>
                ))}
              </div>
            </div>

            <button 
              disabled={isGenerating || !prompt.trim()}
              className="w-full bg-[#766ac8] hover:bg-[#685bb3] disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg text-xs transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2 min-h-[44px]"
            >
              {isGenerating ? (
                "Создание..."
              ) : (
                "Создать чат (1 токен)"
              )}
            </button>
          </form>
        </div>

        {/* Chats Feed */}
        <div className="flex-1 overflow-y-auto scrollbar-none bg-[#17212b] flex flex-col">
          {episodes.length === 0 ? (
            <div className="text-center py-12 text-xs text-zinc-500">
              Нет активных чатов
            </div>
          ) : (
            episodes.map(ep => {
              const isSelected = selectedEpisode?.id === ep.id;
              const isLocked = ep.unlockedTillIndex < ep.messages.length;
              
              const lastMsgText = ep.messages.length > 0 
                ? ep.messages[ep.messages.length - 1].text 
                : "История создана";

              return (
                <button
                  key={ep.id}
                  onClick={() => {
                    setSelectedEpisode(ep);
                    setRevealedIndex(0);
                    setActiveMobileView("chat"); // Navigate to chat screen on mobile
                  }}
                  className={`w-full text-left px-4 py-3.5 border-b border-[#101921] flex items-center gap-3 transition-all cursor-pointer min-h-[64px] ${
                    isSelected 
                      ? 'bg-[#2b5278] text-white' 
                      : 'hover:bg-[#202b36] text-zinc-300'
                  }`}
                >
                  <div className="w-11 h-11 rounded-full bg-[#766ac8]/80 text-white font-bold flex items-center justify-center text-sm flex-shrink-0 font-display">
                    {ep.title ? ep.title.substring(0, 1).toUpperCase() : "И"}
                  </div>
                  
                  <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs truncate text-white">
                        {ep.title ? ep.title : "Интерактивный чат"}
                      </span>
                      {isLocked && (
                        <svg className="w-3.5 h-3.5 text-[#f43f5e]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                      )}
                    </div>
                    <p className={`text-[11px] truncate ${isSelected ? 'text-zinc-200' : 'text-zinc-400'}`}>
                      {lastMsgText}
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* Main Telegram Chat View */}
      <main className={`flex-1 relative flex flex-col h-full bg-[#0e1621] telegram-bg ${activeMobileView === "chats" ? "hidden md:flex" : "flex"}`} onClick={handleTap}>
        
        {/* Telegram Header */}
        <header className="absolute top-0 inset-x-0 h-14 bg-[#17212b] border-b border-[#101921] z-30 flex items-center justify-between px-4 shadow-sm min-h-[56px]">
          <div className="flex items-center gap-2">
            
            {/* Back Button on Mobile */}
            <button 
              className="md:hidden text-zinc-400 hover:text-white p-2 -ml-2 mr-1 cursor-pointer flex items-center justify-center min-w-[44px] min-h-[44px]" 
              onClick={(e) => { e.stopPropagation(); setActiveMobileView("chats"); }}
            >
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
            </button>
            
            {selectedEpisode ? (
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[#766ac8] flex items-center justify-center font-bold text-xs text-white font-display flex-shrink-0">
                  {interlocutorName.substring(0, 1).toUpperCase()}
                </div>
                <div>
                  <h2 className="text-xs md:text-sm font-bold text-white tracking-wide">
                    {interlocutorName}
                  </h2>
                  <span className="text-[10px] text-[#8774e1] block leading-none mt-0.5">
                    {isTyping ? "печатает..." : "в сети"}
                  </span>
                </div>
              </div>
            ) : (
              <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">
                Выберите диалог
              </h2>
            )}
          </div>

          {/* Action Buttons */}
          {selectedEpisode && (
            <div className="flex items-center gap-2 md:gap-4 text-zinc-400">
              <button className="hover:text-white p-2 min-w-[40px] min-h-[40px] flex items-center justify-center cursor-pointer">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
              </button>
              <button className="hover:text-white p-2 min-w-[40px] min-h-[40px] flex items-center justify-center cursor-pointer">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </button>
              <button className="hover:text-white p-2 min-w-[40px] min-h-[40px] flex items-center justify-center cursor-pointer">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="1" />
                  <circle cx="12" cy="5" r="1" />
                  <circle cx="12" cy="19" r="1" />
                </svg>
              </button>
            </div>
          )}
        </header>

        {/* Telegram Chat Stream */}
        <section 
          ref={chatContainerRef} 
          className="flex-1 overflow-y-auto pt-16 pb-24 px-4 md:px-6 scroll-smooth scrollbar-none flex flex-col"
        >
          {selectedEpisode ? (
            <div className="flex flex-col gap-2 max-w-xl w-full mx-auto mt-auto">
              
              {selectedEpisode.messages.slice(0, revealedIndex + 1).map((msg, idx) => {
                const isMe = msg.sender === "Ты";
                const pseudoTime = `12:${String(10 + idx).padStart(2, '0')}`;
                
                return (
                  <div 
                    key={idx} 
                    className={`flex w-full mb-1 ${isMe ? 'justify-end' : 'justify-start'} animate-message`}
                  >
                    <div 
                      className={`px-3.5 py-2.5 max-w-[85%] md:max-w-[75%] text-[13px] relative flex flex-col leading-relaxed ${
                        isMe 
                          ? 'telegram-bubble-out-violet text-white' 
                          : 'telegram-bubble-in text-[#f5f5f5]'
                      }`}
                    >
                      <span>{msg.text}</span>
                      
                      {/* Floating Timestamp */}
                      <span className="text-[9px] text-zinc-400/80 self-end mt-1 ml-4 select-none float-right h-3.5 leading-none">
                        {pseudoTime}
                      </span>
                    </div>
                  </div>
                );
              })}
              
              {/* Typing indicator */}
              {isTyping && (
                <div className="flex w-full justify-start animate-message mb-1">
                  <div className="telegram-bubble-in px-4 py-3 flex gap-1.5 items-center">
                    <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                    <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="h-full flex-1 flex items-center justify-center text-zinc-500 flex-col gap-4 text-center px-4">
              <div className="w-14 h-14 rounded-2xl bg-[#17212b] border border-[#101921] flex items-center justify-center shadow-lg">
                <svg className="w-6 h-6 text-[#766ac8]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <div className="max-w-xs">
                <h3 className="text-white font-bold text-sm mb-1 font-display">
                  Выберите историю
                </h3>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  Выберите диалог в левой панели для начала переписки.
                </p>
              </div>
            </div>
          )}
        </section>

        {/* Telegram-style Input Overlay for Tap Interaction */}
        {selectedEpisode && !showPaywall && (
          <div className="absolute bottom-4 inset-x-0 max-w-xl mx-auto px-4 z-20" onClick={(e) => { e.stopPropagation(); handleTap(); }}>
            <div className="bg-[#17212b] border border-[#101921] rounded-full p-2 flex items-center gap-3 cursor-pointer shadow-lg active:scale-[0.99] transition-all min-h-[48px]">
              
              {/* Paperclip attachment icon */}
              <button className="text-zinc-400 hover:text-white p-2 min-w-[40px] min-h-[40px] flex items-center justify-center cursor-pointer">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                </svg>
              </button>
              
              {/* Dummy text area */}
              <div className="flex-1 text-xs text-zinc-500 select-none truncate">
                Нажмите для продолжения переписки...
              </div>

              {/* Emoji icon */}
              <button className="text-zinc-400 hover:text-white p-2 min-w-[40px] min-h-[40px] flex items-center justify-center cursor-pointer">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                  <line x1="9" y1="9" x2="9.01" y2="9" />
                  <line x1="15" y1="9" x2="15.01" y2="9" />
                </svg>
              </button>

              {/* Send Button */}
              <button className="w-8 h-8 rounded-full bg-[#766ac8] hover:bg-[#685bb3] text-white flex items-center justify-center cursor-pointer shadow-md flex-shrink-0 min-w-[32px] min-h-[32px]">
                <svg className="w-4 h-4 transform rotate-45 mr-0.5 mt-[-1px]" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M2 21l21-9L2 3v7l15 2-15 2v7z" />
                </svg>
              </button>

            </div>
          </div>
        )}

        {/* Decryption Paywall (Sleek Glassmorphic Modal) */}
        {showPaywall && (
          <div className="absolute inset-0 z-50 flex items-center justify-center p-4">
            
            <div className="absolute inset-0 bg-[#0e1621]/95 backdrop-blur-md transition-all" onClick={(e) => e.stopPropagation()} />
            
            <div className="relative bg-[#17212b] border border-[#202b36] rounded-2xl p-6 max-w-sm w-full text-center shadow-2xl flex flex-col gap-5 animate-modal-enter" onClick={(e) => e.stopPropagation()}>
              
              {/* Lock SVG */}
              <div className="w-12 h-12 bg-[#766ac8] text-white rounded-full flex items-center justify-center mx-auto shadow-md">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </div>
              
              <div>
                <h3 className="text-base font-bold text-white tracking-tight font-display mb-1.5">
                  Разблокировать историю
                </h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Эта история прервалась на самом интересном месте. Получите доступ к продолжению прямо сейчас.
                </p>
              </div>

              {/* Specs */}
              <div className="bg-[#0e1621] rounded-xl border border-[#202b36] p-4 text-left flex flex-col gap-2.5 text-xs text-zinc-300">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-[#8774e1]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Разблокировка всей истории
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-[#8774e1]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Безлимитное время чтения
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-[#8774e1]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Сохранение прогресса
                </div>
              </div>

              {/* Pay button */}
              <button 
                onClick={handlePay} 
                className="w-full bg-[#766ac8] hover:bg-[#685bb3] text-white font-semibold py-3.5 rounded-xl transition-all cursor-pointer text-xs uppercase tracking-wider font-display shadow-md active:scale-[0.98] min-h-[44px]"
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
