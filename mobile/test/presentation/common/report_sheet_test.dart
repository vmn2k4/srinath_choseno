import 'package:choseno_mobile/core/theme/app_theme.dart';
import 'package:choseno_mobile/core/theme/theme_config.dart';
import 'package:choseno_mobile/presentation/common/widgets/content_safety_sheets.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  // Regression: the report sheet overflowed by 24px on a short screen and cut
  // off "Something else".
  testWidgets('report sheet fits a short screen and reaches every reason', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(360, 480);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(
      ProviderScope(
        child: MaterialApp(
          theme: AppTheme.build(ChosenoPalette.pulse),
          home: Consumer(
            builder: (context, ref, _) => Scaffold(
              body: Center(
                child: TextButton(
                  onPressed: () => showReportSheet(
                    context,
                    ref,
                    targetType: 'post',
                    targetId: 'p1',
                  ),
                  child: const Text('open'),
                ),
              ),
            ),
          ),
        ),
      ),
    );
    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();

    expect(tester.takeException(), isNull);
    await tester.scrollUntilVisible(
      find.text('Something else'),
      80,
      scrollable: find.descendant(
        of: find.byType(BottomSheet),
        matching: find.byType(Scrollable),
      ),
    );
    expect(find.text('Something else'), findsOneWidget);
  });
}
