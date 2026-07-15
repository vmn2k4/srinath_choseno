-- Run this in your Supabase SQL editor to create the profiles table

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  role text check (role in ('normal', 'politician')),
  full_name text,
  country text,
  constituency text,
  designation text,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- Set up Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Allow users to view their own profile
CREATE POLICY "Users can view own profile" 
ON public.profiles FOR SELECT 
USING (auth.uid() = id);

-- Allow users to insert their own profile
CREATE POLICY "Users can insert own profile" 
ON public.profiles FOR INSERT 
WITH CHECK (auth.uid() = id);

-- Allow users to update their own profile
CREATE POLICY "Users can update own profile" 
ON public.profiles FOR UPDATE
USING (auth.uid() = id);
