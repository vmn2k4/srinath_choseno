import re
import json
import sys


ATTR_PREFIX = re.compile(
    r'^(rowspan|colspan|bgcolor|style|align|class)\s*=\s*("[^"]*"|[^|]*)\s*\|',
    re.IGNORECASE,
)


def strip_leading_attrs(line):
    """Repeatedly strip leading cell attributes (rowspan=/colspan=/bgcolor=/
    style=/align=/class=, in any combination/order MediaWiki allows chained) so
    whatever real content follows -- a link, template, or plain text -- is left
    bare. A single bgcolor/style/rowspan-only strip wasn't enough once other
    attributes started appearing (Gujarat's `Colspan=3|Satish Patel` left the
    "Colspan=3|" prefix stuck to the name, since only bgcolor/style were
    recognized before)."""
    prev = None
    while prev != line:
        prev = line
        line = ATTR_PREFIX.sub('', line)
    return line.strip()


def is_pure_decoration(line):
    """A cell that's only attribute markup with nothing real after it -- a colour
    swatch or similar with no extractable value, vs. a cell that has an attribute
    prefix but also real content (a link or template) after it."""
    return strip_leading_attrs(line) == ''


def strip_rowspan(line):
    return re.sub(r'^rowspan\s*=\s*"?\d+"?\s*\|', '', line, flags=re.IGNORECASE).strip()


ROWSPAN_COUNT = re.compile(r'rowspan\s*=\s*"?(\d+)"?', re.IGNORECASE)


def get_rowspan_count(raw_line):
    """How many rows a party cell's rowspan declares it spans, wherever the
    `rowspan=N` appears -- as a leading cell attribute (`rowspan="4"|...`) or as
    a template argument (`{{...|X|rowspan=4}}`, the common shape for party
    templates). None if the cell isn't rowspan'd at all."""
    m = ROWSPAN_COUNT.search(raw_line)
    return int(m.group(1)) if m else None


def strip_attr_prefix(line):
    """Remove any leading cell attributes, leaving whatever real content follows
    on the same line, if any."""
    return strip_leading_attrs(line)


# A handful of coalition/alliance names recur across many states' tables (unlike the
# long tail of hundreds of real regional parties) -- used to tell "this cell names an
# alliance, not the party" apart from a real party name when both occupy the same
# generic {{Party name with colour|X}} template shape (Maharashtra-style pages don't
# distinguish party vs. alliance by template name the way UP/Lok Sabha's "Full party
# name with colour" convention does -- see docs/adding-india-politicians.md).
KNOWN_ALLIANCES = {
    'national democratic alliance',
    'indian national developmental inclusive alliance',
    'maha vikas aghadi',
    'mahagathbandhan',
    'united progressive alliance',
    'left democratic front',
    'united democratic front',
    'aiadmk-led alliance',
    'tvk-led alliance',
    'secular progressive alliance',
    'meghalaya democratic alliance (2018)',
}


def normalize_party(val):
    if not val:
        return val
    v = val.strip()
    if v.lower() in ('independent', 'independent politician', 'independent (politician)'):
        return 'Independent'
    # Rajasthan's own table spells BJP two different ways across different rows
    # (a real inconsistency in the source, not a parsing artifact) -- normalize
    # so the party doesn't get split into two separate `political_parties` rows.
    if v.lower() == 'bhartiya janata party':
        return 'Bharatiya Janata Party'
    return v


# Real party names essentially never contain a digit or describe an event/status --
# remarks like "Won in November 2024 bypoll", "Died on 4 September 2025", "Elected to
# Lok Sabha in June 2024", "Resigned in May 2021" do. When a row's real party cell was
# rowspan-omitted (unchanged from a predecessor with the same party) and nothing but
# remarks is left in that position, this catches it as "not a real party" so the row
# falls through to inheriting current_party instead -- generalizes the same
# rowspan-omission problem beyond just the KNOWN_ALLIANCES case (which only catches it
# when the leftover text happens to name a coalition, not arbitrary remarks text).
REMARKS_LIKE = re.compile(
    r'\bbypoll\b|by-election|\belected\b|\bresigned\b|\bdied\b|disqualifi|expell|\bvacant\b'
    r'|\bsince\b|\bterm\b|deceased|\bwon in\b|\bdefect'
    r'|\bopposed\b|\bsupported\b|\bsuspend|\bswitch(ed)?\b',
    re.IGNORECASE,
)

