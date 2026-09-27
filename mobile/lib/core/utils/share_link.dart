// Turns any path this app also has a matching go_router route for (see
// core/router/app_router.dart's AppRoutes) into a real, shareable
// choseno.com URL, and hands it to the OS share sheet. The round trip:
// share from here -> recipient taps it -> DeepLinkService routes it right
// back into the matching screen (once Associated Domains/App Links native
// config is finished — see docs/DEEP_LINKING.md), same as sharing already
// works on the website.
import 'package:share_plus/share_plus.dart';

import '../config/site_config.dart';

String chosenoShareUrl(String path) => '${SiteConfig.siteUrl}$path';

/// [subject] is the pre-filled email subject where the share target falls
/// back to email (Android's chooser, some share extensions) — optional,
/// omit for targets where it's meaningless (Messages, most apps).
Future<void> shareChosenoLink(String path, {String? subject}) {
  return SharePlus.instance.share(
    ShareParams(uri: Uri.parse(chosenoShareUrl(path)), subject: subject),
  );
}
