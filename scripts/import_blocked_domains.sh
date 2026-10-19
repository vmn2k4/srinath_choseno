#!/usr/bin/env bash
# Downloads Blocklist Project domain lists and loads them into
# public.blocked_domains. Re-runnable (upserts). Needs PGPASSWORD (the DB
# password in .env.local) in the environment.
# malware/abuse lists (millions of DNS-level entries) are skipped on purpose:
# Google Safe Browsing covers malware at link-check time.
set -euo pipefail
DB="${DB_URL:-postgresql://postgres.qlzyfdwrkcxyqapewxwg@aws-1-us-east-2.pooler.supabase.com:5432/postgres}"
DIR="$(mktemp -d)"
CATS="${CATS:-porn phishing scam fraud ransomware drugs gambling}"
psql "$DB" -c "create temp table x(domain text, category text)" >/dev/null 2>&1 || true
for c in $CATS; do
  curl -sfL "https://blocklistproject.github.io/Lists/alt-version/$c-nl.txt" \
    | grep -v '^#' | tr -d '\r' | awk -v c="$c" 'NF==1 && index($1,".")>0 {print tolower($1) "\t" c}' > "$DIR/$c.tsv"
  echo "$c: $(wc -l < "$DIR/$c.tsv") domains"
  psql "$DB" <<SQL
create temp table stage(domain text, category text);
\copy stage from '$DIR/$c.tsv'
insert into public.blocked_domains select distinct on (domain) domain, category from stage on conflict (domain) do nothing;
SQL
done
psql "$DB" -c "select category, count(*) from public.blocked_domains group by 1 order by 2 desc"
