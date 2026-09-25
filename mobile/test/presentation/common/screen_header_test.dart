import 'package:choseno_mobile/core/theme/app_theme.dart';
import 'package:choseno_mobile/core/theme/theme_config.dart';
import 'package:choseno_mobile/domain/profile/entities/user_profile.dart';
import 'package:choseno_mobile/presentation/common/widgets/screen_header.dart';
import 'package:choseno_mobile/presentation/features/profile/providers/profile_providers.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

class _FakeOwnProfile extends OwnProfileController {
  _FakeOwnProfile(this.profile);

  final UserProfile? profile;

  @override
  Future<UserProfile?> build() async => profile;
}

Future<void> _pump(
  WidgetTester tester, {
  UserProfile? profile,
  List<Widget> actions = const [],
}) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        ownProfileProvider.overrideWith(() => _FakeOwnProfile(profile)),
      ],
      child: MaterialApp(
        theme: AppTheme.build(ChosenoPalette.pulse),
        home: Scaffold(
          body: SafeArea(
            child: Column(
              children: [
                ScreenHeader(title: 'News', actions: actions),
              ],
            ),
          ),
        ),
      ),
    ),
  );
  await tester.pump();
}

void main() {
  testWidgets('shows the title, search and the brand mark for a citizen', (
    tester,
  ) async {
    await _pump(tester);

    expect(find.text('News'), findsOneWidget);
    expect(find.bySemanticsLabel('Search'), findsOneWidget);
    expect(find.bySemanticsLabel('Profile'), findsOneWidget);
    expect(find.text('C'), findsOneWidget);
  });

  testWidgets('renders trailing actions and fires their onTap', (tester) async {
    var taps = 0;
    await _pump(
      tester,
      actions: [
        HeaderIconButton(
          icon: Icons.edit_square,
          tooltip: 'New post',
          onTap: () => taps++,
        ),
      ],
    );

    await tester.tap(find.bySemanticsLabel('New post'));
    expect(taps, 1);
  });

  testWidgets('tapping search shows the coming-soon snackbar', (tester) async {
    await _pump(tester);

    await tester.tap(find.bySemanticsLabel('Search'));
    await tester.pump();
    expect(find.text('Search is coming soon.'), findsOneWidget);
  });
}