# Government/legislature position titles, not party names -- some pages (West Bengal)
# put these in the party cell's position for ministers/presiding officers whenever the
# real party was itself omitted via a long-running rowspan (an entire ruling-party-held
# district block sharing one party cell). Treated the same as remarks: reject and fall
# through to inheriting the nearest real party value instead of using the title as if
# it were a party name.
POSITION_TITLE_LIKE = re.compile(
    r"^'''.*'''$|\bcabinet ministers?\b|\bchief ministers?\b|\bspeakers?\b|\bdeputy speakers?\b"
    r"|\bministers?\b|\bministry\b|\bmayors?\b|\bleaders? of the (house|opposition)\b|\bwhips?\b"
    r"|\bmos\b|\bmos\(i/c\)"
    # "List of ..." link targets (e.g. "List of deputy chief ministers of
    # Maharashtra") are always a position/office reference, never a party --
    # catches the whole class regardless of which specific title is inside.
    r"|^list of\b"
    # A within-party office (e.g. "President of Telugu Desam Party", the CM's
    # own title in Andhra Pradesh's table) -- a real party name never itself
    # starts with an office-holder prefix like this, even though the string
    # contains a real party name as a substring. Rejecting and falling through
    # to rowspan inheritance recovers the real party correctly, same as the
    # ministry-title case above.
    r"|^(president|founder|convenor|working president|general secretary) of\b",
    re.IGNORECASE,
)


def looks_like_remarks(val):
    return bool(val) and bool(REMARKS_LIKE.search(val))


def link_text(line):
    m = re.search(r'\[\[([^\]|]+)(?:\|([^\]]+))?\]\]', line)
    if not m:
        return None, None
    # MediaWiki treats underscores in a link target as equivalent to spaces
    # (Mizoram: `[[List_of_leaders_of_the_opposition...|Leader of
    # Opposition]]`) -- left un-normalized, a target chosen over its display
    # text (extract_value's "prefer the longer/canonical one" rule) silently
    # defeats every space-based content check downstream (POSITION_TITLE_LIKE,
    # KNOWN_ALLIANCES, "^list of"), since none of them match run-together
    # underscored text.
    target = m.group(1).replace('_', ' ')
    return target, (m.group(2) or m.group(1)).strip()


KEYWORD_ARG = re.compile(r'^\s*\w+\s*=')


def template_value(line):
    """First *positional* argument of a {{Template|arg1|arg2|...}} call -- skips
    any keyword-style argument (rowspan=N, shortname=X, color=#fff) to find the
    real value, since argument order isn't consistent across states: most put
    `rowspan=N` after the party name (`{{Full party name with color|Bharatiya
    Janata Party|rowspan=7}}`), but Odisha puts it first
    (`{{...|rowspan=7|Bharatiya Janata Party}}`) -- taking "the first argument"
    unconditionally extracted the literal string "rowspan=7" as if it were the
    party name for that state."""
    m = re.search(r'\{\{[^|}]*((?:\|[^|}]*)+)\}\}', line)
    if not m:
        return None
    for arg in m.group(1).split('|'):
        arg = arg.strip()
        if arg and not KEYWORD_ARG.match(arg):
            return arg
    return None


def extract_value(line):
    """Best-effort real value from a cell -- used only for party extraction.
    Usually the wikilink display text is what we want, but Kerala's convention
    for party links is `[[Communist Marxist Party|CMP]]` -- display is the
    *abbreviation*, and the link target holds the real, canonical party name.
    Every other state's party links either have no pipe at all
    (`[[Bharatiya Janata Party]]`, target==display) or a matching display, so
    preferring the longer of the two when they clearly differ (short all-caps
    display vs. a longer, spaced-out target) picks the real name in both cases
    without needing a per-state flag."""
    target, display = link_text(line)
    if target and display and target != display and len(target) > len(display):
        return target, target
    if display:
        return target, display
    tv = template_value(line)
    if tv:
        return None, tv
    return None, line


