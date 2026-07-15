-- 1. Add the Ghost ID to the existing profiles table
-- This acts as the user's current anonymous mask.
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS current_ghost_id UUID DEFAULT gen_random_uuid() UNIQUE;

-- 2. Create the Posts Table
CREATE TABLE IF NOT EXISTS public.posts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ghost_id UUID NOT NULL, -- Intentionally NOT a Foreign Key to ensure untraceability when rotated
    constituency TEXT NOT NULL, -- Used to group posts by region
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    likes_count INT DEFAULT 0,
    dislikes_count INT DEFAULT 0
);

-- Index for fast feed loading by constituency
CREATE INDEX IF NOT EXISTS idx_posts_constituency ON public.posts(constituency);

-- Set up RLS for posts
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read posts" ON public.posts FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert posts" ON public.posts FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 3. Create the Comments Table
CREATE TABLE IF NOT EXISTS public.comments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    ghost_id UUID NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Index to quickly load comments for a post
CREATE INDEX IF NOT EXISTS idx_comments_post_id ON public.comments(post_id);

-- Set up RLS for comments
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read comments" ON public.comments FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert comments" ON public.comments FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 4. Create the Votes Table (Likes/Dislikes)
CREATE TABLE IF NOT EXISTS public.post_votes (
    post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    ghost_id UUID NOT NULL,
    vote_type SMALLINT NOT NULL CHECK (vote_type IN (1, -1)), -- 1 for Like, -1 for Dislike
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    PRIMARY KEY (post_id, ghost_id) -- Prevents a ghost ID from voting twice on the same post
);

-- Protect post_votes from direct client access (Voting is handled by the RPC function below which bypasses RLS safely)
ALTER TABLE public.post_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read votes" ON public.post_votes FOR SELECT USING (true);
-- No insert/update/delete policies needed because we use SECURITY DEFINER functions.

-- 5. RPC Function to "Burn" Identity
-- When a user calls this, they get a completely new Ghost ID. 
-- Their old posts become permanently orphaned and untraceable.
CREATE OR REPLACE FUNCTION burn_ghost_identity()
RETURNS void AS $$
BEGIN
    UPDATE public.profiles 
    SET current_ghost_id = gen_random_uuid() 
    WHERE id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 6. RPC Function to securely vote and update counts simultaneously
CREATE OR REPLACE FUNCTION vote_on_post(p_post_id UUID, p_vote_type SMALLINT)
RETURNS void AS $$
DECLARE
    v_ghost_id UUID;
    v_existing_vote SMALLINT;
BEGIN
    -- Get the user's current ghost ID
    SELECT current_ghost_id INTO v_ghost_id FROM public.profiles WHERE id = auth.uid();
    
    IF v_ghost_id IS NULL THEN
        RAISE EXCEPTION 'Ghost identity not found';
    END IF;

    -- Check if they already voted
    SELECT vote_type INTO v_existing_vote FROM public.post_votes WHERE post_id = p_post_id AND ghost_id = v_ghost_id;

    IF v_existing_vote IS NOT NULL THEN
        IF v_existing_vote = p_vote_type THEN
            -- User clicked the same vote again, so remove the vote (Toggle off)
            DELETE FROM public.post_votes WHERE post_id = p_post_id AND ghost_id = v_ghost_id;
            
            IF p_vote_type = 1 THEN
                UPDATE public.posts SET likes_count = likes_count - 1 WHERE id = p_post_id;
            ELSE
                UPDATE public.posts SET dislikes_count = dislikes_count - 1 WHERE id = p_post_id;
            END IF;
        ELSE
            -- User changed their vote from Like to Dislike (or vice versa)
            UPDATE public.post_votes SET vote_type = p_vote_type WHERE post_id = p_post_id AND ghost_id = v_ghost_id;
            
            IF p_vote_type = 1 THEN
                UPDATE public.posts SET likes_count = likes_count + 1, dislikes_count = dislikes_count - 1 WHERE id = p_post_id;
            ELSE
                UPDATE public.posts SET likes_count = likes_count - 1, dislikes_count = dislikes_count + 1 WHERE id = p_post_id;
            END IF;
        END IF;
    ELSE
        -- New vote
        INSERT INTO public.post_votes (post_id, ghost_id, vote_type) VALUES (p_post_id, v_ghost_id, p_vote_type);
        
        IF p_vote_type = 1 THEN
            UPDATE public.posts SET likes_count = likes_count + 1 WHERE id = p_post_id;
        ELSE
            UPDATE public.posts SET dislikes_count = dislikes_count + 1 WHERE id = p_post_id;
        END IF;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
