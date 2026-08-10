import json
import re
import sys
import unicodedata
import difflib


def normalize(s):
    if not s:
        return ""
    s = unicodedata.normalize('NFD', s)
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    s = s.upper()
    s = re.sub(r'\s*\(S[CT]\)\s*', '', s)
    s = re.sub(r'[^A-Z0-9]', '', s)
    return s


def dist_normalize(s):
    """Looser than the constituency normalize() -- district names in Wikipedia's
    table and in our BharatMapService shape properties come from genuinely
    different sources and disagree on things like "East Champaran" vs
    "Purbi Champaran" (Hindi vs. English naming for the same district), so this
    only needs to be good enough for a fuzzy closeness check, not exact matching."""
    return normalize(s)


def match(mlas, shapes_file, out_file, fuzzy_cutoff=0.82, blocklist=None, manual=None):
    """shapes_file lines are `id|name|dist_name`. Some states have two different
    constituencies sharing the exact same name in different districts (confirmed:
    Bihar's "Kalyanpur" and "Pipra", each appearing once in two different
    districts) -- a plain name->id dict silently drops one on the key collision,
    causing whichever MLA loses the collision to get linked to a different real
    constituency's shape (wrong geometry, not just a wrong label). Shapes are kept
    as a name -> [(id, name, dist_name), ...] list so a collision can be resolved
    by comparing the MLA's own recorded district against each candidate's
    dist_name, instead of one silently overwriting the other.
    """
    blocklist = blocklist or set()
    manual = manual or {}

    shapes = {}
    id_to_name = {}
    with open(shapes_file) as f:
        for line in f:
            line = line.rstrip('\n')
            if not line:
                continue
            parts = line.split('|', 2)
            sid, name = parts[0], parts[1]
            dist_name = parts[2] if len(parts) > 2 else ''
            shapes.setdefault(normalize(name), []).append((int(sid), name, dist_name))
            id_to_name[int(sid)] = name

    def pick_candidate(candidates, mla_district):
        if len(candidates) == 1:
            return candidates[0]
        # Name collision within this state -- disambiguate by district. Try exact
        # normalized match first, then fall back to substring/fuzzy closeness
        # (district naming conventions differ between Wikipedia and our shape
        # data, e.g. "East Champaran" vs "Purbi Champaran").
        mla_d = dist_normalize(mla_district or '')
        for sid, name, dist_name in candidates:
            if dist_normalize(dist_name) == mla_d:
                return (sid, name, dist_name)
        for sid, name, dist_name in candidates:
            dn = dist_normalize(dist_name)
            if mla_d and (mla_d in dn or dn in mla_d):
                return (sid, name, dist_name)
        print(f"  ⚠️  UNRESOLVED COLLISION: '{candidates[0][1]}' has {len(candidates)} "
              f"candidates, none matched district '{mla_district}' -- picking first "
              f"arbitrarily, VERIFY MANUALLY: {candidates}")
        return candidates[0]

    matched = []
    unmatched = []
    for r in mlas:
        key = r['constituency']
        if key in manual:
            sid = manual[key]
            matched.append({**r, 'map_shape_id': sid, 'shape_name': id_to_name.get(sid, '(manual)')})
            continue
        norm = normalize(key)
        if norm in shapes:
            sid, shape_name, _ = pick_candidate(shapes[norm], r.get('district'))
            matched.append({**r, 'map_shape_id': sid, 'shape_name': shape_name})
        else:
            unmatched.append(r)

    still_unmatched = []
    for r in unmatched:
        if r['constituency'] in blocklist:
            still_unmatched.append(r)
            continue
        norm = normalize(r['constituency'])
        close = difflib.get_close_matches(norm, shapes.keys(), n=1, cutoff=fuzzy_cutoff)
        if close:
            sid, shape_name, _ = pick_candidate(shapes[close[0]], r.get('district'))
            print(f"  FUZZY: {r['constituency']:30s} -> {shape_name} (shape {sid})")
            matched.append({**r, 'map_shape_id': sid, 'shape_name': shape_name})
        else:
            still_unmatched.append(r)

    # Sanity check: every matched map_shape_id should be used exactly once. If not,
    # two different MLAs got linked to the same shape -- a real bug (either a
    # missed name-collision case above, or a duplicate constituency in the source).
    used_ids = [r['map_shape_id'] for r in matched]
    dup_ids = {i for i in used_ids if used_ids.count(i) > 1}
    if dup_ids:
        print(f"  ⚠️  {len(dup_ids)} map_shape_id(s) claimed by more than one MLA -- investigate before uploading: {dup_ids}")
        for r in matched:
            if r['map_shape_id'] in dup_ids:
                print('    ', r['constituency'], r['district'], '->', r['map_shape_id'], r['shape_name'])

    print(f"Matched: {len(matched)} / {len(mlas)}")
    print(f"Still unmatched: {len(still_unmatched)}")
    for r in still_unmatched:
        print(' ', r['constituency'], '|', normalize(r['constituency']))

    json.dump(matched, open(out_file, 'w'), indent=2)
    return matched, still_unmatched


