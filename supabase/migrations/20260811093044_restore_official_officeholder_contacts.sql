-- Restore only publicly documented office contact data.  Do not populate
-- direct email addresses when the official site provides a contact form
-- instead.
UPDATE public.office_holders
SET contact_phone = '360-902-4111',
    updated_at = now()
WHERE full_name = 'Bob Ferguson'
  AND source_url = 'https://governor.wa.gov'
  AND NULLIF(btrim(contact_phone), '') IS NULL;
