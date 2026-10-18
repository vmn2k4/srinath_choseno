// The @ button's picker: a search box on top and a scrollable, paged list of
// every official below. Pops with the chosen politician; typing "@" in the post
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
}) {
  FocusScope.of(context).unfocus();
  return showModalBottomSheet<TaggablePolitician>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    showDragHandle: true,
    builder: (_) => _MentionPicker(viewerCountry: viewerCountry),
  );
}

class _MentionPicker extends ConsumerStatefulWidget {
  const _MentionPicker({required this.viewerCountry});

  final String? viewerCountry;

  @override
  ConsumerState<_MentionPicker> createState() => _MentionPickerState();
}

class _MentionPickerState extends ConsumerState<_MentionPicker> {
  static const _pageSize = 30;

  final _query = TextEditingController();
  final _scroll = ScrollController();
  final List<TaggablePolitician> _items = [];
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
            Expanded(
              child: _items.isEmpty && !_loading
                  ? Center(
                      child: Text(
                        _failed
                            ? "Couldn't load officials. Try again."
                            : 'No officials found',
                        style: ChosenoTypography.body(color: palette.textMuted),
                      ),
                    )
                  : ListView.builder(
                      controller: _scroll,
                      itemCount: _items.length + (_loading ? 1 : 0),
                      itemBuilder: (context, i) {
                        if (i >= _items.length) {
                          return const Padding(
                            padding: EdgeInsets.all(16),
                            child: Center(child: CircularProgressIndicator()),
                          );
                        }
                        final p = _items[i];
                        return ListTile(
                          leading: CircleAvatar(
                            backgroundColor: palette.primary.withValues(
                              alpha: 0.14,
                            ),
                            backgroundImage: p.photoUrl == null
                                ? null
                                : NetworkImage(p.photoUrl!),
                            child: p.photoUrl == null
                                ? Icon(Icons.person, color: palette.primary)
                                : null,
                          ),
                          title: Text(p.fullName),
                          onTap: () => Navigator.of(context).pop(p),
                        );
                      },
                    ),
            ),
          ],
        ),
      ),
    );
  }
}