PB_MANUAL = {
    'Lehragaga': 65994,  # spelling variant "Lehra" below fuzzy cutoff
}

KL_MANUAL = {
    'Koyilandy': 66035,  # spelling variant "Quilandy" below fuzzy cutoff
    'Vypin': 66091,      # spelling variant "Vypen" below fuzzy cutoff
}

GJ_MANUAL = {
    # Gujarat has an unusually high rate of genuinely duplicate constituency names
    # across districts (5 pairs) -- Wikipedia disambiguates most of them with a
    # parenthetical district hint right in the constituency name text, which our
    # constituency-name normalize() doesn't parse as a district signal, so all 7
    # are resolved manually here instead of relying on automatic collision
    # resolution.
    'Mandvi (Kachchh)': 65098,       # Kutch/Kachchh district
    'Mangrol': 65179,                # Junagadh district (MLA data has "Junagarh", a spelling variant of the shape's "Junagadh" -- didn't match the auto district-resolver)
    'Kalol (Panchmahal)': 65216,     # Panchmahal/"Panch Mahals" district
    'Jetpur, Chhota Udaipur': 67429, # Chhota Udaipur district
    'Mangrol (Surat)': 65241,
    'Mandvi (Surat)': 65242,
    # Mahuva (Surat): MLA data's district field says "Surat", but the only two
    # "Mahuva" shapes are in Bhavnagar and Tapi districts -- going with Tapi since
    # it was carved out of Surat district in 2007 (still commonly referenced by
    # the old district name) and is nowhere near Bhavnagar geographically. Not
    # independently verified beyond this reasoning -- flag if this needs revisiting.
    'Mahuva (Surat)': 65255,
}

RJ_MANUAL = {
    'Dungargarh': 66779,    # "Shree Dungargarh" -- extra word, below fuzzy cutoff
    'Lachhmangarh': 66795,  # spelling variant "Laxmangarh" below fuzzy cutoff
}

KA_MANUAL = {
    'Hoovina Hadagali': 65724,
    'Byndoor': 65753,
    'Kapu': 65756,
    'Krishnarajapuram': 65786,
}

TN_MANUAL = {
    'Anaicut': 66195,  # spelling variant "Anaikattu" below fuzzy-match cutoff
}

WB_MANUAL = {
    'Tollygunge': 64396,  # spelling variant "Tollyganj" below fuzzy-match cutoff
    'Indas': 64501,       # spelling variant "Indus" below fuzzy-match cutoff
}

MH_MANUAL = {
    'Dharashiv': 67506,   # pre-2023 name Osmanabad, still used in our BharatMapService shape
    'Umarga': 65444,      # spelling variant "Omerga" below fuzzy-match cutoff
    'Vikramgad': 65354,   # spelling variant "Vekramgrth" below fuzzy-match cutoff
}

UP_MANUAL = {
    'Meerut City': 67004,
    'Dholana': 67014,
    'Prayagraj West': 67211,
    'Prayagraj North': 67212,
    'Prayagraj South': 67213,
    'Ghazipur Sadar': 67325,
}

CG_MANUAL = {
    'Raipur Rural': 64871,  # shape named "Raipur City Gramin" (Hindi "Gramin" = Rural)
    'Durg Rural': 64885,    # shape named "Durg Gramin"
}

TS_MANUAL = {
    'L. B. Nagar': 66462,  # shape named "Lal Bahadur Nagar" -- abbreviation vs. full name
}

AP_MANUAL = {
    # Genuine duplicate constituency names across districts, disambiguated by
    # Wikipedia with a parenthetical *district* hint baked into the constituency
    # name text itself (same pattern as Gujarat) -- our normalize() only strips
    # (SC)/(ST) suffixes, not district-name parentheticals, so these never match
    # the shape's own (SC)-suffixed or plain name automatically.
    'Prathipadu (Kakinada)': 65502,
    'Prathipadu (Guntur)': 65556,     # shape "Prathipadu (SC)"
    'Gannavaram (Konaseema)': 65511,  # shape "Gannavaram (SC)"
    'Gannavaram (Krishna)': 65534,    # shape "Gannavaram"
    'Palakollu': 65521,               # shape's spelling "Palacole", below fuzzy cutoff
}

