import json
ADMIN="5b66563e-2674-4fed-b733-3e19955a166a"
q=lambda s:"'"+s.replace("'","''")+"'"
adds=json.load(open('gs_adds.json')); rems=json.load(open('gs_rems.json'))
base={'Democratic Party','Republican Party','Libertarian Party','Green Party','Constitution Party','Independent','No Party Affiliation','Nebraska Working People'}
newp=sorted({a[2] for a in adds}-base)
sql=["BEGIN;"]
sql.append("CREATE TEMP TABLE rem_ids(id uuid) ON COMMIT DROP;INSERT INTO rem_ids VALUES "+",".join(f"('{r['cid']}')" for r in rems)+";")
sql.append("DELETE FROM rem_ids WHERE id NOT IN (SELECT id FROM public.election_candidates WHERE added_by_election_admin_id='%s' AND claimed_at IS NULL);"%ADMIN)
sql.append("CREATE TEMP TABLE rem_pids ON COMMIT DROP AS SELECT politician_id pid FROM public.election_candidates WHERE id IN (SELECT id FROM rem_ids);")
sql.append("DELETE FROM public.election_candidates WHERE id IN (SELECT id FROM rem_ids);")
nolink="NOT EXISTS (SELECT 1 FROM public.election_candidates o WHERE o.politician_id={t}.id) AND NOT EXISTS (SELECT 1 FROM public.office_holders h WHERE h.linked_profile_id={t}.id) AND NOT EXISTS (SELECT 1 FROM public.news_article_politicians n WHERE n.politician_id={t}.id) AND NOT EXISTS (SELECT 1 FROM public.politician_ratings r WHERE r.politician_id={t}.id)"
sql.append("DELETE FROM public.politician_profiles WHERE id IN (SELECT pid FROM rem_pids) AND "+nolink.format(t='politician_profiles')+";")
sql.append("DELETE FROM public.profiles WHERE id IN (SELECT pid FROM rem_pids) AND "+nolink.format(t='profiles')+" AND NOT EXISTS (SELECT 1 FROM public.politician_profiles x WHERE x.id=profiles.id);")
if newp:
    sql.append("INSERT INTO public.political_parties (country,name) SELECT v.c,v.n FROM (VALUES "+",".join(f"('USA',{q(n)})" for n in newp)+") v(c,n) WHERE NOT EXISTS (SELECT 1 FROM public.political_parties p WHERE p.country=v.c AND p.name=v.n);")
sql.append("CREATE TEMP TABLE new_stub (seat_id uuid, name text, party_name text, stub_id uuid) ON COMMIT DROP;")
sql.append("INSERT INTO new_stub VALUES "+",".join(f"('{s}',{q(n)},{q(p)},gen_random_uuid())" for s,n,p in adds)+";")
sql.append("INSERT INTO public.profiles (id, role, full_name, onboarding_completed, country, current_ghost_id) SELECT stub_id,'politician',name,true,'USA',gen_random_uuid() FROM new_stub;")
sql.append("INSERT INTO public.politician_profiles (id, political_party_id) SELECT ns.stub_id, pp.id FROM new_stub ns LEFT JOIN public.political_parties pp ON pp.country='USA' AND pp.name=ns.party_name;")
sql.append(f"INSERT INTO public.election_candidates (seat_id, politician_id, status, submitted_at, added_by_election_admin_id) SELECT seat_id, stub_id, 'approved', now(), '{ADMIN}' FROM new_stub;")
sql.append("COMMIT;")
open('gs_apply.sql','w').write("\n".join(sql)+"\n")
print(len(adds),len(rems))
