import json,re,sys,difflib,unicodedata,collections
sys.path.insert(0,'/Users/vmn2k4/Coding/Choseno/scripts')
from start_us_2026_midterms import STATE_FIPS
d=json.load(open('gs3_bp.json'))
ST={'Alabama':'AL','Alaska':'AK','Arizona':'AZ','Arkansas':'AR','California':'CA','Colorado':'CO','Connecticut':'CT','Delaware':'DE','Florida':'FL','Georgia':'GA','Hawaii':'HI','Idaho':'ID','Illinois':'IL','Indiana':'IN','Iowa':'IA','Kansas':'KS','Kentucky':'KY','Louisiana':'LA','Maine':'ME','Maryland':'MD','Massachusetts':'MA','Michigan':'MI','Minnesota':'MN','Mississippi':'MS','Missouri':'MO','Montana':'MT','Nebraska':'NE','Nevada':'NV','New_Hampshire':'NH','New_Jersey':'NJ','New_Mexico':'NM','New_York':'NY','North_Carolina':'NC','North_Dakota':'ND','Ohio':'OH','Oklahoma':'OK','Oregon':'OR','Pennsylvania':'PA','Rhode_Island':'RI','South_Carolina':'SC','South_Dakota':'SD','Tennessee':'TN','Texas':'TX','Utah':'UT','Vermont':'VT','Virginia':'VA','Washington':'WA','West_Virginia':'WV','Wisconsin':'WI','Wyoming':'WY'}
fips={v:k for k,v in STATE_FIPS.items()}
def strip(s): return ''.join(c for c in unicodedata.normalize('NFD',s) if unicodedata.category(c)!='Mn')
def last(n):
    n=re.sub(r'\(.*?\)','',strip(n)).lower().replace('.',' ').replace(',',' ').replace("'",'')
    p=[x for x in n.split() if x not in('jr','sr','ii','iii','iv')]
    return p[-1] if p else ''
def toks(n): return set(re.sub(r'\(.*?\)','',strip(n)).lower().replace('.',' ').replace(',',' ').replace("'",'').split())
seat={};db=collections.defaultdict(list)
for l in open('db_gs.txt'):
    f=l.rstrip('\n').split('|')
    role,fp,code,sid,cid,nm,party,pipe,claimed=f[:9]
    seat[(role,fp)]=sid
    if cid: db[(role,fp)].append(dict(cid=cid,name=nm,party=party,pipe=pipe=='t',claimed=bool(claimed)))
def parse(c):
    nm,_,p=c.rpartition(':'); par=re.findall(r'\((.*?)\)',nm); nm=re.sub(r'\(.*?\)','',nm).strip()
    if p=='Write-in' and par: p='Write-in:'+par[0]
    p=p.split(' / ')[0].strip()
    return nm,p
res={}
for role,k in (('U.S. Senator','SEN'),('Governor','GOV')):
    for st,rr in d[k].items():
        r=rr[0]
        fp=fips[ST[st]]
        bp={}
        for c in r['c']:
            nm,p=parse(c)
            if 'withdrew' in p.lower() or 'disqualified' in p.lower(): continue
            bp.setdefault(last(nm),(nm,p))
        # (dedupe handled by setdefault)
        cur=db[(role,fp)]
        dbk={}
        for x in cur: dbk.setdefault(last(x['name']),[]).append(x)
        adds=[(nm,p) for lk,(nm,p) in bp.items() if lk not in dbk and not any(difflib.SequenceMatcher(None,lk,k2).ratio()>0.82 for k2 in dbk) and not any(lk in toks(x['name']) for xs in dbk.values() for x in xs)]
        rems=[x for lk,xs in dbk.items() for x in xs if lk not in bp and not any(difflib.SequenceMatcher(None,lk,k2).ratio()>0.82 for k2 in bp) and not any(k2 in toks(x['name']) for k2 in bp)]
        res[(role,ST[st])]=dict(seat=seat[(role,fp)],adds=adds,rems=rems)
        print(role[:3],ST[st],'+',[a[0]+'('+a[1]+')' for a in adds],'-',[x['name']+('*' if (not x['pipe'] or x['claimed']) else '') for x in rems])
json.dump({f"{k[0]}|{k[1]}":v for k,v in res.items()},open('gs_diff.json','w'))
print(sum(len(v['adds']) for v in res.values()),sum(len(v['rems']) for v in res.values()))
