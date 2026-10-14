// Port of NewsArticleBody.tsx. Beyond plain paragraphs it understands the
// two extensions long explainers use:
//   :::details Summary text ... :::   -> collapsible section
//   consecutive lines starting "|"     -> table (header, "---" row, rows)
// Inline Markdown is limited to headings and **bold** — no markdown package
// is pulled in until bodies need links/images.
import 'package:flutter/material.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/theme_config.dart';

sealed class _Block {}

class _MdBlock extends _Block {
  _MdBlock(this.text);
  final String text;
}

class _TableBlock extends _Block {
  _TableBlock(this.rows);
  final List<List<String>> rows;
}

class _DetailsBlock extends _Block {
  _DetailsBlock(this.summary, this.blocks);
  final String summary;
  final List<_Block> blocks;
}

List<String> _splitRow(String line) => line
    .trim()
    .replaceFirst(RegExp(r'^\|'), '')
    .replaceFirst(RegExp(r'\|$'), '')
    .split('|')
    .map((c) => c.trim())
    .toList();

List<_Block> _parseBlocks(List<String> lines) {
  final blocks = <_Block>[];
  var buf = <String>[];
  void flush() {
    if (buf.any((l) => l.trim().isNotEmpty)) {
      blocks.add(_MdBlock(buf.join('\n')));
    }
    buf = [];
  }

  for (var i = 0; i < lines.length; i++) {
    final line = lines[i];
    final details = RegExp(r'^:::details\s+(.+)$').firstMatch(line);
    if (details != null) {
      flush();
      final inner = <String>[];
      i++;
      while (i < lines.length && lines[i].trim() != ':::') {
        inner.add(lines[i]);
        i++;
      }
      blocks.add(_DetailsBlock(details.group(1)!.trim(), _parseBlocks(inner)));
      continue;
    }
    if (line.trim().startsWith('|')) {
      flush();
      final rows = <List<String>>[];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        if (!RegExp(r'^\|?\s*:?-{3,}').hasMatch(lines[i].trim())) {
          rows.add(_splitRow(lines[i]));
        }
        i++;
      }
      i--;
      blocks.add(_TableBlock(rows));
      continue;
    }
    buf.add(line);
  }
  flush();
  return blocks;
}

class NewsArticleBody extends StatelessWidget {
  const NewsArticleBody({super.key, required this.body});

  final String body;

  @override
  Widget build(BuildContext context) {
    return _Blocks(blocks: _parseBlocks(body.split('\n')));
  }
}

class _Blocks extends StatelessWidget {
  const _Blocks({required this.blocks});

  final List<_Block> blocks;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final b in blocks)
          Padding(
            padding: const EdgeInsets.only(bottom: ChosenoSpacing.md),
            child: switch (b) {
              _MdBlock() => _Markdown(text: b.text),
              _TableBlock() => _Table(rows: b.rows),
              _DetailsBlock() => _Details(block: b),
            },
          ),
      ],
    );
  }
}

class _Markdown extends StatelessWidget {
  const _Markdown({required this.text});

  final String text;

  List<InlineSpan> _inline(String s, TextStyle base) {
    final spans = <InlineSpan>[];
    final parts = s.split('**');
    for (var i = 0; i < parts.length; i++) {
      if (parts[i].isEmpty) continue;
      spans.add(
        TextSpan(
          text: parts[i],
          style: i.isOdd ? base.copyWith(fontWeight: FontWeight.w700) : null,
        ),
      );
    }
    return spans;
  }

  @override
  Widget build(BuildContext context) {
    final palette = ChosenoTheme.of(context);
    final base = ChosenoTypography.body(
      color: palette.textMain,
      fontSize: 17,
      height: 1.65,
    );
    final paragraphs = text.trim().split(RegExp(r'\n\s*\n'));
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final p in paragraphs)
          Padding(
            padding: const EdgeInsets.only(bottom: ChosenoSpacing.md),
            child: Builder(
              builder: (_) {
                final heading = RegExp(
                  r'^(#{1,4})\s+(.*)$',
                ).firstMatch(p.trim());
                if (heading != null) {
                  return Text(
                    heading.group(2)!,
                    style: ChosenoTypography.display(
                      color: palette.textMain,
                      fontSize: heading.group(1)!.length <= 2 ? 22 : 18,
                    ),
                  );
                }
                final line = p.trim().replaceAllMapped(
                  RegExp(r'^[-*]\s+', multiLine: true),
                  (_) => '• ',
                );
                return Text.rich(
                  TextSpan(style: base, children: _inline(line, base)),
                );
              },
            ),
          ),
      ],
    );
  }
}

class _Table extends StatelessWidget {
  const _Table({required this.rows});

  final List<List<String>> rows;

  @override
  Widget build(BuildContext context) {
    if (rows.isEmpty) return const SizedBox.shrink();
    final palette = ChosenoTheme.of(context);
    final cols = rows.first.length;
    return DecoratedBox(
      decoration: BoxDecoration(
        border: Border.all(color: palette.borderLight),
        borderRadius: BorderRadius.circular(ChosenoRadii.sm),
      ),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Table(
          defaultColumnWidth: const FixedColumnWidth(150),
          border: TableBorder(
            horizontalInside: BorderSide(color: palette.borderLight),
          ),
          children: [
            for (var r = 0; r < rows.length; r++)
              TableRow(
                decoration: r == 0
                    ? BoxDecoration(color: palette.surface)
                    : null,
                children: [
                  for (var c = 0; c < cols; c++)
                    Padding(
                      padding: const EdgeInsets.all(ChosenoSpacing.sm),
                      child: Text(
                        c < rows[r].length ? rows[r][c] : '',
                        style: ChosenoTypography.body(
                          color: r == 0 || c == 0
                              ? palette.textMain
                              : palette.textMuted,
                          fontWeight: r == 0 || c == 0
                              ? FontWeight.w700
                              : FontWeight.w400,
                          fontSize: 13,
                        ),
                      ),
                    ),
                ],
              ),
          ],
        ),
      ),
    );
  }
}

class _Details extends StatelessWidget {
  const _Details({required this.block});

  final _DetailsBlock block;

  @override
  Widget build(BuildContext context) {
    final palette = ChosenoTheme.of(context);
    return DecoratedBox(
      decoration: BoxDecoration(
        border: Border.all(color: palette.borderLight),
        borderRadius: BorderRadius.circular(ChosenoRadii.sm),
      ),
      child: Theme(
        data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
        child: ExpansionTile(
          title: Text(
            block.summary,
            style: ChosenoTypography.body(
              color: palette.textMain,
              fontWeight: FontWeight.w700,
              fontSize: 15,
            ),
          ),
          childrenPadding: const EdgeInsets.fromLTRB(
            ChosenoSpacing.md,
            0,
            ChosenoSpacing.md,
            ChosenoSpacing.sm,
          ),
          children: [_Blocks(blocks: block.blocks)],
        ),
      ),
    );
  }
}
