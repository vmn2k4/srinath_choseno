-- Real political party names as they actually appear in the 2024 Lok Sabha election
-- results (parsed from Wikipedia's "List of members of the 18th Lok Sabha", cross-checked
-- against real per-state seat counts -- see docs/adding-india-politicians.md). Inserted as
-- their own rows (not merged into the earlier generic seed from
-- 20260810000002_india_politician_roles_and_parties.sql) so the office_holders import's
-- exact-match `pp.name ILIKE s.political_party` join has a real row to match against for
-- every party actually fielding a winning MP -- including party-split factions
-- (Shiv Sena's two post-2022 successor parties, NCP's two post-2023 successor parties)
-- that a generic pre-guessed party list couldn't have anticipated correctly.

INSERT INTO public.political_parties (country, name, rank) VALUES
  ('India', 'Aazad Samaj Party (Kanshi Ram)', 999),
  ('India', 'Akali Dal (Waris Punjab De)', 999),
  ('India', 'All Jharkhand Students Union', 999),
  ('India', 'Apna Dal (Soneylal)', 999),
  ('India', 'Bharat Adivasi Party', 999),
  ('India', 'Communist Party of India (Marxist-Leninist) Liberation', 999),
  ('India', 'Hindustani Awam Morcha', 999),
  ('India', 'Jammu and Kashmir Awami Ittehad Party', 999),
  ('India', 'Janata Dal (Secular)', 999),
  ('India', 'Kerala Congress', 999),
  ('India', 'Marumalarchi Dravida Munnetra Kazhagam', 999),
  ('India', 'Nationalist Citizens Party of India', 999),
  ('India', 'Nationalist Congress Party', 999),
  ('India', 'Nationalist Congress Party (Sharadchandra Pawar)', 999),
  ('India', 'Rashtriya Loktantrik Party', 999),
  ('India', 'Revolutionary Socialist Party (India)', 999),
  ('India', 'Shiv Sena (2022–present)', 999),
  ('India', 'Shiv Sena (UBT)', 999),
  ('India', 'Trinamool Congress', 999),
  ('India', 'United People''s Party Liberal', 999),
  ('India', 'Viduthalai Chiruthaigal Katchi', 999),
  ('India', 'Voice of the People Party (Meghalaya)', 999),
  ('India', 'Zoram People''s Movement', 999)
ON CONFLICT (country, name) DO NOTHING;
