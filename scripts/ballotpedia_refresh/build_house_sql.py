import json,sys
sys.path.insert(0,'/Users/vmn2k4/Coding/Choseno/scripts')
from start_us_2026_midterms import STATE_FIPS
ADMIN="5b66563e-2674-4fed-b733-3e19955a166a"
fips={v:k for k,v in STATE_FIPS.items()}
d=json.load(open('house_final.json'))
HOLD={'Andrew Tupone','Chuck Edwards'}   # have linked news articles / incumbent -> flag, don't auto-delete
rems=[r for r in d['rems'] if r[2] not in HOLD and r[2]!='Kelly Etsi']
adds=[a for a in d['adds'] if a[2]!='Kelly Esti']
seat={}
for l in open('db_export.txt'):
    f=l.rstrip('\n').split('|')
    if f[0]=='U.S. Representative': seat[f[2]]=f[3]
def party(p,name):
    pl=p.lower()
    if pl in('d','democratic'):return 'Democratic Party'
    if pl in('r','republican'):return 'Republican Party'
    if pl in('l','libertarian'):return 'Libertarian Party'
    if pl=='green':return 'Green Party'
    if pl=='constitution party':return 'Constitution Party'
    if name=='Steven Sanders':return 'No Labels Party'
    if pl in('write-in','independent','unenrolled','nonpartisan'):return 'Independent'
    return p
q=lambda s:"'"+s.replace("'","''")+"'"
rows=[(seat[fips[a[0]]+'%02d'%int(a[1])],a[2],party(a[3],a[2])) for a in adds]
newp=sorted({r[2] for r in rows}-{'Democratic Party','Republican Party','Libertarian Party','Green Party','Constitution Party','Independent','No Labels Party'})
sql=["BEGIN;"]
sql.append("CREATE TEMP TABLE rem_ids(id uuid) ON COMMIT DROP;INSERT INTO rem_ids VALUES "+",".join(f"('{r[5]}')" for r in rems)+";")
# safety: only pipeline-added, unclaimed rows
sql.append("DELETE FROM rem_ids WHERE id NOT IN (SELECT id FROM public.election_candidates WHERE added_by_election_admin_id='%s' AND claimed_at IS NULL);"%ADMIN)
sql.append("CREATE TEMP TABLE rem_pids ON COMMIT DROP AS SELECT politician_id pid FROM public.election_candidates WHERE id IN (SELECT id FROM rem_ids);")
sql.append("DELETE FROM public.election_candidates WHERE id IN (SELECT id FROM rem_ids);")
# orphan stub cleanup: only stubs with no other candidacy, no office_holder link
sql.append("DELETE FROM public.politician_profiles WHERE id IN (SELECT pid FROM rem_pids) AND NOT EXISTS (SELECT 1 FROM public.election_candidates o WHERE o.politician_id=politician_profiles.id) AND NOT EXISTS (SELECT 1 FROM public.office_holders h WHERE h.linked_profile_id=politician_profiles.id);")
sql.append("DELETE FROM public.profiles WHERE id IN (SELECT pid FROM rem_pids) AND NOT EXISTS (SELECT 1 FROM public.election_candidates o WHERE o.politician_id=profiles.id) AND NOT EXISTS (SELECT 1 FROM public.office_holders h WHERE h.linked_profile_id=profiles.id) AND NOT EXISTS (SELECT 1 FROM public.politician_profiles x WHERE x.id=profiles.id);")
if newp:
    sql.append("INSERT INTO public.political_parties (country,name) SELECT v.c,v.n FROM (VALUES "+",".join(f"('USA',{q(n)})" for n in newp)+") v(c,n) WHERE NOT EXISTS (SELECT 1 FROM public.political_parties p WHERE p.country=v.c AND p.name=v.n);")
sql.append("CREATE TEMP TABLE new_stub (seat_id uuid, name text, party_name text, stub_id uuid) ON COMMIT DROP;")
sql.append("INSERT INTO new_stub VALUES "+",".join(f"('{s}',{q(n)},{q(p)},gen_random_uuid())" for s,n,p in rows)+";")
sql.append("INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id) SELECT stub_id,'politician',name,true,'USA',gen_random_uuid() FROM new_stub;")
sql.append("INSERT INTO public.politician_profiles (id, political_party_id) SELECT ns.stub_id, pp.id FROM new_stub ns LEFT JOIN public.political_parties pp ON pp.country='USA' AND pp.name=ns.party_name;")
sql.append(f"INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id) SELECT seat_id, stub_id, 'approved', now(), '{ADMIN}' FROM new_stub;")
sql.append("COMMIT;")
open('house_apply.sql','w').write("\n".join(sql)+"\n")
open('house_removed_backup_ids.txt','w').write("\n".join(f"{r[5]}|{r[0]}-{r[1]}|{r[2]}|{r[3]}" for r in rems))
print(len(rems),'removals,',len(rows),'adds, new parties:',newp)
