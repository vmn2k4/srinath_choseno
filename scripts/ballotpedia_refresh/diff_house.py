import json, re, unicodedata, sys, collections
sys.path.insert(0,'/Users/vmn2k4/Coding/Choseno/scripts')
from start_us_2026_midterms import STATE_FIPS
bp=json.load(open('house_bp.json'))
name2fips={}
# STATE_FIPS maps? inspect
items=list(STATE_FIPS.items())[:2]
def strip(s): return ''.join(c for c in unicodedata.normalize('NFD',s) if unicodedata.category(c)!='Mn')
SUFF={'jr','sr','ii','iii','iv'}
def key(n):
    n=strip(n).lower().replace('.',' ').replace(',',' ')
    p=[x for x in n.split() if x not in SUFF]
    return p[-1] if p else ''
def pcode(p):
    p=p.lower()
    if p in('d','democratic','democratic party') or p.startswith('democratic'): return 'Democratic'
    if p in('r',) or p.startswith('republican'): return 'Republican'
    return p
db=collections.defaultdict(list)  # code -> rows
seatid={}
for l in open('db_export.txt'):
    f=l.rstrip('\n').split('|')
    if f[0]!='U.S. Representative': continue
    seatid[f[2]]=f[3]
    if f[4]: db[f[2]].append(dict(cid=f[4],name=f[5],party=f[6],pipe=f[7]=='t'))
print(items, len(seatid))
ST={'Alabama':'AL','Alaska':'AK','Arizona':'AZ','Arkansas':'AR','California':'CA','Colorado':'CO','Connecticut':'CT','Delaware':'DE','Florida':'FL','Georgia':'GA','Hawaii':'HI','Idaho':'ID','Illinois':'IL','Indiana':'IN','Iowa':'IA','Kansas':'KS','Kentucky':'KY','Louisiana':'LA','Maine':'ME','Maryland':'MD','Massachusetts':'MA','Michigan':'MI','Minnesota':'MN','Mississippi':'MS','Missouri':'MO','Montana':'MT','Nebraska':'NE','Nevada':'NV','New_Hampshire':'NH','New_Jersey':'NJ','New_Mexico':'NM','New_York':'NY','North_Carolina':'NC','North_Dakota':'ND','Ohio':'OH','Oklahoma':'OK','Oregon':'OR','Pennsylvania':'PA','Rhode_Island':'RI','South_Carolina':'SC','South_Dakota':'SD','Tennessee':'TN','Texas':'TX','Utah':'UT','Vermont':'VT','Virginia':'VA','Washington':'WA','West_Virginia':'WV','Wisconsin':'WI','Wyoming':'WY'}
fips={v:k for k,v in STATE_FIPS.items()}
adds=[];rems=[];skipped=[];missing_seat=[]
for st,dists in bp.items():
    for d,x in dists.items():
        code=fips[ST[st]]+('%02d'%int(d))
        if code not in seatid: missing_seat.append((st,d));continue
        bpc=[]
        for c in x['c']:
            nm,_,party=c.rpartition(':')
            nm=re.sub(r'\(.*?\)','',nm).strip()
            if party.lower() in('unofficially withdrew','incumbent') or 'withdrew' in party.lower() or '!' in nm[:1]:
                skipped.append((ST[st],d,c));continue
            bpc.append((nm.strip(),party))
        if not bpc: skipped.append((ST[st],d,'NO BP CANDIDATES (kept DB as-is)')); continue
        dbk={key(r['name']):r for r in db[code]}
        bpk={key(n):(n,p) for n,p in bpc}
        for k,(n,p) in bpk.items():
            if k not in dbk: adds.append((ST[st],d,n,p))
        for k,r in dbk.items():
            if k not in bpk: rems.append((ST[st],d,r['name'],r['party'],r['pipe'],r['cid']))
print('ADDS',len(adds)); 
for a in adds: print('  +',*a)
print('REMOVES',len(rems))
for a in rems: print('  -',*a[:5])
print('SKIPPED/FLAGS'); 
for s in skipped:
    if 'NO BP' in s[2] or 'Incumbent' in s[2]: print('  ',s)
print('missing seats',missing_seat)
print('BP districts',sum(len(v) for v in bp.values()))
json.dump(dict(adds=adds,rems=rems),open('house_diff.json','w'))
