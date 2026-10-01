# Professional Email Templates

This directory contains professional HTML email templates for outreach to BC municipal officials.

These files are the **source of truth for the design**. They're also embedded verbatim (bracket placeholders swapped for `{{merge_tags}}`) in [`src/lib/utils/campaignTemplates.ts`](../src/lib/utils/campaignTemplates.ts), which is what actually gets sent from the admin panel — if you change the design or copy, edit the `.html` files here first, then copy the same change into `campaignTemplates.ts` so the two don't drift apart.

## Templates

### `mayor-professional.html`
Professional email template for mayors with:
- Clean, modern typography
- Visual hierarchy with blue accents
- Emphasis on mayoral leadership record
- Three organized "ways to get started"

**Placeholders to customize:**
- `[Name]` — Mayor's name
- `[City]` — Municipality name
- `[wall_slug]` — Their wall URL slug (e.g., `brenda-locke-mayor`)

### `councillor-professional.html`
Professional email template for councillors with:
- Same professional design as mayor template
- Emphasis on voting record and council representation
- Same customization placeholders

### `mla-candidate-interview.html`
Invitation for BC provincial election (MLA) candidates to a free video interview, in person or self-recorded. Same design as `candidate-nominee.html`. Includes the 11 interview questions inline (copied from the `election_questions` rows for the 2026 BC Provincial Election — re-copy if those change). Loaded in `/admin/campaign` as **MLA Candidate Interview**. The printable questionnaire lives in `docs/candidate-outreach/`.

**Placeholders:** `{{name}}`, `{{city}}` (put the candidate's riding here), `{{wall_slug}}` (required — the **View Your Choseno Profile** button links to `/wall/{{wall_slug}}`, which the send flow tracks), `{{claim_link}}` (the **Register & Upload Your Videos** button; generated per recipient at send time)

**Also sent from the election seat page.** When a seat admin invites a candidate from an election seat page ("Search & Send Interview Invite" / "Invite Candidates to Claim"), the email comes from the `auth-send-email` Edge Function, not from `/admin/campaign`. Which email it sends is set per election by `elections.invite_email_template`; `bc_mla` (the 2026 BC Provincial Election) uses a copy of this design in `supabase/functions/auth-send-email/electionInviteTemplates.ts`, with the single-use claim link as the main button. Elections with no template set get the standard claim-invite email. Keep the copy in sync with this file when the wording changes. To add another election's email, add a builder to that file's `BUILDERS` and set the election's `invite_email_template` to its key.

## Sending emails

### The actual send tool: `/admin/campaign`

This is the only supported way to send these — not a script, not copy-paste into Gmail. In the admin panel:

1. Under **"1. Import recipients"**, either paste CSV/JSON, upload a file, or click **Search politicians & office holders** to find someone already on Choseno (reuses the nav-bar search) and add them with one click — this also pre-fills their wall slug and looks up their contact email.
2. Under **"2. Compose the email"**, click the **Mayor — Choseno wall** or **Councillor — Choseno wall** template button to load the matching subject/body.
3. Each recipient row has editable **Email** and **Wall slug** fields — fix a missing email, or type in a wall slug if the search didn't find one. A guessed slug that doesn't match a real profile 404s, so this is never auto-filled with a guess.
4. Click **Preview** on a row to see the rendered email before sending, then **Send** (or **Send all**).

Every send is logged to the `politician_claim_campaigns` table and shows up in the campaign history at the bottom of the page.

### If you need to send outside the admin panel

The templates are plain HTML — read the file and pass it as the `html` field to the `send-email` Supabase function (see [`src/lib/services/email.ts`](../src/lib/services/email.ts) for the client-side wrapper, which is preferable to a raw `curl` since it goes through your authenticated Supabase session instead of a hand-copied token):

```ts
import { sendEmail } from "@/lib/services/email";

await sendEmail(supabase, {
  to: "mayor@example.com",
  subject: "Your Mayor Wall is Ready on Choseno — Connect with Example City Voters This Election",
  html: htmlFileContents, // with [Name]/[City]/[wall_slug] already replaced
  replyTo: "vijay@choseno.com",
});
```

## Design features

- **Typography**: System fonts for maximum compatibility
- **Color scheme**: Professional blue (#3b82f6) accents with dark text
- **Layout**: 680px white card on a light gray page background, with a `@media (max-width: 700px)` rule that goes edge-to-edge on phones — see [OUTREACH_GUIDE.md §4c](../OUTREACH_GUIDE.md) for the reasoning
- **Visual hierarchy**: Clear sections with generous whitespace
- **Email client support**: Renders well in Gmail, Apple Mail, and mobile clients with full CSS support; degrades gracefully (loses the rounded-corner card look, keeps all content readable) in clients with weaker CSS support like Outlook desktop

## Customization

All templates are fully customizable HTML. Common edits:

- **Change accent color**: Replace `#3b82f6` with your preferred blue
- **Adjust spacing**: Modify `margin` and `padding` values
- **Change fonts**: Update the `font-family` in the `<style>` section
- **Add logo**: Insert an image tag in the header section

After editing a `.html` file here, copy the same change into `campaignTemplates.ts` (see the note at the top of this file) — otherwise the admin panel keeps sending the old version.

## Testing before a real campaign

1. In `/admin/campaign`, add yourself as a test recipient (paste a one-row CSV, or search for your own name if you have a profile) with your own email
2. Load the Mayor or Councillor template and hit **Preview**
3. Send it to yourself and open it in Gmail and, if possible, Outlook/Apple Mail
4. Verify the wall link actually resolves (not a 404) and mobile rendering looks right

## Delivery notes

HTML sends silently failed to arrive before 2026-08-19 — the underlying `send-email` function had a MIME encoding bug (declared the body as 7-bit ASCII while the templates contain real UTF-8 characters like `—` and `✓`), which many mail servers accept at the SMTP level and then quarantine rather than deliver. That's fixed now (base64 body encoding + real SMTP response-code checks). See [OUTREACH_GUIDE.md §4d](../OUTREACH_GUIDE.md) for the full writeup if HTML delivery ever silently breaks again.

See [`OUTREACH_GUIDE.md`](../OUTREACH_GUIDE.md) for full outreach strategy and contact lists.
