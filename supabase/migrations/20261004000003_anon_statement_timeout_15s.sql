-- anon's 3s statement_timeout made public pages fail outright whenever the DB was merely slow
-- (cold connections, RLS plan expansion, CPU throttling), and ISR cached the failure. 15s lets
-- slow-but-working queries finish. authenticated stays at 8s.
ALTER ROLE anon SET statement_timeout = '15s';
