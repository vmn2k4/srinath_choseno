import 'package:choseno_mobile/core/theme/app_theme.dart';
import 'package:choseno_mobile/core/theme/theme_config.dart';
import 'package:choseno_mobile/core/widgets/widgets.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('AppBadge renders its label using the theme', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.build(ChosenoPalette.civicOriginal),
        home: const Scaffold(
          body: AppBadge(label: 'Leading', tone: AppBadgeTone.success),
        ),
      ),
    );

    expect(find.text('Leading'), findsOneWidget);
  });
}