def strip_noise(text):
    """Citation refs and section-transclusion markers are pure noise for our purposes
    but can otherwise get mistaken for real cell content (e.g. a <ref> block's own
    {{cite web|url=...}} template matching as if it were a party template, or a
    standalone <section end="..."/> tag getting swept into a row's line list)."""
    text = re.sub(r'<ref[^>]*/>', '', text)
    text = re.sub(r'<ref[^>]*>.*?</ref>', '', text, flags=re.DOTALL)
    text = re.sub(r'<section[^>]*/?>', '', text)
    text = re.sub(r'<!--.*?-->', '', text, flags=re.DOTALL)
    # A template's own argument can be wrapped onto a second physical line
    # (Uttarakhand: "{{Full party name with color|\nIndian National
    # Congress}}") -- template_value()'s regex only matches within one line,
    # so the newline would otherwise split it into an unclosed "{{...|" line
    # (leaking the literal template-open text as if it were the party) and a
    # separate, orphaned "Indian National Congress}}" line. Collapse internal
    # newlines within any single (non-nested) {{...}} span before per-line
    # splitting happens.
    text = re.sub(r'\{\{[^{}]*\}\}', lambda m: m.group(0).replace('\n', ' '), text, flags=re.DOTALL)
    return text


CONSTITUENCY_LINK_TARGET = re.compile(r'assembly constituency|vidhan sabha', re.IGNORECASE)

# Arunachal Pradesh has a dedicated "Reserved" column (bare "ST"/"SC" text,
# no brackets) between Constituency and Name -- every other state so far
# embeds the reservation suffix in the constituency name itself
# ("Foo (ST)"), so this column is entirely new and has no home in the
# no/constituency/name/party stage machine. Skipped like a decoration cell
# rather than misread as the Name.
RESERVATION_CODE = re.compile(r'^(ST|SC|OBC|GEN|UR|None|NA)$', re.IGNORECASE)

PARTY_TEMPLATE_START = re.compile(
    r'^\{\{\s*(full party name with col|party name with col|party colou?r)', re.IGNORECASE)


def looks_like_party_template(line):
    """Meghalaya has a within-term party-switch row where No./Constituency/Name
    are ALL rowspan'd together (same MLA, same seat) and only the Party+Alliance
    cells differ between the 'before' and 'after' sub-rows -- the second
    sub-row's very first cell is itself a party-color template, not a name.
    Treated the same as a fully blank/decoration-only cell: inherit the name
    from the row above rather than reading the template text as if it were a
    plain name."""
    return bool(PARTY_TEMPLATE_START.match(line.strip()))


def looks_like_constituency_target(line):
    """Some states (Himachal Pradesh) have no seat-number column at all -- the
    row starts directly with District-or-Constituency, so there's no digit to
    peek at to tell them apart (the trick used for Telangana's plain-text
    District cells). The next-best positional signal: a Constituency cell's
    link target names the constituency itself (`[[X Assembly
    constituency|X]]`), which a District cell's target never does."""
    target, _ = link_text(line)
    return bool(target and CONSTITUENCY_LINK_TARGET.search(target))


