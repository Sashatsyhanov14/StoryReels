"use client";

import React, { useState, useEffect, useRef } from "react";
import { v4 as uuidv4 } from "uuid";
import { supabase } from "@/lib/supabase-client";
import { ChatEpisode, ChatMessage } from "@/lib/chat-types";

const INITIAL_EPISODES: ChatEpisode[] = [];

// Cyberpunk command templates
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
      alert("Недостаточно кредитов! Используйте терминал отладки для начисления.");
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
    <div className="flex h-screen bg-[#030306] text-zinc-300 overflow-hidden font-mono select-none antialiased cyber-grid">
      
      {/* Sidebar - Terminal Panel */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-80 bg-[#06060c]/95 backdrop-blur-xl border-r border-[#1a1a2e] transform transition-transform duration-300 md:relative md:translate-x-0 flex flex-col ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        
        {/* Terminal Header */}
        <div className="p-5 border-b border-[#1a1a2e] flex justify-between items-center bg-[#080812]">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded border border-purple-500/50 flex items-center justify-center shadow-lg shadow-purple-500/20">
              <span className="text-purple-400 text-xs font-black animate-pulse">■</span>
            </div>
            <h1 className="text-sm font-bold tracking-widest text-zinc-100 cyber-glow-purple">
              STORYREELS // DECRYPT
            </h1>
          </div>
          <button className="md:hidden text-purple-400 hover:text-white" onClick={() => setSidebarOpen(false)}>
            [ESC]
          </button>
        </div>
        
        {/* System Memory (Tokens) */}
        <div className="p-4 border-b border-[#1a1a2e] bg-[#070710]/40 flex flex-col gap-2.5">
          <div className="rounded-lg border border-[#26264d] bg-[#080814] p-4 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 bg-purple-500/5 rounded-full blur-xl" />
            <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold block mb-1">
              SYS.MEMORY // CAP
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-purple-400 cyber-glow-purple tracking-wider">
                {tokenBalance}
              </span>
              <span className="text-[10px] text-purple-500/70 font-semibold font-mono">CREDITS</span>
            </div>
            <button 
              onClick={handleAddFreeTokens}
              className="mt-3.5 w-full bg-[#121226]/80 hover:bg-[#1a1a36] text-[10px] font-bold py-2 px-3 rounded border border-purple-900/60 hover:border-purple-500/40 text-purple-300 transition-all active:scale-[0.98] flex items-center justify-center gap-1.5 cursor-pointer"
            >
              ⚡ INJECT_SYS_CREDITS (+5)
            </button>
          </div>
        </div>

        {/* Action Controller (Generation) */}
        <div className="p-4 border-b border-[#1a1a2e] flex flex-col gap-3">
          <form onSubmit={handleStartGeneration} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                INITIATE INTERCEPTION
              </label>
              <textarea 
                placeholder="INPUT SCENARIO PROMPT..." 
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                rows={2}
                className="w-full bg-[#040409] border border-[#1a1a38] rounded p-2.5 text-xs text-purple-400 placeholder:text-zinc-700 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20 transition-all resize-none font-mono"
              />
            </div>

            {/* Command Tags */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[9px] font-bold text-zinc-600 tracking-wider">PRESETS:</span>
              <div className="grid grid-cols-2 gap-1">
                {COMMANDS.map((cmd, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setPrompt(cmd.text)}
                    className="text-[9px] bg-[#070714] hover:bg-[#12122b] text-purple-400/80 hover:text-purple-300 border border-[#1c1c38]/50 px-2 py-1 rounded text-left transition-all cursor-pointer truncate"
                  >
                    &gt; {cmd.label}
                  </button>
                ))}
              </div>
            </div>

            <button 
              disabled={isGenerating || !prompt.trim()}
              className="mt-2 w-full bg-purple-900/40 hover:bg-purple-800/60 disabled:opacity-30 disabled:cursor-not-allowed border border-purple-500/50 text-purple-300 font-bold py-2.5 rounded text-xs transition-all shadow-md active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
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
                "EXEC_GEN_STREAM (1 CRED)"
              )}
            </button>
          </form>
        </div>

        {/* Live Channel Feeds */}
        <div className="flex-1 overflow-y-auto p-4 scrollbar-none flex flex-col gap-2">
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider px-1">
            ACTIVE FEED LINKS
          </span>
          {episodes.length === 0 ? (
            <div className="text-center py-8 text-xs text-zinc-700">
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
                  className={`w-full text-left p-3 rounded border flex flex-col gap-1.5 transition-all cursor-pointer ${
                    isSelected 
                      ? 'bg-[#0f0f1f] border-purple-500/50 text-white' 
                      : 'bg-transparent border-[#141426] text-zinc-500 hover:border-[#1a1a3c]/80 hover:text-zinc-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 w-full">
                    <span className="font-bold text-xs truncate flex-1 tracking-wide">
                      {ep.title ? ep.title.toUpperCase() : "INTERCEPTED_LOG"}
                    </span>
                    {isLocked ? (
                      <span className="text-amber-500 text-[10px] font-bold">LOCKED</span>
                    ) : (
                      <span className="text-emerald-500 text-[10px] font-bold">SECURE</span>
                    )}
                  </div>
                  
                  <div className="flex items-center justify-between text-[9px] text-zinc-500 w-full font-mono">
                    <span>INDEX: {ep.messages.length} RES</span>
                    {isSelected && <span>DECRYPTED: {readProgress}%</span>}
                  </div>
                  
                  {isSelected && (
                    <div className="w-full h-[2px] bg-[#1a1a36] rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-purple-500 to-emerald-500 transition-all duration-300"
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
      <main className="flex-1 relative flex flex-col bg-[#040408] h-full" onClick={handleTap}>
        
        {/* Terminal Header */}
        <header className="absolute top-0 inset-x-0 h-16 bg-[#06060c]/90 backdrop-blur-md border-b border-[#1a1a2e] z-30 flex items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-3">
            <button 
              className="md:hidden text-purple-400 hover:text-white p-1" 
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
                <div className="relative w-8 h-8 rounded border border-purple-500/50 flex items-center justify-center font-bold text-xs text-purple-400 bg-[#0c0c1b]">
                  {interlocutorName.substring(0, 2).toUpperCase()}
                  <span className="absolute bottom-0 right-0 w-2 h-2 bg-emerald-500 border border-[#040408] rounded-full animate-pulse-ring" />
                </div>
                <div>
                  <h2 className="text-xs md:text-sm font-bold text-zinc-100 tracking-wider">
                    TARGET: {interlocutorName.toUpperCase()}
                  </h2>
                  <span className="text-[9px] text-emerald-400 tracking-widest font-bold">
                    {isTyping ? "INCOMING DATASTREAM..." : "LINK_ESTABLISHED"}
                  </span>
                </div>
              </div>
            ) : (
              <h2 className="text-xs font-bold text-zinc-600 uppercase tracking-widest">
                [AWAITING LINK CONNECTION]
              </h2>
            )}
          </div>
          
          {selectedEpisode && (
            <div className="text-[10px] text-purple-500/70 hidden sm:block tracking-widest font-mono">
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
              
              {/* Warnings */}
              <div className="mb-4 p-3 rounded border border-red-950 bg-red-950/20 text-[10px] text-red-400/80 leading-relaxed text-center tracking-wider">
                WARNING: DECRYPTED DIALOGUES ARE LIVE. REVEAL CHANNEL SEQUENTIALLY BY CLICKING ON DISPLAY.
              </div>

              {selectedEpisode.messages.slice(0, revealedIndex + 1).map((msg, idx) => {
                const isMe = msg.sender === "Ты";
                // Format pseudo timestamps based on indexes
                const pseudoTime = `00:${String(idx).padStart(2, '0')}`;
                
                return (
                  <div 
                    key={idx} 
                    className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} animate-message`}
                  >
                    <span className="text-[9px] text-zinc-600 font-semibold mb-1 ml-1 tracking-wider">
                      [{isMe ? "USER" : "TARGET"} // {pseudoTime}]
                    </span>
                    <div 
                      className={`px-3.5 py-2 border text-xs leading-relaxed max-w-[85%] ${
                        isMe 
                          ? 'bg-[#0f0714] border-purple-500/50 text-purple-300 rounded-lg rounded-tr-none' 
                          : 'bg-[#06060c] border-[#1c1c3c] text-zinc-200 rounded-lg rounded-tl-none'
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
                  <span className="text-[9px] text-emerald-500/70 font-semibold mb-1 ml-1 tracking-widest">
                    [DATAPACKET_STREAM...]
                  </span>
                  <div className="bg-[#05050b] border border-emerald-950 px-3.5 py-2.5 rounded-lg rounded-tl-none flex gap-1 items-center">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
                    <span className="text-[10px] text-emerald-400 font-bold ml-1">DECRYPTING DATASTREAM</span>
                    <span className="text-emerald-400 animate-blink">_</span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="h-full flex-1 flex items-center justify-center text-zinc-600 flex-col gap-3 text-center">
              <div className="w-12 h-12 rounded border border-[#1a1a2e] flex items-center justify-center text-xl shadow-lg animate-float-subtle">
                📡
              </div>
              <div className="max-w-xs">
                <h3 className="text-zinc-400 font-bold text-xs mb-1 uppercase tracking-widest">
                  CONNECTION DISCONNECTED
                </h3>
                <p className="text-[10px] text-zinc-600 leading-relaxed font-mono">
                  Select a live feed from the terminal browser or insert a custom scenario script above.
                </p>
              </div>
            </div>
          )}
        </section>

        {/* Tap Action Helper */}
        {selectedEpisode && !showPaywall && (
          <div className="absolute bottom-5 inset-x-0 flex justify-center pointer-events-none z-20">
            <div className="bg-[#070712]/90 px-4 py-2 rounded border border-purple-500/30 text-[10px] font-bold text-purple-400 shadow-2xl tracking-widest flex items-center gap-2 animate-float-subtle">
              <span className="w-1 h-1 bg-purple-500 rounded-full animate-ping" />
              &gt; CLICK_SCREEN_TO_DECRYPT_STREAM
            </div>
          </div>
        )}

        {/* Cyber-Decryption Paywall Overlay */}
        {showPaywall && (
          <div className="absolute inset-0 z-50 flex items-center justify-center p-4">
            
            {/* Blurred blocker */}
            <div className="absolute inset-0 bg-[#020204]/90 backdrop-blur-md transition-all" onClick={(e) => e.stopPropagation()} />
            
            <div className="relative bg-[#070710] border-2 border-red-900/60 rounded p-6 max-w-sm w-full text-center shadow-2xl flex flex-col gap-5 animate-modal-enter" onClick={(e) => e.stopPropagation()}>
              <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/5 rounded-full blur-2xl pointer-events-none" />
              
              {/* Shield/Lock */}
              <div className="w-12 h-12 border border-red-500/40 text-red-500 bg-red-950/20 rounded flex items-center justify-center mx-auto shadow-md animate-pulse">
                <span className="text-lg">🔒</span>
              </div>
              
              <div>
                <h3 className="text-sm font-black text-red-400 uppercase tracking-widest mb-1.5">
                  CRITICAL BLOCK // KEY_REQUIRED
                </h3>
                <p className="text-[10px] text-zinc-500 leading-relaxed font-mono">
                  Transmission has hit a CLIFFHANGER block. Decryption key is required to decrypt the terminal final phase.
                </p>
              </div>

              {/* Specs */}
              <div className="bg-[#0b0404] rounded border border-red-950/80 p-3 text-left flex flex-col gap-1.5 font-mono text-[9px]">
                <div className="flex items-center gap-2 text-red-400/80">
                  <span>[+]</span> DECRYPT EPISODE COMPLETELY
                </div>
                <div className="flex items-center gap-2 text-zinc-400">
                  <span>[+]</span> UNLIMITED READING TIME
                </div>
                <div className="flex items-center gap-2 text-zinc-400">
                  <span>[+]</span> PERSISTENT LOG CACHE
                </div>
              </div>

              {/* Decrypt button */}
              <button 
                onClick={handlePay} 
                className="w-full bg-red-950/40 border border-red-500/50 hover:bg-red-900/30 text-red-400 font-bold py-3 rounded hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer text-xs tracking-wider font-mono"
              >
                GENERATE_DECRYPT_KEY_YKM (100 ₽)
              </button>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
