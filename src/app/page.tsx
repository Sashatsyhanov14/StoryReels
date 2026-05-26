"use client";

import React, { useState, useEffect, useRef } from "react";
import { v4 as uuidv4 } from "uuid";
import { supabase } from "@/lib/supabase-client";
import { ChatEpisode, ChatMessage } from "@/lib/chat-types";

const INITIAL_EPISODES: ChatEpisode[] = [];

// Cyberpunk presets without emojis
const COMMANDS = [
  { label: "SYS.CELLAR_ESCAPE", text: "Я очнулся в темном запертом подвале, и на мой телефон приходит странное сообщение..." },
  { label: "SYS.MIDNIGHT_CALL", text: "Звонок со скрытого номера посреди ночи. Голос шепчет, что он стоит прямо за моей дверью..." },
  { label: "SYS.HOME_INVASION", text: "Я один дома. Родители уехали. Вдруг на умный замок приходит уведомление, что кто-то вошел..." },
  { label: "SYS.ROBOT_STALKER", text: "Новый чат-бот с искусственным интеллектом начинает присылать мне фотографии моих окон снаружи..." }
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
      alert("Недостаточно кредитов! Используйте инжектор токенов для начисления.");
      return;
    }

    setIsGenerating(true);
    try {
      const response = await fetch("/api/episodes/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, prompt }),
      });

      if (!response.ok) throw new Error("Ошибка инициализации канала");

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
      alert("Сбой компиляции скрипта ИИ. Повторите попытку.");
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
        alert("ОТЛАДКА: Канал связи успешно разблокирован!");
        setShowPaywall(false);
        setSelectedEpisode({
          ...selectedEpisode,
          unlockedTillIndex: selectedEpisode.messages.length
        });
        setTimeout(() => setRevealedIndex(prev => prev + 1), 100);
      }
    } catch (err) {
      console.error("Link decryption failed", err);
      alert("Сбой расшифровки канала.");
    }
  };

  const getInterlocutorName = () => {
    if (!selectedEpisode) return "UNKNOWN_TARGET";
    const otherMsg = selectedEpisode.messages.find(m => m.sender !== "Ты");
    return otherMsg ? otherMsg.sender : "TARGET_B";
  };

  const interlocutorName = getInterlocutorName();

  return (
    <div className="flex h-screen bg-[#0f0f23] text-[#e2e8f0] overflow-hidden select-none antialiased font-['Chakra_Petch'] cyber-grid">
      
      {/* Sidebar - Terminal Panel */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-80 bg-[#0c0c1b]/95 backdrop-blur-xl border-r border-[#2d2d5c] transform transition-transform duration-300 md:relative md:translate-x-0 flex flex-col ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        
        {/* Terminal Header */}
        <div className="p-5 border-b border-[#2d2d5c] flex justify-between items-center bg-[#090916]">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-md border-2 border-[#7c3aed] flex items-center justify-center shadow-[0_0_10px_rgba(124,58,237,0.3)] bg-[#1a1a36]">
              <span className="text-[#a78bfa] text-[9px] font-black animate-pulse">■</span>
            </div>
            <h1 className="text-sm font-bold tracking-widest text-[#e2e8f0] font-['Russo_One'] cyber-glow-purple">
              STORYREELS // DECRYPT
            </h1>
          </div>
          <button className="md:hidden text-[#a78bfa] hover:text-white" onClick={() => setSidebarOpen(false)}>
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        
        {/* System Memory (Tokens) */}
        <div className="p-4 border-b border-[#2d2d5c] bg-[#0c0c1e]/40 flex flex-col gap-2.5">
          <div className="rounded-xl border-2 border-[#2d2d5c] bg-[#14142d] p-4 relative overflow-hidden shadow-[inset_0_2px_4px_rgba(0,0,0,0.6)]">
            <div className="absolute top-0 right-0 w-24 h-24 bg-[#7c3aed]/5 rounded-full blur-2xl pointer-events-none" />
            <span className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold block mb-1">
              SYS.MEMORY // CAP
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-[#a78bfa] cyber-glow-purple tracking-wider font-['Russo_One']">
                {tokenBalance}
              </span>
              <span className="text-[10px] text-[#7c3aed] font-bold">CREDITS</span>
            </div>
            <button 
              onClick={handleAddFreeTokens}
              className="mt-3.5 w-full bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-[10px] font-bold py-2.5 px-4 rounded-lg shadow-[0_4px_0_0_#5b21b6] active:translate-y-[2px] active:shadow-[0_2px_0_0_#5b21b6] transition-all flex items-center justify-center gap-1.5 cursor-pointer uppercase tracking-wider"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg> INJECT_CREDITS
            </button>
          </div>
        </div>

        {/* Action Controller (Generation) */}
        <div className="p-4 border-b border-[#2d2d5c] flex flex-col gap-3">
          <form onSubmit={handleStartGeneration} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                INITIATE INTERCEPTION
              </label>
              <textarea 
                placeholder="INPUT SCENARIO PROMPT..." 
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                rows={2}
                className="w-full bg-[#080816] border-2 border-[#2d2d5c] rounded-xl p-2.5 text-xs text-[#a78bfa] placeholder:text-zinc-600 focus:outline-none focus:border-[#7c3aed] transition-all resize-none shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)] font-mono"
              />
            </div>

            {/* Command Tags */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[9px] font-bold text-zinc-500 tracking-wider">PRESETS:</span>
              <div className="grid grid-cols-2 gap-1.5">
                {COMMANDS.map((cmd, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setPrompt(cmd.text)}
                    className="text-[9px] bg-[#121226] hover:bg-[#1a1a36] text-[#a78bfa] hover:text-[#c4b5fd] border border-[#2d2d5c] px-2 py-1.5 rounded-lg text-left transition-all cursor-pointer truncate font-mono active:scale-[0.97]"
                  >
                    &gt; {cmd.label}
                  </button>
                ))}
              </div>
            </div>

            <button 
              disabled={isGenerating || !prompt.trim()}
              className="mt-2 w-full bg-[#f43f5e] hover:bg-[#e11d48] disabled:opacity-40 disabled:cursor-not-allowed border-2 border-[#fb7185] text-white font-bold py-3 rounded-xl text-xs transition-all shadow-[0_4px_0_0_#9f1239] active:translate-y-[2px] active:shadow-[0_2px_0_0_#9f1239] cursor-pointer flex items-center justify-center gap-2 uppercase tracking-wider font-['Russo_One']"
            >
              {isGenerating ? (
                <>
                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  INITIALIZING DIALOGUE...
                </>
              ) : (
                "EXEC_GEN_STREAM"
              )}
            </button>
          </form>
        </div>

        {/* Live Channel Feeds */}
        <div className="flex-1 overflow-y-auto p-4 scrollbar-none flex flex-col gap-2.5">
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider px-1">
            ACTIVE FEED LINKS
          </span>
          {episodes.length === 0 ? (
            <div className="text-center py-8 text-xs text-zinc-600">
              [NO ACTIVE TRANSMISSIONS]
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
                  className={`w-full text-left p-4 rounded-xl border-2 flex flex-col gap-2 transition-all cursor-pointer shadow-[0_2px_4px_rgba(0,0,0,0.1)] active:scale-[0.98] ${
                    isSelected 
                      ? 'bg-[#1a1a36] border-[#7c3aed] text-white shadow-[0_0_12px_rgba(124,58,237,0.15)]' 
                      : 'bg-[#121226]/40 border-[#2d2d5c] text-zinc-400 hover:border-[#4c4c99] hover:text-zinc-200'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 w-full">
                    <span className="font-bold text-xs truncate flex-1 tracking-wide uppercase font-['Russo_One']">
                      {ep.title ? ep.title : "INTERCEPTED_LOG"}
                    </span>
                    {isLocked ? (
                      <span className="text-[#f43f5e] text-[9px] font-bold bg-[#f43f5e]/10 border border-[#f43f5e]/30 px-1.5 py-0.5 rounded uppercase">LOCKED</span>
                    ) : (
                      <span className="text-emerald-500 text-[9px] font-bold bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.5 rounded uppercase">SECURE</span>
                    )}
                  </div>
                  
                  <div className="flex items-center justify-between text-[9px] text-zinc-500 w-full font-mono">
                    <span>INDEX: {ep.messages.length} RES</span>
                    {isSelected && <span>DECRYPTED: {readProgress}%</span>}
                  </div>
                  
                  {isSelected && (
                    <div className="w-full h-1 bg-[#090916] rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-[#7c3aed] to-[#f43f5e] rounded-full transition-all duration-300"
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

      {/* Main Terminal Feed */}
      <main className="flex-1 relative flex flex-col bg-[#09091a] h-full" onClick={handleTap}>
        
        {/* Terminal Header */}
        <header className="absolute top-0 inset-x-0 h-16 bg-[#0c0c1e]/90 backdrop-blur-md border-b-2 border-[#2d2d5c] z-30 flex items-center justify-between px-4 md:px-6 shadow-lg shadow-[#000000]/20">
          <div className="flex items-center gap-3">
            <button 
              className="md:hidden text-[#a78bfa] hover:text-white p-1" 
              onClick={(e) => { e.stopPropagation(); setSidebarOpen(true); }}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="4" x2="20" y1="12" y2="12" />
                <line x1="4" x2="20" y1="6" y2="6" />
                <line x1="4" x2="20" y1="18" y2="18" />
              </svg>
            </button>
            
            {selectedEpisode ? (
              <div className="flex items-center gap-3">
                <div className="relative w-9 h-9 rounded-lg border-2 border-[#7c3aed] flex items-center justify-center font-bold text-xs text-[#a78bfa] bg-[#14142d] shadow-md shadow-[#7c3aed]/10">
                  {interlocutorName.substring(0, 2).toUpperCase()}
                  <span className="absolute bottom-[-1px] right-[-1px] w-2.5 h-2.5 bg-emerald-500 border-2 border-[#09091a] rounded-full animate-pulse-ring" />
                </div>
                <div>
                  <h2 className="text-xs md:text-sm font-bold text-zinc-100 tracking-wider font-['Russo_One'] uppercase">
                    TARGET: {interlocutorName}
                  </h2>
                  <span className="text-[9px] text-emerald-400 tracking-widest font-bold font-mono">
                    {isTyping ? "INCOMING DATASTREAM..." : "LINK_ESTABLISHED"}
                  </span>
                </div>
              </div>
            ) : (
              <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-widest font-['Russo_One']">
                [AWAITING LINK CONNECTION]
              </h2>
            )}
          </div>
          
          {selectedEpisode && (
            <div className="text-[10px] text-[#7c3aed] hidden sm:block tracking-widest font-mono font-bold bg-[#7c3aed]/10 border border-[#7c3aed]/30 px-2 py-0.5 rounded">
              IP_INTERCEPT: 192.168.82.{(revealedIndex * 3) % 255}
            </div>
          )}
        </header>

        {/* Decrypted Messages Stream */}
        <section 
          ref={chatContainerRef} 
          className="flex-1 overflow-y-auto pt-20 pb-24 px-4 md:px-6 scroll-smooth scrollbar-none flex flex-col"
        >
          {selectedEpisode ? (
            <div className="flex flex-col gap-4 max-w-xl w-full mx-auto mt-auto">
              
              {/* Warnings Banner */}
              <div className="mb-4 p-4 rounded-xl border-2 border-red-950/60 bg-red-950/20 text-[10px] text-red-400 font-bold leading-relaxed text-center tracking-wider font-mono">
                WARNING: DECRYPTED DIALOGUES ARE LIVE. REVEAL CHANNEL SEQUENTIALLY BY CLICKING ON DISPLAY.
              </div>

              {selectedEpisode.messages.slice(0, revealedIndex + 1).map((msg, idx) => {
                const isMe = msg.sender === "Ты";
                const pseudoTime = `00:${String(idx).padStart(2, '0')}`;
                
                return (
                  <div 
                    key={idx} 
                    className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} animate-message`}
                  >
                    <span className="text-[9px] text-zinc-500 font-bold mb-1 ml-1 tracking-wider font-mono uppercase">
                      [{isMe ? "USER" : "TARGET"} // {pseudoTime}]
                    </span>
                    <div 
                      className={`px-4 py-3 border-2 text-xs leading-relaxed max-w-[85%] font-medium rounded-xl shadow-lg transition-all duration-300 ${
                        isMe 
                          ? 'bg-[#7c3aed] border-[#a78bfa] text-white rounded-tr-none shadow-[0_4px_12px_rgba(124,58,237,0.25)]' 
                          : 'bg-[#14142d] border-[#2d2d5c] text-zinc-100 rounded-tl-none'
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
                  <span className="text-[9px] text-emerald-500/70 font-bold mb-1 ml-1 tracking-widest font-mono">
                    [DATAPACKET_STREAM...]
                  </span>
                  <div className="bg-[#14142d] border-2 border-emerald-900 px-4 py-3 rounded-xl rounded-tl-none flex gap-2 items-center shadow-lg shadow-emerald-950/10">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
                    <span className="text-[10px] text-emerald-400 font-bold font-mono tracking-wide">DECRYPTING DATASTREAM</span>
                    <span className="text-emerald-400 animate-blink">_</span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="h-full flex-1 flex items-center justify-center text-zinc-500 flex-col gap-4 text-center">
              <div className="w-16 h-16 rounded-xl border-2 border-[#2d2d5c] flex items-center justify-center bg-[#14142d] shadow-xl animate-float-subtle">
                <svg className="w-8 h-8 text-[#7c3aed]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a10 10 0 0 0-10 10c0 5.523 4.477 10 10 10s10-4.477 10-10a10 10 0 0 0-10-10z" />
                  <path d="M12 6v12" />
                  <path d="M8 10h8" />
                </svg>
              </div>
              <div className="max-w-xs">
                <h3 className="text-zinc-300 font-bold text-xs mb-1 uppercase tracking-widest font-['Russo_One']">
                  CONNECTION DISCONNECTED
                </h3>
                <p className="text-[10px] text-zinc-500 leading-relaxed font-mono">
                  Select a live feed from the terminal browser or insert a custom scenario script above.
                </p>
              </div>
            </div>
          )}
        </section>

        {/* Tap Action Helper */}
        {selectedEpisode && !showPaywall && (
          <div className="absolute bottom-5 inset-x-0 flex justify-center pointer-events-none z-20">
            <div className="bg-[#0c0c1e] px-5 py-2.5 rounded-full border-2 border-[#7c3aed]/40 text-[10px] font-bold text-[#a78bfa] shadow-2xl tracking-widest flex items-center gap-2 animate-float-subtle font-mono">
              <span className="w-1.5 h-1.5 bg-[#a78bfa] rounded-full animate-ping" />
              &gt; CLICK_SCREEN_TO_DECRYPT_STREAM
            </div>
          </div>
        )}

        {/* Cyber-Decryption Paywall Overlay */}
        {showPaywall && (
          <div className="absolute inset-0 z-50 flex items-center justify-center p-4">
            
            {/* Blurred blocker */}
            <div className="absolute inset-0 bg-[#060613]/90 backdrop-blur-md transition-all" onClick={(e) => e.stopPropagation()} />
            
            <div className="relative bg-[#14142d] border-2 border-[#f43f5e]/80 rounded-2xl p-6 max-w-sm w-full text-center shadow-2xl flex flex-col gap-6 animate-modal-enter shadow-[#f43f5e]/15" onClick={(e) => e.stopPropagation()}>
              <div className="absolute top-0 right-0 w-24 h-24 bg-[#f43f5e]/5 rounded-full blur-2xl pointer-events-none" />
              
              {/* Shield/Lock SVG */}
              <div className="w-14 h-14 border-2 border-[#f43f5e] text-[#f43f5e] bg-[#f43f5e]/10 rounded-xl flex items-center justify-center mx-auto shadow-lg shadow-[#f43f5e]/20 animate-pulse">
                <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </div>
              
              <div>
                <h3 className="text-sm font-black text-[#f43f5e] uppercase tracking-widest mb-2 font-['Russo_One']">
                  CRITICAL BLOCK // KEY_REQUIRED
                </h3>
                <p className="text-[10px] text-zinc-400 leading-relaxed font-mono">
                  Transmission has hit a CLIFFHANGER block. Decryption key is required to decrypt the terminal final phase.
                </p>
              </div>

              {/* Specs List with custom bullet SVG */}
              <div className="bg-[#090916] rounded-xl border-2 border-[#2d2d5c] p-4 text-left flex flex-col gap-2.5 font-mono text-[10px]">
                <div className="flex items-center gap-2 text-[#fb7185]">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  DECRYPT EPISODE COMPLETELY
                </div>
                <div className="flex items-center gap-2 text-zinc-300">
                  <svg className="w-3.5 h-3.5 text-[#fb7185]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  UNLIMITED READING TIME
                </div>
                <div className="flex items-center gap-2 text-zinc-300">
                  <svg className="w-3.5 h-3.5 text-[#fb7185]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  PERSISTENT LOG CACHE
                </div>
              </div>

              {/* Decrypt button */}
              <button 
                onClick={handlePay} 
                className="w-full bg-[#f43f5e] border-2 border-[#fb7185] hover:bg-[#e11d48] text-white font-bold py-3.5 rounded-xl transition-all cursor-pointer text-xs tracking-wider font-['Russo_One'] shadow-[0_4px_0_0_#9f1239] active:translate-y-[2px] active:shadow-[0_2px_0_0_#9f1239] uppercase"
              >
                GENERATE_DECRYPT_KEY (100 ₽)
              </button>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
