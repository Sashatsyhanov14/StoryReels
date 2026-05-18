"use client";

import { createClient } from '@/utils/supabase/client';
import React from 'react';


export default function LandingPage() {
  const supabase = createClient();
  

  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  return (
    <div className="flex flex-col flex-1 bg-zinc-950 text-zinc-100 font-sans selection:bg-purple-600 selection:text-white min-h-screen">
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
              <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold">ИИ-Студия Эпизодов</p>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-12 text-center">
        <div className="max-w-3xl space-y-8">
          <h2 className="text-5xl font-extrabold tracking-tight text-white sm:text-7xl">
            Создавайте <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">шедевры</span> с помощью ИИ
          </h2>
          <p className="text-lg text-zinc-400 max-w-2xl mx-auto">
            StoryReels — это ваша личная студия для генерации персонализированных историй и видео.
            Опишите идею, а наши нейросети напишут сценарий, озвучат персонажей и создадут визуальный ряд.
          </p>

          <div className="pt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={handleGoogleLogin}
              className="group relative flex items-center justify-center gap-3 rounded-2xl bg-white px-8 py-4 text-sm font-bold text-zinc-900 transition-all duration-300 hover:bg-zinc-200 hover:scale-105 active:scale-95 shadow-lg shadow-white/10 w-full sm:w-auto"
            >
              <svg className="h-5 w-5" aria-hidden="true" viewBox="0 0 24 24">
                <path
                  d="M12.0003 4.75C13.7703 4.75 15.3553 5.36 16.6053 6.54998L20.0303 3.125C17.9503 1.19 15.2353 0 12.0003 0C7.31028 0 3.25528 2.69 1.28027 6.60998L5.27028 9.70498C6.21528 6.86 8.87028 4.75 12.0003 4.75Z"
                  fill="#EA4335"
                />
                <path
                  d="M23.49 12.275C23.49 11.49 23.415 10.73 23.3 10H12V14.51H18.47C18.18 15.99 17.34 17.25 16.08 18.1L19.945 21.1C22.2 19.01 23.49 15.92 23.49 12.275Z"
                  fill="#4285F4"
                />
                <path
                  d="M5.26498 14.2949C5.02498 13.5699 4.88501 12.7999 4.88501 11.9999C4.88501 11.1999 5.01998 10.4299 5.26498 9.7049L1.275 6.60986C0.46 8.22986 0 10.0599 0 11.9999C0 13.9399 0.46 15.7699 1.28 17.3899L5.26498 14.2949Z"
                  fill="#FBBC05"
                />
                <path
                  d="M12.0004 24.0001C15.2404 24.0001 17.9654 22.935 19.9454 21.095L16.0804 18.095C15.0054 18.82 13.6204 19.245 12.0004 19.245C8.8704 19.245 6.21538 17.135 5.26538 14.29L1.27539 17.385C3.25539 21.31 7.3104 24.0001 12.0004 24.0001Z"
                  fill="#34A853"
                />
              </svg>
              Войти через Google
            </button>
          </div>
        </div>
      </main>

      <footer className="mt-auto border-t border-zinc-800 bg-zinc-950 py-8 text-center text-xs text-zinc-500">
        <div className="mx-auto max-w-7xl px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© {new Date().getFullYear()} StoryReels. Все права защищены. Работает на Next.js и Supabase.</p>
          <div className="flex gap-4">
            <a href="#" className="hover:text-zinc-300">Политика конфиденциальности</a>
            <a href="#" className="hover:text-zinc-300">Пользовательское соглашение</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
