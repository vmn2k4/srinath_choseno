# Google Play listing — Choseno (draft copy)

Limits: title 30, short description 80, full description 4,000 chars. Play has no keyword field, so keywords must read naturally in the copy.

**App name (30/30):** `Choseno: Your Reps & Elections`

**Short description (77/80):** `Social media for local politics: talk issues with neighbours, rate your reps.`

**Category:** Social (primary experience is ratings, discussion, sharing). Alt: News & Magazines only if editorial content becomes primary. Tags: pick only the closest options Play offers.

**Full description:**

IMPORTANT: Choseno is an independent app. It is NOT affiliated with, endorsed by, or operated by any government, government agency, elected official, or political party, and it does not provide official government services.

Choseno is social media for local politics: discuss your local issues with your neighbours, review your elected representatives, and follow the elections near you.

Find my representatives: enter your address and see the officials who represent you, from city council to the legislature, in seconds. See who is running in your area, rate your politicians, and join the conversation with your neighbours.

FIND YOUR REPRESENTATIVES
Use your address or location to see your electoral districts and the elected officials for each one, laid out as a simple tree from local government up to state/provincial and federal legislatures in the US and Canada.

WHO IS RUNNING IN MY AREA?
See the local elections and open races in your riding, ward or district, browse the candidates on your ballot, read their pitches and priorities, and find where to vote.

RATE POLITICIANS AND SHARE YOUR VIEWS
Give elected officials feedback with ratings, read what others think, and react to posts and comments on each politician's public wall.

SHARE THE CANDIDATES YOU BACK
Pick who you support in each race and share your picks so friends and neighbours can discover who is on the ballot.

FOLLOW CIVIC NEWS
Short articles tied to the places and officials they affect, covering housing, transit, schools and local services.

PARTICIPATE YOUR WAY
Choseno lets you take part without displaying your real name publicly. See our privacy policy for how account information is handled.

FOR CANDIDATES AND OFFICIALS
Claim your public wall, share your platform and hear directly from the people you represent.

OFFICIAL SOURCES
Representative, district and election information comes from public sources and may be incomplete or out of date. For official information, check the source directly:
Elections Canada: https://www.elections.ca
House of Commons: https://www.ourcommons.ca
Elections BC: https://elections.bc.ca
Elections Alberta: https://www.elections.ab.ca
Elections Ontario: https://www.elections.on.ca
US Federal Election Commission: https://www.fec.gov
US House: https://www.house.gov
US Senate: https://www.senate.gov
Vote.gov: https://vote.gov

Choseno is not a government app and does not represent any government entity.

Wording note: say "without displaying your real name publicly", never "anonymous" — accounts store email and location.

## Required Play Console answers
- Contact email: chosenopolicyvoices@gmail.com (must be monitored)
- Privacy policy: https://www.choseno.com/privacy (verify it matches real data practices)
- App access: supply working reviewer credentials and instructions.
- Ads: No, only if no ad SDK serves ads.
- Content rating: IARC questionnaire; declare user-generated content and political discussion.
- Data safety: audit SDKs first. Collected: email, user IDs, approximate/precise location, user-generated content, app interactions; encrypted in transit; deletion available.
- Not affiliated with any government; no impersonation of officials.

## Launch blockers — built, awaiting deploy/verification
1. **Account deletion:** app (Profile → Delete account) and web page `/delete-account` call RPC `delete_my_account` (migration 20261014000000, applied). Play deletion URL: https://www.choseno.com/delete-account (live after the web deploy). Content under burned ghost ids cannot be linked to a user and stays; disclosed in the dialog and the page.
2. **UGC safeguards:** terms acceptance before first post/comment, Report (post/comment, existing `report_content` + moderation queue), Block author (`block_author`, keyed by ghost id; lapses if the author burns their identity).

## Graphics
- Icon 512×512 (from the web logo; no tiny text or party imagery).
- Feature graphic 1024×500: "Know your representatives. Make your voice count."
- 6 real-app phone screenshots in this order: Representatives lookup, elections, candidate profile, ratings, discussion/wall, share picks.

## Play Console fill-in order (organization account — no 12-tester rule)
1. Create app: name from above, English (Canada), App, Free; accept declarations.
2. Dashboard → App content: Privacy policy `https://www.choseno.com/privacy`; App access (give test citizen login); Ads = No; Content rating (UGC + political discussion); Target audience 18+; Data safety (per answers above); Data deletion = `https://www.choseno.com/delete-account`; Government apps = No; News app = No.
3. Store listing: Social category; short + full description; icon `store_assets/play/icon-512.png`; feature graphic; the six screenshots in numeric order; contact email.
4. Production (or Internal testing first) → Create release → upload `build/app/outputs/bundle/release/app-release.aab` → enrol in Play App Signing (the keystore is the upload key; back up `~/choseno-keys/choseno-upload.jks`) → save as draft, do not submit until reviewed.
5. Add the Play App Signing SHA-1 as an Android OAuth client in Google Cloud so Google sign-in works for the store build.
