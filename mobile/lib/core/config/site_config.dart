/// Port of `SITE_URL` (src/lib/constants/site.ts) — the canonical web
/// origin used to build a shareable link for any screen this app also
/// renders (see core/utils/share_link.dart). `DeepLinkService`
/// (core/router/deep_link_service.dart) only ever routes links back in
/// from this same host.
abstract final class SiteConfig {
  static const siteUrl = 'https://www.choseno.com';
}
