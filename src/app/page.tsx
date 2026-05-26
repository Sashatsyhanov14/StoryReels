"use client";

import React, { useState, useEffect, useRef } from "react";
import { v4 as uuidv4 } from "uuid";
import { supabase } from "@/lib/supabase-client";
import { ChatEpisode, ChatMessage } from "@/lib/chat-types";
import { Icons } from "@/components/icons";

const INITIAL_EPISODES: ChatEpisode[] = [];

export default function Home() {
  const [userId, setUserId] = useState("");
  const [tokenBalance, setTokenBalance] = useState(5);
  const [episodes, setEpisodes] = useState<ChatEpisode[]>(INITIAL_EPISODES);
  const [selectedEpisode, setSelectedEpisode] = useState<ChatEpisode | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isRegistered, setIsRegistered] = useState(true);

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

  const handleStartGeneration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isGenerating) return;
    if (tokenBalance < 1) {
      alert("Недостаточно токенов!");
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
      alert("Ошибка при создании истории.");
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
      chatContainerRef.current?.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }, 50);
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
        alert("Оплата прошла успешно! (Песочница)");
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

  return (
    <div className="flex h-screen bg-zinc-950 text-white overflow-hidden font-sans select-none">
      
      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-40 w-72 bg-zinc-900/90 backdrop-blur-md transform transition-transform duration-300 md:relative md:translate-x-0 border-r border-zinc-800 flex flex-col ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-4 border-b border-zinc-800 flex justify-between items-center">
          <h1 className="text-xl font-bold bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">
            StoryReels Chat
          </h1>
          <button className="md:hidden text-zinc-400" onClick={() => setSidebarOpen(false)}>
            ✕
          </button>
        </div>
        
        <div className="p-4 flex flex-col gap-2 border-b border-zinc-800 bg-zinc-900/50">
          <p className="text-sm text-zinc-400">Токенов: <span className="text-purple-400 font-bold">{tokenBalance}</span></p>
          <form onSubmit={handleStartGeneration} className="flex flex-col gap-2">
            <input 
              type="text" 
              placeholder="О чем история?" 
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
            />
            <button 
              disabled={isGenerating || !prompt.trim()}
              className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-medium py-2 rounded-lg text-sm transition-colors"
            >
              {isGenerating ? "Генерация..." : "Создать (1 токен)"}
            </button>
          </form>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {episodes.map(ep => (
            <button
              key={ep.id}
              onClick={() => {
                setSelectedEpisode(ep);
                setRevealedIndex(0);
                setSidebarOpen(false);
              }}
              className={`w-full text-left p-3 rounded-lg mb-1 truncate text-sm transition-colors ${selectedEpisode?.id === ep.id ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:bg-zinc-800/50'}`}
            >
              {ep.title}
            </button>
          ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 relative flex flex-col bg-zinc-950 h-full" onClick={handleTap}>
        
        {/* Header */}
        <div className="absolute top-0 inset-x-0 h-16 bg-zinc-900/80 backdrop-blur-lg border-b border-zinc-800 z-10 flex items-center px-4">
          <button className="md:hidden mr-4 text-zinc-400" onClick={(e) => { e.stopPropagation(); setSidebarOpen(true); }}>
            <Icons.List className="w-6 h-6" />
          </button>
          <h2 className="text-lg font-medium text-zinc-100">{selectedEpisode?.title || "Выберите историю"}</h2>
        </div>

        {/* Messages */}
        <div ref={chatContainerRef} className="flex-1 overflow-y-auto pt-24 pb-32 px-4 scroll-smooth">
          {selectedEpisode ? (
            <div className="flex flex-col gap-4 max-w-2xl mx-auto">
              {selectedEpisode.messages.slice(0, revealedIndex + 1).map((msg, idx) => {
                const isMe = msg.sender === "Ты";
                return (
                  <div key={idx} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[85%]`}>
                    {!isMe && <span className="text-xs text-zinc-500 ml-2 mb-1">{msg.sender}</span>}
                    <div className={`px-4 py-2.5 rounded-2xl text-[15px] shadow-sm leading-relaxed ${isMe ? 'bg-purple-600 rounded-tr-sm text-white' : 'bg-zinc-800 rounded-tl-sm text-zinc-100'}`}>
                      {msg.text}
                    </div>
                  </div>
                );
              })}
              
              {isTyping && (
                <div className="flex items-start max-w-[85%] mt-2">
                  <div className="bg-zinc-800 rounded-2xl rounded-tl-sm px-4 py-3 flex gap-1 items-center h-10">
                    <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-zinc-500 flex-col gap-4">
              <span className="text-4xl">👋</span>
              <p>Выберите историю слева или создайте новую</p>
            </div>
          )}
        </div>

        {/* Tap Helper */}
        {selectedEpisode && !showPaywall && (
          <div className="absolute bottom-6 inset-x-0 flex justify-center pointer-events-none">
            <div className="bg-black/50 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 text-xs font-medium text-white/50 animate-pulse">
              Нажмите для продолжения
            </div>
          </div>
        )}

        {/* Paywall Overlay */}
        {showPaywall && (
          <div className="absolute inset-0 z-50 flex items-center justify-center p-4">
            {/* Blurred background intercepting taps */}
            <div className="absolute inset-0 bg-zinc-950/60 backdrop-blur-md" onClick={(e) => e.stopPropagation()} />
            
            <div className="relative bg-zinc-900 border border-zinc-800 rounded-2xl p-6 md:p-8 max-w-sm w-full text-center shadow-2xl flex flex-col gap-6" onClick={(e) => e.stopPropagation()}>
              <div className="w-16 h-16 bg-purple-500/20 text-purple-400 rounded-full flex items-center justify-center mx-auto mb-2">
                <span className="text-3xl">🔒</span>
              </div>
              <div>
                <h3 className="text-xl font-bold text-white mb-2">История обрывается на самом интересном!</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">
                  Кульминация уже близко. Узнайте развязку сюжета прямо сейчас.
                </p>
              </div>
              <button onClick={handlePay} className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold py-3.5 rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-transform shadow-lg shadow-purple-500/25">
                Разблокировать за 100 ₽
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
