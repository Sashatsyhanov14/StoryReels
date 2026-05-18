# Руководство по деплою проекта StoryReels

Проект StoryReels построен на стеке: **Next.js (App Router) + Supabase + ЮKassa**. Ниже приведена пошаговая инструкция для развертывания проекта на прод.

---

## Шаг 1. Развертывание Базы Данных (Supabase)

1. Войдите в ваш аккаунт [Supabase](https://supabase.com/) и создайте новый проект.
2. После создания проекта перейдите во вкладку **SQL Editor** в левом меню.
3. Нажмите **New query**, скопируйте и выполните содержимое файла `supabase/schema.sql`:
   ```sql
   -- Create Users Table
   CREATE TABLE public.users (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     auth_id TEXT UNIQUE,
     token_balance INTEGER NOT NULL DEFAULT 0,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
   );

   -- Create Episodes Table
   CREATE TYPE episode_status AS ENUM ('pending', 'ready', 'failed');

   CREATE TABLE public.episodes (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
     status episode_status NOT NULL DEFAULT 'pending',
     assets_json JSONB DEFAULT '[]'::jsonb,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
   );

   -- Create Transactions Table
   CREATE TYPE transaction_status AS ENUM ('success', 'canceled');

   CREATE TABLE public.transactions (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
     amount_rub NUMERIC NOT NULL,
     status transaction_status NOT NULL,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
   );

   -- Enable RLS
   ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
   ALTER TABLE public.episodes ENABLE ROW LEVEL SECURITY;
   ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

   -- Create Policies
   CREATE POLICY "Users can view own data" ON public.users FOR SELECT USING (auth.uid()::text = auth_id);
   CREATE POLICY "Users can view own episodes" ON public.episodes FOR SELECT USING (auth.uid() IN (SELECT auth_id::uuid FROM public.users WHERE id = user_id));
   CREATE POLICY "Users can view own transactions" ON public.transactions FOR SELECT USING (auth.uid() IN (SELECT auth_id::uuid FROM public.users WHERE id = user_id));
   ```
4. Перейдите в **Project Settings -> API** и скопируйте:
   - **Project URL** (это будет `NEXT_PUBLIC_SUPABASE_URL`)
   - **service_role API Key** (это будет `SUPABASE_SERVICE_ROLE_KEY`). *Внимание: никогда не публикуйте этот ключ публично, так как он обходит RLS и имеет полные права администратора.*

---

## Шаг 2. Настройка платежной системы ЮKassa

1. Зарегистрируйтесь или войдите в личный кабинет [ЮKassa](https://yookassa.ru/).
2. Перейдите в раздел **Настройки -> Ключи API** и получите:
   - **Идентификатор магазина** (`YOOKASSA_SHOP_ID`)
   - **Секретный ключ** (`YOOKASSA_SECRET_KEY`)
3. Перейдите в настройки интеграций (раздел **Вебхуки** или **HTTP-уведомления**) и укажите URL для отправки уведомлений о платежах:
   - URL: `https://<ваш-домен>/api/yookassa/webhook`
   - Событие: `payment.succeeded` (платеж успешно завершен).

---

## Шаг 3. Подготовка кода к деплою (Важно!)

В файле `src/app/api/yookassa/create/route.ts` на строке 31 адрес возврата после оплаты (`return_url`) сейчас жестко зашит под локальную разработку:
```typescript
return_url: 'http://localhost:3000/payment/success',
```

> [!IMPORTANT]
> Для продакшена замените его на динамическую ссылку на основе домена приложения или добавьте переменную окружения `NEXT_PUBLIC_APP_URL`.
> Например:
> ```typescript
> return_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/payment/success`,
> ```

---

## Шаг 4. Деплой на Vercel (или другой хостинг)

1. Установите [Vercel CLI](https://vercel.com/cli) (`npm i -g vercel`) или подключите ваш GitHub репозиторий к Vercel.
2. В панели управления проектом на Vercel перейдите в **Settings -> Environment Variables** и добавьте следующие переменные окружения:

| Переменная | Описание | Пример значения |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL вашего проекта Supabase | `https://xxxxxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Секретный ключ service_role из Supabase | `ey......` |
| `YOOKASSA_SHOP_ID` | Идентификатор магазина ЮKassa | `123456` |
| `YOOKASSA_SECRET_KEY` | Секретный API-ключ ЮKassa | `live_xxxxxx...` или `test_xxxxxx...` |
| `NEXT_PUBLIC_APP_URL` | Адрес вашего развернутого сайта | `https://storyreels-app.vercel.app` |

3. Запустите деплой (`vercel --prod` or via Git push to branch `main`).

---

## Шаг 5. Проверка интеграции

После завершения деплоя выполните тестовый платеж:
1. Запустите создание платежа для вашего `userId` через `/api/yookassa/create`.
2. Перейдите по возвращенной ссылке `confirmation_url`, оплатите тестовой картой (в режиме песочницы ЮKassa).
3. Проверьте, что в базе данных Supabase в таблице `transactions` появилась запись об оплате, а у пользователя в `users` увеличился `token_balance`.
