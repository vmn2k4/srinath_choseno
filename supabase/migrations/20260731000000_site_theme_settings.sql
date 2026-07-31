-- Site-wide color theme, admin-controlled. A single row (id fixed to 1)
-- storing which named palette (defined in src/index.css's [data-theme]
-- blocks) is currently active. Every visitor -- including logged-out ones
-- on the home/auth pages -- reads this on load, so it must stay publicly
-- readable; only admins can change it.
CREATE TABLE public.site_settings (
  id SMALLINT PRIMARY KEY DEFAULT 1,
  theme TEXT NOT NULL DEFAULT 'peach-amber',
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT site_settings_single_row CHECK (id = 1)
);

INSERT INTO public.site_settings (id, theme) VALUES (1, 'peach-amber');

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read site settings" ON public.site_settings
  FOR SELECT USING (true);

CREATE POLICY "Admins can update site settings" ON public.site_settings
  FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
-- No insert/delete policy: the single row is seeded by this migration;
-- nothing else should ever add or remove rows from this table.