DL_MANUAL = {
    'Delhi Cantonment': 66730,  # shape named "Delhi Cantt", below fuzzy cutoff
}

GA_MANUAL = {
    'Santa Cruz': 65873,  # shape named "St.Cruz", below fuzzy cutoff
}

MN_MANUAL = {
    'Sugnu': 67508,  # shape's spelling "Sugnoo", below fuzzy cutoff
}

NL_MANUAL = {
    'Chozuba': 63905,  # shape's spelling "Chazouba", below fuzzy cutoff
}

MP_MANUAL = {
    'Joura': 64907,     # shape's spelling "Jaura", below fuzzy cutoff
    'Sumawali': 64908,  # shape's spelling "Sumaoli", below fuzzy cutoff
    'Sewda': 64923,     # shape's spelling "Seondha" -- a divergent transliteration of the same Datia-district town, the only unclaimed shape left in the district
    'Naryoli': 67390,   # shape's spelling "Naryawali", below fuzzy cutoff
    'Barwah': 65051,    # shape's spelling "Badwaha", below fuzzy cutoff
}

SK_MANUAL = {
    'Tumin–Lingee': 63818,  # shape's spelling "Tumen-Lingi", below fuzzy cutoff
    'Namchaybong': 63824,        # shape's spelling "Namcheybung", below fuzzy cutoff
    # 'Sangha' (the Buddhist-monasteries reserved seat, no territorial
    # boundary) intentionally left unmatched -- genuinely absent from our
    # LGD-derived boundary data, same class of gap as Assam/J&K's Lok Sabha
    # boundary-vintage mismatches documented elsewhere in this file's history.
}

MZ_MANUAL = {
    # MLA data numbers these Aizawl sub-constituencies with Arabic numerals
    # (1/2/3); the shapes use Roman numerals (I/II/III) -- normalize() doesn't
    # convert between the two, so difflib fuzzy-matched all of them onto the
    # single "I" shape instead of leaving II/III genuinely unmatched.
    'Aizawl North 1': 64005, 'Aizawl North 2': 64006, 'Aizawl North 3': 64007,
    'Aizawl East 1': 64008, 'Aizawl East 2': 64009,
    'Aizawl West 1': 64010, 'Aizawl West 2': 64011, 'Aizawl West 3': 64012,
    'Aizawl South 1': 64013, 'Aizawl South 2': 64014, 'Aizawl South 3': 64015,
}

if __name__ == '__main__':
    mlas = json.load(open(sys.argv[1]))
    manual = None
    if 'up_mlas' in sys.argv[1]:
        manual = UP_MANUAL
    elif 'mh_mlas' in sys.argv[1]:
        manual = MH_MANUAL
    elif 'wb_mlas' in sys.argv[1]:
        manual = WB_MANUAL
    elif 'tn_mlas' in sys.argv[1]:
        manual = TN_MANUAL
    elif 'ka_mlas' in sys.argv[1]:
        manual = KA_MANUAL
    elif 'rj_mlas' in sys.argv[1]:
        manual = RJ_MANUAL
    elif 'gj_mlas' in sys.argv[1]:
        manual = GJ_MANUAL
    elif 'kl_mlas' in sys.argv[1]:
        manual = KL_MANUAL
    elif 'pb_mlas' in sys.argv[1]:
        manual = PB_MANUAL
    elif 'cg_mlas' in sys.argv[1]:
        manual = CG_MANUAL
    elif 'ts_mlas' in sys.argv[1]:
        manual = TS_MANUAL
    elif 'ap_mlas' in sys.argv[1]:
        manual = AP_MANUAL
    elif 'dl_mlas' in sys.argv[1]:
        manual = DL_MANUAL
    elif 'ga_mlas' in sys.argv[1]:
        manual = GA_MANUAL
    elif 'mn_mlas' in sys.argv[1]:
        manual = MN_MANUAL
    elif 'nl_mlas' in sys.argv[1]:
        manual = NL_MANUAL
    elif 'mz_mlas' in sys.argv[1]:
        manual = MZ_MANUAL
    elif 'sk_mlas' in sys.argv[1]:
        manual = SK_MANUAL
    elif 'mp_mlas' in sys.argv[1]:
        manual = MP_MANUAL
    match(mlas, sys.argv[2], sys.argv[3], manual=manual)