def parse_section(text, section_header='Members of Legislative Assembly', party_before_name=False,
                   no_seatno_column=False):
    m = re.search(r'==\s*' + re.escape(section_header) + r'\s*==(.*?)(?=\n==[^=])', text, re.DOTALL)
    section = strip_noise(m.group(1))
    table_m = re.search(r'\{\|[^\n]*wikitable[^\n]*\n(.*?)\n\|\}', section, re.DOTALL)
    table = table_m.group(1)
    rows = table.split('|-')

    records_by_no = {}
    order = []
    current_district = None
    current_no = None
    current_constituency = None
    current_name = None
    current_party = None
    party_rowspan_remaining = 0
    constituency_rowspan_remaining = 0
    seen_first_data_row = False
    auto_no = 0

    for row in rows:
        row = row.strip()
        # Header/caption rows only ever appear before the very first real data
        # row -- once we've seen one, every later chunk is data, full stop, no
        # further header-guessing needed or wanted. This matters because no
        # single per-row heuristic is safe on its own: checking for a leading "!"
        # misfires when a District cell is rowspan-omitted and the seat-number
        # cell (itself "!"-prefixed) becomes the row's first character
        # (Rajasthan, dropped 166/200 seats); checking for "no wikilink/template
        # anywhere" misfires on a genuine rowspan-continuation row whose
        # successor's name happens to be plain, unlinked text (West Bengal's
        # Gosaba seat, silently kept the deceased predecessor's record instead of
        # the current successor's). Restricting either heuristic to
        # "only before the first real data row" avoids both false positives.
        if not row:
            continue
        if not seen_first_data_row and '[[' not in row and '{{' not in row:
            continue
        seen_first_data_row = True
        # "!" and "|" are both valid MediaWiki cell-start markers (a "!" cell is
        # just visually header-styled, same data otherwise) -- some states (Madhya
        # Pradesh) mix them within a single data row, e.g. using "!" for the seat
        # number column specifically.
        # "||" is valid MediaWiki shorthand for multiple cells on one physical
        # line (Gujarat: "| 1 || [[Abdasa Assembly constituency|Abdasa]]" is two
        # cells, No. and Constituency, not one) -- split on it before the normal
        # per-line prefix stripping. Safe to split on the literal "||" substring
        # since real templates/links use single "|" as their own argument
        # separator, never a doubled one.
        raw_lines = [
            re.sub(r'^[|!]+', '', sub).strip()
            for l in row.split('\n') if l.strip()
            for sub in l.split('||')
            if sub.strip()
        ]
        lines = [strip_rowspan(l) for l in raw_lines]

        if len(lines) == 1 and 'vacant' in lines[0].lower():
            continue

        no = None
        constituency = None
        name = None
        party_candidates = []  # content cells seen during the party/alliance stage
        # Set explicitly in the "no fresh seat number found" branch below --
        # deliberately NOT inferred by comparing `no == current_no` after the
        # fact, since `current_no` gets set to `no` unconditionally a few lines
        # down for every row (continuation or not), which would make that
        # comparison vacuously true for every row and inherit `current_party`
        # into any fresh seat whose own party was rejected (position title,
        # remarks, alliance) even when it has nothing to do with the previous
        # seat -- caught via Kerala's Speaker row incorrectly inheriting a
        # neighbouring seat's party instead of correctly staying unset.
        is_continuation = False

        if no_seatno_column and constituency_rowspan_remaining > 0:
            # No seat-number column exists (Himachal Pradesh), and this row is
            # a same-seat succession (resignation/bypoll pair) sharing a
            # rowspan'd Constituency cell -- the row's first cell is directly
            # the successor's Name, not a fresh Constituency. Reuse the seat
            # rather than minting a new number for what both rows agree is
            # one seat.
            no = current_no
            constituency = current_constituency
            is_continuation = True
            constituency_rowspan_remaining -= 1
            stage = 'name'
        else:
            stage = 'no'

        for idx, (raw_line, line) in enumerate(zip(raw_lines, lines)):
            if not line:
                # A blank Name cell is a genuinely vacant seat (Puducherry's
                # Thattanchavady: the winner chose to represent a different
                # constituency instead). Silently `continue`-ing past it (as
                # for any other empty cell) would leave `stage` at 'name' and
                # let the NEXT non-empty cell -- the Party cell -- be
                # misread as the name, shifting every following cell over by
                # one position. Advance the stage explicitly instead, same as
                # the existing 'vacant' text handling below, so `name` stays
                # correctly unset and the row is dropped (no `name` means no
                # record) rather than corrupted.
                if stage == 'name':
                    stage = 'done' if party_before_name else 'party'
                continue
            target, display = link_text(line)

            # A district cell's link target usually contains "district", but not
            # always (Karnataka links some districts by bare name, e.g. "Uttara
            # Kannada", no "district" suffix at all). One reliable signal is the
            # RAW (pre-rowspan-strip) line carrying a fresh `rowspan=` attribute
            # -- a true rowspan continuation's first cell never has one (it's
            # absent precisely because it was rowspan'd away). But some states
            # (Telangana) don't link the District cell at all -- it's plain text,
            # sometimes with no rowspan either (a district contributing only one
            # seat has nothing to span). The general signal that covers this too:
            # whatever cell immediately precedes the seat-number digit cell, in
            # the 'no' stage, is the District, regardless of whether it's a link,
            # plain text, or rowspan'd -- checked by peeking at the next cell
            # rather than requiring a link target.
            is_freshly_rowspanned = raw_line != line
            next_line = lines[idx + 1] if idx + 1 < len(lines) else None
            next_is_seatno = bool(next_line and re.fullmatch(r'\d+\.?', next_line))
            next_is_constituency = bool(next_line and looks_like_constituency_target(next_line))
            is_seatno_itself = bool(re.fullmatch(r'\d+\.?', line))
            # A freshly rowspan'd Constituency cell (Himachal Pradesh: a
            # resignation/bypoll pair sharing one seat, `rowspan=2|[[Hamirpur
            # (...Assembly constituency)|Hamirpur]]`) must never be mistaken
            # for a District cell just because it's rowspan'd -- the target
            # itself tells them apart.
            is_constituency_shaped = bool(target and looks_like_constituency_target(line))
            looks_like_district = not is_seatno_itself and not is_constituency_shaped and (
                (target and 'district' in target.lower())
                or is_freshly_rowspanned
                or next_is_seatno
                or (no_seatno_column and next_is_constituency)
            )
            if stage == 'no' and looks_like_district:
                current_district = display if target else line
                continue

            if stage == 'no' and no_seatno_column and is_constituency_shaped and is_freshly_rowspanned:
                declared = get_rowspan_count(raw_line)
                if declared:
                    constituency_rowspan_remaining = declared - 1

            if stage == 'no' and no_seatno_column:
                # No seat-number column exists at all (Himachal Pradesh) --
                # every row is a genuinely new constituency (this table shape
                # has no same-seat-succession rows to worry about), so just
                # assign sequential numbers in source order. This cell isn't a
                # separate numbered cell to discard -- it's already the
                # constituency itself, so fall through into the
                # 'constituency' stage for this same line rather than
                # `continue`-ing past it.
                auto_no += 1
                no = str(auto_no)
                stage = 'constituency'
                # fall through, this line is the constituency

            elif stage == 'no':
                # Punjab has a stray trailing period on one seat number ("115.")
                # -- strip it before the digit check rather than requiring an
                # exact `\d+` match.
                no_match = re.fullmatch(r'(\d+)\.?', line)
                if no_match:
                    no = no_match.group(1)
                    stage = 'constituency'
                    continue
                no = current_no
                constituency = current_constituency
                is_continuation = True
                if is_pure_decoration(line):
                    name = current_name
                    stage = 'party'
                    continue
                if looks_like_party_template(line):
                    # This cell is real party data, not decoration -- inherit
                    # the name but let THIS line fall through into 'party'
                    # stage processing (no `continue`) so its value becomes
                    # the first party candidate instead of being discarded.
                    name = current_name
                    stage = 'party'
                else:
                    stage = 'name'
                # fall through, this line is the name

            if stage == 'constituency':
                # Whatever immediately follows "no" is the constituency, regardless
                # of whether its link target is disambiguated with "(Assembly
                # constituency)"/"(Vidhan Sabha constituency)" -- some states (West
                # Bengal) link constituencies with a plain place-name target and no
                # such suffix at all, so content-pattern matching alone would miss
                # them; position right after "no" is a reliable-enough signal here.
                constituency = display if target else line
                stage = 'party' if party_before_name else 'name'
                continue

            if stage == 'party':
                # Madhya Pradesh's party_before_name table has only ONE party
                # cell (no separate Alliance column, despite the header's
                # `colspan="2"` visually merging two columns' width) --
                # waiting for 2 candidates before transitioning to Name (the
                # non-party_before_name convention, correct for a real
                # Party+Alliance pair) would silently swallow the real Name
                # cell as a second "party candidate" and never reach 'name'
                # at all, dropping every otherwise-clean row.
                party_threshold = 1 if party_before_name else 2
                if len(party_candidates) >= party_threshold:
                    # Party/Alliance columns exhausted. In party_before_name order
                    # this line is the still-unconsumed Member name -- fall through
                    # (no `continue`) to the 'name' block right below so it gets
                    # processed this same iteration, not skipped.
                    if party_before_name and name is None:
                        stage = 'name'
                    else:
                        continue
                else:
                    if is_pure_decoration(line):
                        continue
                    rest = strip_attr_prefix(line)
                    if rest == '':
                        continue
                    _, val = extract_value(rest if rest != line else line)
                    if val:
                        # Keep the *raw* cell text alongside the extracted value --
                        # a wikilink can sit inside a longer remarks sentence
                        # ("Elected in by-election necessitated after death of
                        # [[Yogesh Patel]]."), and checking only the isolated
                        # link's display text ("Yogesh Patel") for
                        # remarks-likeness misses the surrounding "Elected...
                        # death of" context that would otherwise flag it.
                        party_candidates.append((val, rest))
                    continue

            if stage == 'name':
                if is_pure_decoration(line):
                    continue
                if RESERVATION_CODE.fullmatch(line.strip()):
                    continue
                if 'vacant' in line.lower():
                    name = None
                    stage = 'done'
                    continue
                name = display if target else strip_leading_attrs(line)
                stage = 'done' if party_before_name else 'party'
                continue

        # Only the FIRST content cell after name can ever be the party -- never scan
        # further candidates. If it's a known alliance name, the real party cell was
        # itself rowspan-omitted (unchanged from a prior row) and whatever comes
        # next positionally is remarks, not a real alliance/party value -- leave
        # party unset here and resolve via inheritance below, rather than
        # mis-reading a shifted-over remarks cell as the party.
        party = None
        first_raw = None
        if party_candidates:
            first_val, first_raw = party_candidates[0]
            if (first_val.strip().lower() not in KNOWN_ALLIANCES
                    and not looks_like_remarks(first_val)
                    and not looks_like_remarks(first_raw)
                    and not POSITION_TITLE_LIKE.search(first_val)):
                party = normalize_party(first_val)

        if no:
            current_no = no
        if constituency:
            current_constituency = constituency
        if name:
            current_name = name

        if party is not None:
            # A real party was found this row. If its own cell declared a
            # rowspan, that's an authoritative count of how many *following*
            # rows (this one plus N-1 more) legitimately share it -- track it
            # precisely instead of guessing row-by-row, so a later row's
            # position getting occupied by unrelated content (Kerala: a
            # "Speaker" link landing inside what should have been an empty
            # rowspan'd cell, still within its declared span) doesn't wrongly
            # block inheritance that the source itself declared as valid.
            declared = get_rowspan_count(first_raw) if first_raw else None
            party_rowspan_remaining = (declared - 1) if declared else 0
            current_party = party
        elif party_rowspan_remaining > 0:
            party = current_party
            party_rowspan_remaining -= 1
        elif (not party_candidates or is_continuation) and current_party:
            # Fallback for same-seat successions with no explicit rowspan count
            # on the party cell at all (Maharashtra's Rahuri: the whole party
            # column was omitted outright, not rowspan-attributed) -- still
            # safe to inherit specifically because it's a genuine continuation
            # of the exact same seat, not an unrelated neighbour.
            party = current_party

        if no and constituency and name:
            if no not in records_by_no:
                order.append(no)
            records_by_no[no] = {
                'district': current_district,
                'no': no,
                'constituency': constituency,
                'name': name,
                'party': party,
            }

    return [records_by_no[n] for n in order]


if __name__ == '__main__':
    raw_path = sys.argv[1]
    out_path = sys.argv[2]
    expected_total = int(sys.argv[3]) if len(sys.argv) > 3 else None
    section_header = sys.argv[4] if len(sys.argv) > 4 else 'Members of Legislative Assembly'
    party_before_name = len(sys.argv) > 5 and sys.argv[5] == 'party_before_name'
    no_seatno_column = len(sys.argv) > 5 and sys.argv[5] == 'no_seatno_column'

    text = open(raw_path).read()
    records = parse_section(text, section_header, party_before_name=party_before_name,
                             no_seatno_column=no_seatno_column)
    print(f"Total records parsed: {len(records)}")
    no_party = [r for r in records if not r['party']]
    print(f"No party: {len(no_party)}")
    for r in no_party:
        print(' ', r)

    if expected_total:
        nos = set(int(r['no']) for r in records if r['no'] and r['no'].isdigit())
        missing = sorted(set(range(1, expected_total + 1)) - nos)
        print(f"Missing seat numbers ({len(missing)}): {missing}")

    json.dump(records, open(out_path, 'w'), indent=2)
