-- Drops the 12 orphaned staging_<uuid> tables locked down in
-- 20260818000007_lock_down_orphaned_staging_import_tables.sql. Confirmed via
-- repo-wide grep that nothing in the app, supabase/functions, or scripts/
-- references these table names -- they are raw ogr2ogr scratch tables from
-- completed boundary shapefile imports (data already merged into
-- map_shapes), reclaiming ~409 MB. User confirmed drop (not archive) on
-- 2026-08-18.
drop table if exists public.staging_02e12091_be48_48f8_8979_9f5be3caf140;
drop table if exists public.staging_10b24603_365c_4aee_9fee_06355f94937c;
drop table if exists public.staging_10deedbd_96a8_4f16_a7b7_4cd68192f7c5;
drop table if exists public.staging_15325420_74e4_456d_b3be_451a3fd64e64;
drop table if exists public.staging_2da215a6_3363_4661_b1b1_5de4fbf129ad;
drop table if exists public.staging_3ca4898a_241b_4fa2_9fc8_e7f6b481ce90;
drop table if exists public.staging_6e8a5bc6_f1e5_4ded_82e1_991774158def;
drop table if exists public.staging_7360e4a2_e1ae_4f1f_87f1_a1cf0ecf0959;
drop table if exists public.staging_89a7cd27_3e2b_4b47_8ba8_0ba37fc0318b;
drop table if exists public.staging_d147b2a3_39e1_4f4f_9e1d_5a89f0fcaca9;
drop table if exists public.staging_db3c53db_8b13_4868_b1a2_11b07da77963;
drop table if exists public.staging_ebf70a56_cf67_448d_8fa3_466a9f84b0ab;
