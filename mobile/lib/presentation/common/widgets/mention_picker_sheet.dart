// The @ button's picker: a search box on top, then the officials of the
// viewer's own districts (with the office each holds), then a scrollable,
// paged list of every other official. Pops with the chosen politician; typing "@" in the post
// text still gives the quick inline suggestions.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/theme/theme_config.dart';
import '../../../domain/posts/entities/post_draft.dart';
import '../../features/feed/providers/feed_repository_providers.dart';

Future<TaggablePolitician?> showMentionPicker(
  BuildContext context, {
  String? viewerCountry,
  List<int> districtShapeIds = const [],
}) {
  FocusScope.of(context).unfocus();
  return showModalBottomSheet<TaggablePolitician>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    showDragHandle: true,
    builder: (_) => _MentionPicker(
      viewerCountry: viewerCountry,
      districtShapeIds: districtShapeIds,
    ),
  );
}

class _MentionPicker extends ConsumerStatefulWidget {
  const _MentionPicker({
    required this.viewerCountry,
    required this.districtShapeIds,
  });

  final String? viewerCountry;
  final List<int> districtShapeIds;

  @override
  ConsumerState<_MentionPicker> createState() => _MentionPickerState();
}

class _MentionPickerState extends ConsumerState<_MentionPicker> {
  static const _pageSize = 30;

  final _query = TextEditingController();
  final _scroll = ScrollController();
  final List<TaggablePolitician> _items = [];
  List<TaggablePolitician> _local = const [];
  Timer? _debounce;
  bool _loading = false;
  bool _done = false;
  bool _failed = false;
  bool _myCountryOnly = true;
  int _generation = 0;

  @override
  void initState() {
    super.initState();
    _myCountryOnly = widget.viewerCountry != null;
    _scroll.addListener(() {
      if (_scroll.position.extentAfter < 300) _load();
    });
    _load();
    _loadLocal();
  }

  Future<void> _loadLocal() async {
    final result = await ref
        .read(feedRepositoryProvider)
        .getLocalOfficials(widget.districtShapeIds);
    if (!mounted) return;
    setState(() => _local = result.valueOrNull ?? const []);
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _query.dispose();
    _scroll.dispose();
    super.dispose();
  }

  void _reset() {
    _generation++;
    setState(() {
      _items.clear();
      _done = false;
      _failed = false;
      _loading = false;
    });
    _load();
  }

  Future<void> _load() async {
    if (_loading || _done) return;
    final gen = _generation;
    setState(() => _loading = true);
    final result = await ref
        .read(feedRepositoryProvider)
        .searchTaggablePoliticians(
          _query.text.trim(),
          viewerCountry: widget.viewerCountry,
          limit: _pageSize,
          offset: _items.length,
          onlyCountry: _myCountryOnly,
        );
    if (!mounted || gen != _generation) return;
    final page = result.valueOrNull;
    setState(() {
      _loading = false;
      if (page == null) {
        _failed = true;
        _done = true;
      } else {
        _items.addAll(page);
        if (page.length < _pageSize) _done = true;
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final palette = ChosenoTheme.of(context);
    final height = MediaQuery.of(context).size.height * 0.85;
    return Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
      ),
      child: SizedBox(
        height: height,
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
              child: TextField(
                controller: _query,
                autofocus: false,
                textInputAction: TextInputAction.search,
                onChanged: (_) {
                  _debounce?.cancel();
                  _debounce = Timer(const Duration(milliseconds: 300), _reset);
                },
                decoration: InputDecoration(
                  hintText: 'Search officials by name',
                  prefixIcon: const Icon(Icons.search),
                  suffixIcon: _query.text.isEmpty
                      ? null
                      : IconButton(
                          icon: const Icon(Icons.close),
                          onPressed: () {
                            _query.clear();
                            _reset();
                          },
                        ),
                ),
              ),
            ),
            if (widget.viewerCountry != null)
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
                child: Align(
                  alignment: Alignment.centerLeft,
                  child: FilterChip(
                    label: Text('Only ${widget.viewerCountry}'),
                    selected: _myCountryOnly,
                    onSelected: (v) {
                      _myCountryOnly = v;
                      _reset();
                    },
                  ),
                ),
              ),
            Expanded(child: _list(palette)),
          ],
        ),
      ),
    );
  }

  Widget _tile(ChosenoPalette palette, TaggablePolitician p) => ListTile(
    leading: CircleAvatar(
      backgroundColor: palette.primary.withValues(alpha: 0.14),
      backgroundImage: p.photoUrl == null ? null : NetworkImage(p.photoUrl!),
      child: p.photoUrl == null
          ? Icon(Icons.person, color: palette.primary)
          : null,
    ),
    title: Text(p.fullName),
    subtitle: p.office == null || p.office!.isEmpty
        ? null
        : Text(p.office!, maxLines: 1, overflow: TextOverflow.ellipsis),
    onTap: () => Navigator.of(context).pop(p),
  );

  Widget _header(ChosenoPalette palette, String text) => Padding(
    padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
    child: Text(
      text,
      style: ChosenoTypography.body(
        color: palette.textMuted,
        fontSize: 12,
        fontWeight: FontWeight.w700,
      ),
    ),
  );

  Widget _list(ChosenoPalette palette) {
    final searching = _query.text.trim().isNotEmpty;
    final showLocal = !searching && _local.isNotEmpty;
    final localIds = {for (final p in _local) p.id};
    final rest = showLocal
        ? _items.where((p) => !localIds.contains(p.id)).toList()
        : _items;
    if (_items.isEmpty && !_loading && !showLocal) {
      return Center(
        child: Text(
          _failed
              ? "Couldn't load officials. Try again."
              : 'No officials found',
          style: ChosenoTypography.body(color: palette.textMuted),
        ),
      );
    }
    return ListView(
      controller: _scroll,
      children: [
        if (showLocal) ...[
          _header(palette, 'IN YOUR DISTRICTS'),
          for (final p in _local) _tile(palette, p),
          if (rest.isNotEmpty || _loading) _header(palette, 'MORE OFFICIALS'),
        ],
        for (final p in rest) _tile(palette, p),
        if (_loading)
          const Padding(
            padding: EdgeInsets.all(16),
            child: Center(child: CircularProgressIndicator()),
          ),
      ],
    );
  }
}
