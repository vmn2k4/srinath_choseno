import json,re,sys
ADMIN="5b66563e-2674-4fed-b733-3e19955a166a"
d=json.load(open('gs_diff.json'))
def party(p):
    pl=p.lower()
    if p.startswith('Write-in'):
        q=p.split(':',1)[1] if ':' in p else ''
        return party(q) if q else 'Independent'
    if pl in('d','democratic','democratic party'):return 'Democratic Party'
    if pl in('r','republican','republican party'):return 'Republican Party'
    if pl in('l','libertarian'):return 'Libertarian Party'
    if pl in('g','green'):return 'Green Party'
    if pl in('independent','unaffiliated','unenrolled','nonpartisan','no political party','no party affiliation') : return 'No Party Affiliation' if pl=='no party affiliation' else 'Independent'
    if pl=='nebraska working people party': return 'Nebraska Working People'
    if pl=='constitution party':return 'Constitution Party'
    return p
q=lambda s:"'"+s.replace("'","''")+"'"
adds=[];rems=[]
for k,v in d.items():
    for n,p in v['adds']: adds.append((v['seat'],n,party(p)))
    for x in v['rems']: rems.append(x)
json.dump(rems,open('gs_rems.json','w'))
base={'Democratic Party','Republican Party','Libertarian Party','Green Party','Constitution Party','Independent','No Party Affiliation','Nebraska Working People'}
newp=sorted({a[2] for a in adds}-base)
open('gs_new_parties.txt','w').write('\n'.join(newp))
open('gs_adds.json','w').write(json.dumps(adds))
print(len(adds),'adds;',len(rems),'rems; candidate new parties:',newp)
