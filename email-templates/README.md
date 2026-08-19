# Professional Email Templates

This directory contains professional HTML email templates for outreach to BC municipal officials.

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

## Sending Emails

### Quick Start (Recommended)

Run the included Node.js script from the project root:

```bash
node scripts/send-professional-emails.js
```

This will send both templates as test emails to `vmn2k4@gmail.com` to verify rendering.

### Manual Approach

If you prefer to send individually or customize further:

1. **Copy the HTML** from the template file
2. **Replace placeholders:**
   - `[Name]` → Mayor/Councillor's name
   - `[City]` → Municipality
   - `[wall_slug]` → Their wall URL slug
3. **Send via your email client** or Supabase function

### Via Supabase (Advanced)

To send directly via Supabase without the script:

```bash
curl -X POST https://xqwvqrwovvpnbxfdwgpq.supabase.co/functions/v1/send-email \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "recipient@example.com",
    "subject": "Your Wall is Ready on Choseno",
    "html": "<paste-html-here>",
    "replyTo": "vijay@choseno.com"
  }'
```

## Design Features

- **Typography**: System fonts for maximum compatibility
- **Color Scheme**: Professional blue (#3b82f6) accents with dark text
- **Visual Hierarchy**: Clear sections with generous whitespace
- **Email Client Support**: Renders well in Gmail, Outlook, Apple Mail, and most clients
- **Mobile Friendly**: Responsive design for all screen sizes

## Customization

All templates are fully customizable HTML. Common edits:

- **Change accent color**: Replace `#3b82f6` with your preferred blue
- **Adjust spacing**: Modify `margin` and `padding` values
- **Change fonts**: Update the `font-family` in the `<style>` section
- **Add logo**: Insert an image tag in the header section

## Testing

Before sending to actual candidates:

1. Run `node scripts/send-professional-emails.js`
2. Check emails in your test inbox (`vmn2k4@gmail.com`)
3. Open in multiple email clients (Gmail, Outlook, Apple Mail)
4. Verify all links work (especially `[wall_slug]` links)
5. Check mobile rendering

## Email Client Compatibility

These templates are tested and work well in:
- Gmail (web and app)
- Outlook (web and desktop)
- Apple Mail
- Thunderbird
- Mobile clients (iOS Mail, Gmail App)

## Next Steps

1. **Test**: Run the script and preview emails
2. **Customize**: Add recipient names and wall slugs
3. **Batch Send**: Use Supabase function or your email client to send at scale
4. **Track**: Monitor open rates and replies

See `OUTREACH_GUIDE.md` for full outreach strategy and contact lists.
