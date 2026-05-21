-- Create Users Table
CREATE TABLE public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id TEXT UNIQUE,
  token_balance INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create Shows Table
CREATE TABLE public.shows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create Episodes Table
CREATE TYPE episode_status AS ENUM ('pending', 'ready', 'failed');

CREATE TABLE public.episodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  show_id UUID REFERENCES public.shows(id) ON DELETE CASCADE,
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
ALTER TABLE public.shows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.episodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Create Policies (Example basics)
CREATE POLICY "Users can view own data" ON public.users FOR SELECT USING (auth.uid()::text = auth_id);
CREATE POLICY "Users can view own shows" ON public.shows FOR SELECT USING (auth.uid() IN (SELECT auth_id::uuid FROM public.users WHERE id = user_id));
CREATE POLICY "Users can view own episodes" ON public.episodes FOR SELECT USING (auth.uid() IN (SELECT auth_id::uuid FROM public.users WHERE id = user_id));
CREATE POLICY "Users can view own transactions" ON public.transactions FOR SELECT USING (auth.uid() IN (SELECT auth_id::uuid FROM public.users WHERE id = user_id));
