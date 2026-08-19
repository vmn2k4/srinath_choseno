# Choseno - BC Municipal & Candidate Outreach Playbook

This document contains the complete outreach strategy, pitch templates, social media copy, and contact directories for connecting with BC Mayors, Councillors, Civic Parties, and Election Candidates.

---

## 1. Contact CSV Directories

- **Civic Parties Contact List**: [`scripts/bc-civic-parties-contacts.csv`](file:///Users/vmn2k4/Coding/Choseno/scripts/bc-civic-parties-contacts.csv)
  *Contains 20 official BC Municipal Elector Organizations (ABC Vancouver, Surrey Connect, Burnaby Citizens Association, Contract with Langley, etc.) with websites, contact emails, cities, and elected representative counts.*

- **Mayors & Councillors Contact List**: [`scripts/bc-municipal-outreach.csv`](file:///Users/vmn2k4/Coding/Choseno/scripts/bc-municipal-outreach.csv)
  *Contains **268 active BC Municipal Mayors & Councillors** across 34 BC municipalities with role titles, city names, party affiliations, contact emails, phones, and source URLs.*

---

## 2. How to Get Accurate Wall Slugs

**Before generating outreach emails, you must get the accurate wall slug for each person.**

The `/admin/campaign` tool (section 4 below) has a **Wall slug** field on every recipient row — pre-filled automatically when you add someone via **Search politicians & office holders**, or type it in by hand otherwise. It's never guessed for you: a slug that doesn't match a real profile 404s, so this stays a manual/verified field rather than something the send flow invents.

See [`docs/WALL_SLUG_GENERATION.md`](docs/WALL_SLUG_GENERATION.md) for complete details on:
- How wall slugs are generated (`buildPoliticianWallSlug()` function)
- How to query them from the database
- How to predict them if the profile doesn't exist yet
- Troubleshooting 404s and slug mismatches

**Quick lookup for Surrey (example):**
```sql
SELECT p.full_name, pp.political_target_role, pp.wall_slug
FROM profiles p
JOIN politician_profiles pp ON p.id = pp.id
WHERE pp.target_boundary_name = 'Surrey'
ORDER BY p.full_name;
```

For Harry Bains, this returns: `wall_slug = "harry-bains-councillor"`

---

## 3. Required Information & Data Sources

Before sending outreach emails, gather the following information:

### Candidate/Contact Information
- **Source**: Use the CSV contact directories in section 1:
  - For Mayors & Councillors: `scripts/bc-municipal-outreach.csv`
  - For Civic Party leaders: `scripts/bc-civic-parties-contacts.csv`
- **Required fields**:
  - Candidate/Party name
  - Email address
  - Role title (e.g., "Mayor", "City Councillor", "Party Chair")
  - City/District/Municipality

### Candidate Wall Information
- **Wall URL slug**: Generated when a candidate profile is created in Choseno
  - Format: `https://www.choseno.com/wall/[wall_slug]`
  - Obtain from: Choseno admin dashboard or candidate management system
  - If not yet created, create the profile first before outreach

### Sender Information (Fill in placeholders in template)
- **[Your Name]**: Full name of outreach contact
- **[Your Phone Number]**: Direct contact phone number
- **[Your Email Address]**: Reply-to email address (suggest: chosenopolicyvoices@gmail.com)
- **Calendly URL**: Pre-scheduled calendar link for demos (suggest: https://calendly.com/vmn2k4/30min)

### Geographic Information
- **[City/District]**: The municipality or electoral district
  - Obtain from: Candidate's location in CSV or Choseno profile
- **Lower Mainland coverage**: Verified available for coffee meetings in major BC municipalities (Vancouver, Surrey, Burnaby, Coquitlam, Richmond, Langley, New Westminster, Port Coquitlam, etc.)

---

## 4. Professional HTML Email Templates (Recommended for Production)

**Status**: These are the current production-ready templates with professional typography, visual hierarchy, and reduced clutter. Use these for all new outreach campaigns.

**Source files**: [`email-templates/mayor-professional.html`](file:///Users/vmn2k4/Coding/Choseno/email-templates/mayor-professional.html) and [`email-templates/councillor-professional.html`](file:///Users/vmn2k4/Coding/Choseno/email-templates/councillor-professional.html) — edit these first if the design or copy needs to change; everything below is a copy of them.

**Sending them**: `/admin/campaign` in the admin panel is the actual send tool. Under "2. Compose the email" click the **Mayor — Choseno wall** or **Councillor — Choseno wall** template button to load the matching subject/body — it's the same markup as the source files above, copied verbatim into [`src/lib/utils/campaignTemplates.ts`](file:///Users/vmn2k4/Coding/Choseno/src/lib/utils/campaignTemplates.ts) with the bracket placeholders swapped for merge tags. Recipients can be added three ways: paste CSV/JSON, upload a file, or click **Search politicians & office holders** to find someone already on Choseno (reuses the same nav-bar search) and add them with one click. Each row has an editable **Wall slug** field — pre-filled from the search result or CSV when available, otherwise typed in by hand — since a guessed slug that doesn't match a real profile 404s.

### 4a. Mayor Email Template (HTML)

**Subject**: Your Mayor Wall is Ready on Choseno — Connect with [City] Voters This Election

The HTML template includes:
- Professional system font typography with proper hierarchy
- Light blue highlight box for wall URL
- Three organized "ways to get started" (instead of bullet list)
- Role-specific benefits (emphasizes mayoral leadership record)
- Clean signature section with contact info and LinkedIn

**Key improvements over plain text**:
- Better visual spacing and readability
- Professional color scheme (dark blue text, blue accents)
- Organized sections that reduce cognitive load
- Role-specific value propositions for Mayor vs Councillor

### 4b. Councillor Email Template (HTML)

**Subject**: Your Councillor Wall is Ready on Choseno — Connect with [City] Voters This Election

Same professional design as Mayor template with role-specific adjustments:
- Emphasizes voting record and council representation
- Tailored benefits for councillor role
- Identical visual structure for consistency

**Placeholders**: `[Name]` → `{{name}}`, `[City]` → `{{city}}`, `[wall_slug]` → `{{wall_slug}}` (also available as the full link, `{{wall_url}}`).

### 4c. Layout — wide, responsive card

The email body is a 680px white card centered on a light gray page background, with a `@media (max-width: 700px)` rule that strips the border/radius/outer padding so it goes edge-to-edge on phones instead of leaving cramped margins. Nothing in the layout uses a fixed pixel width (only `max-width`), so even in clients that ignore the media query (older Outlook desktop, mainly) the content still reflows to fit — the only loss there is the rounded-corner "card" polish, not readability.

### 4d. Delivery — why HTML sends used to silently fail

Before 2026-08-19, `supabase/functions/send-email` sent the HTML body with no declared `Content-Transfer-Encoding` (MIME defaults that to `7bit`, i.e. "this is pure ASCII") while the templates contain real UTF-8 characters (the em dash `—`, the checkmark `✓`). That MIME violation, plus the body going out as one unbroken multi-KB line instead of proper CRLF-terminated lines, is the kind of malformed message many receiving/relay servers accept at the SMTP level — still a `250 OK`, which is why the admin panel showed "sent" — and then silently drop rather than deliver. Plain-text sends never hit this because they contain no non-ASCII bytes.

Fixed by base64-encoding the body (sidesteps both the encoding and line-length problems at once) and by actually checking SMTP response codes after AUTH/MAIL FROM/RCPT TO/DATA instead of trusting "the connection didn't throw." A rejected send now surfaces as a real error in the admin panel.

---

## 4e. Plain Text Email Template (Legacy - for reference only)

Use this only if recipients require plain text or for historical reference.

> **Subject**: Your Wall is Ready on Choseno — Connect with [City/District] Voters This Election
>
> Hi [Candidate/Party Name],
>
> We're launching Choseno for the 2026 municipal election cycle — a Canadian civic platform built to give local voters a centralized, side-by-side way to compare platforms, read updates, and engage with candidates.
>
> With a single postal code or address lookup at https://www.choseno.com/find-my-district, voters instantly discover their electoral boundaries at every level (municipal, provincial, federal) and see who represents them. Choseno is the only platform that has simplified this — no more confusion about districts and representatives.
>
> Your wall on Choseno is now live — this is where voters will see your policies, endorsements, and supporter testimonials:
> https://www.choseno.com/wall/[wall_slug]
>
> Early candidates who join now get a head start building their profile before the race heats up. You'll gain high visibility when residents search for your district, while others are still deciding. Start gathering endorsements, posting your vision, and building name recognition today.
>
> Your wall allows you to:
>
> * Publish policy positions, campaign updates, and your core vision
> * Let supporters post testimonials — authentic voices from people who back you
> * Connect directly with voters actively seeking verified candidate information
>
> (See a live layout example here: https://www.choseno.com/elections/seat/u-s-representative-congressional-district-2-f35433)
>
> ### Three Ways to Get Started
>
> * Quickest (30 seconds): Just reply directly to this email with your preferred contact address, and I'll verify and activate your wall within 24 hours.
> * Connect Directly: Simply reply to let me know when you or someone from your team would like to connect to review the platform.
> * Live Demo or In-Person Meeting (15–30 minutes): Pick a quick time via Calendly (https://calendly.com/vmn2k4/30min), or let me know if you'd prefer to meet in person in [City/Region] or the Lower Mainland to discuss strategy.
>
> ### Why I Built This
>
> After 10+ years engineering core software at Snapchat, Qualcomm, and AMD in Silicon Valley, I moved to BC, became a Canadian citizen, and built Choseno to strengthen local democracy—100% Canadian-owned civic tech, independent of foreign social media giants.
>
> **Next Step:** Simply reply to this email, and I'll get your profile verified and ready within 24 hours.
>
> Warm regards,
>
> Murugappan Valliyappan
> Founder, Choseno
> Lower Mainland, BC
> 672-355-2636 | vijay@choseno.com
> https://www.linkedin.com/in/muruvalliyappan/

---

## 5. Social Media Share Copy for Candidates / Parties

Candidates and civic parties can post this draft on their official Facebook pages, Instagram, or X:

> *Want to know who represents you at the City, Provincial, and Federal levels?*
>
> Check out **Choseno** — a great new civic platform built right here in BC! With just one click, you can enter your address or postal code to find your exact district boundaries, see active election seats, and connect directly with our official updates:
>
> **Find Your District**: https://www.choseno.com/find-my-district
> **Follow My Official Page**: https://www.choseno.com/wall/[wall_slug]
>
> #BCpolitics #SurreyBC #Vancouver #LocalGov #CivicTech #Choseno

---

## 6. In-Person Coffee Demo Playbook (Lower Mainland)

- **Preferred Times**: Any weekday between **10:00 AM and 4:00 PM**.
- **Coverage Area**: Vancouver, Surrey, Burnaby, Coquitlam, Richmond, Langley, New Westminster, Port Coquitlam, and surrounding Lower Mainland cities.
- **Location Options**:
  - Candidate's preferred coffee shop or café.
  - Local campaign office or City Hall.
  - Your office/home (if they prefer).
- **Demo Agenda**:
  1. Show official wall page (`/wall/[wall_slug]`) — their platform, posts, supporter endorsements.
  2. Show 1-Click Constituency Finder (`/find-my-district`) — how voters discover them.
  3. Show central Election Wall (`/elections`) — how their race is positioned vs. other candidates.
  4. **Verify their profile on the spot** — confirm email, role title, district, and photo.
  5. Walk through posting/engagement workflow — how to add campaign updates.
  6. **Ask for warm intros** — other local candidates, party members, allied organizations they'd recommend connecting with.
  7. **Leave them with:**
     - A printed QR code linking to their wall.
     - Email with setup guide and next steps.
     - Your contact info for follow-up questions.
