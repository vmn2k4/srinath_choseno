// The one post composer shared by the Feed and Politician Wall (and the
// Candidacy Wall) — port of the web's composer form: text with @politician
// tagging, a Photo attach (≤5MB), and, for a politician posting as
// themselves, a Video Pitch (record / upload ≤50MB, or a YouTube link).
// A pasted link gets a preview card (fetched like the web's LinkPreview) that
// is saved with the post as `link_metadata`; the X on the card drops it.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/theme/theme_config.dart';
import '../../../core/utils/haptics.dart';
import '../../../core/utils/video_compression.dart';
import '../../../core/utils/youtube.dart';
import '../../../core/widgets/widgets.dart';
import '../../../data/posts/link_preview_fetcher.dart';
import '../../../domain/posts/entities/post_draft.dart';
import '../../features/feed/providers/feed_repository_providers.dart';
import 'post_video_thumbnail.dart' show showInAppVideo;
import '../../features/politician_wall/widgets/wall_post_tile.dart'
    show LinkCard;

const _maxImageBytes = 5 * 1024 * 1024;
const _maxVideoBytes = 50 * 1024 * 1024;

/// Opens the composer. [onSubmit] returns whether the post saved — the sheet
/// stays open and shows the failure inline on false, closes itself on true.
Future<void> showPostComposerSheet(
  BuildContext context, {
  required String hint,
  required String ghostId,
  required Future<bool> Function(PostDraft draft) onSubmit,
  bool allowVideo = false,
  String? viewerCountry,
  List<PostTarget> targets = const [],
  int? initialTargetId,
  String initialText = '',
  Uint8List? initialImage,
  String initialImageExt = 'jpg',
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (sheetContext) => Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(sheetContext).viewInsets.bottom,
      ),
      child: _PostComposer(
        hint: hint,
        ghostId: ghostId,
        allowVideo: allowVideo,
        viewerCountry: viewerCountry,
        targets: targets,
        initialTargetId: initialTargetId,
        initialText: initialText,
        initialImage: initialImage,
        initialImageExt: initialImageExt,
        onSubmit: onSubmit,
      ),
    ),
  );
}

class _PostComposer extends ConsumerStatefulWidget {
  const _PostComposer({
    required this.hint,
    required this.ghostId,
    required this.allowVideo,
    required this.viewerCountry,
    required this.targets,
    required this.initialTargetId,
    required this.initialText,
    required this.initialImage,
    required this.initialImageExt,
    required this.onSubmit,
  });

  final String initialText;
  final Uint8List? initialImage;
  final String initialImageExt;

  final List<PostTarget> targets;
  final int? initialTargetId;
  final String hint;
  final String ghostId;
  final bool allowVideo;
  final String? viewerCountry;
  final Future<bool> Function(PostDraft draft) onSubmit;

  @override
  ConsumerState<_PostComposer> createState() => _PostComposerState();
}

class _PostComposerState extends ConsumerState<_PostComposer> {
  final _text = TextEditingController();
  final _focus = FocusNode();
  final _youtube = TextEditingController();
  final _picker = ImagePicker();

  Uint8List? _imageBytes;
  String _imageExt = 'jpg';
  String? _videoUrl;
  bool _videoPanel = false;
  bool _youtubeMode = false;
  bool _videoUploading = false;

  /// politician id → the "@Name" inserted for them.
  final Map<String, String> _mentions = {};
  List<TaggablePolitician> _suggestions = const [];
  Timer? _debounce;

  /// Preview of the first link in the text, once fetched.
  Map<String, dynamic>? _link;
  String? _linkUrl;
  final Set<String> _dismissedLinks = {};
  Timer? _linkDebounce;

  bool _submitting = false;
  String? _error;

  /// null = all my districts.
  int? _targetId;

  @override
  void initState() {
    super.initState();
    _targetId = widget.targets.any((t) => t.shapeId == widget.initialTargetId)
        ? widget.initialTargetId
        : null;
    if (widget.initialText.isNotEmpty) {
      _text.text = widget.initialText;
      _text.selection = TextSelection.collapsed(offset: _text.text.length);
      // Fetch the link preview card for a shared URL.
      WidgetsBinding.instance.addPostFrameCallback(
        (_) => _updateLinkPreview(_text.text),
      );
    }
    _imageBytes = widget.initialImage;
    _imageExt = widget.initialImageExt;
    WidgetsBinding.instance.addPostFrameCallback((_) => _focus.requestFocus());
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _linkDebounce?.cancel();
    _text.dispose();
    _focus.dispose();
    _youtube.dispose();
    super.dispose();
  }

  // ── @mentions ──────────────────────────────────────────────────────────
  /// The "@query" being typed at the cursor, or null.
  ({int start, String query})? _activeMention() {
    final sel = _text.selection;
    if (!sel.isValid || !sel.isCollapsed) return null;
    final before = _text.text.substring(0, sel.baseOffset);
    final at = before.lastIndexOf('@');
    if (at < 0) return null;
    if (at > 0 && !RegExp(r'\s').hasMatch(before[at - 1])) return null;
    final query = before.substring(at + 1);
    if (query.isEmpty || query.length > 30 || query.contains('\n')) return null;
    return (start: at, query: query);
  }

  void _updateLinkPreview(String text) {
    _linkDebounce?.cancel();
    final url = firstUrlIn(text);
    if (url == _linkUrl) return;
    if (url == null || _dismissedLinks.contains(url)) {
      if (_link != null || _linkUrl != null) {
        setState(() {
          _link = null;
          _linkUrl = null;
        });
      }
      return;
    }
    _linkDebounce = Timer(const Duration(milliseconds: 600), () async {
      final meta = await fetchLinkMetadata(url);
      if (!mounted || firstUrlIn(_text.text) != url) return;
      setState(() {
        _linkUrl = url;
        _link = meta;
      });
    });
  }

  void _onTextChanged(String text) {
    _updateLinkPreview(text);
    _debounce?.cancel();
    final active = _activeMention();
    if (active == null) {
      if (_suggestions.isNotEmpty) setState(() => _suggestions = const []);
      return;
    }
    _debounce = Timer(const Duration(milliseconds: 250), () async {
      final result = await ref
          .read(feedRepositoryProvider)
          .searchTaggablePoliticians(
            active.query,
            viewerCountry: widget.viewerCountry,
          );
      if (!mounted || _activeMention()?.query != active.query) return;
      setState(() => _suggestions = result.valueOrNull ?? const []);
    });
  }

  void _pickMention(TaggablePolitician p) {
    final active = _activeMention();
    if (active == null) return;
    AppHaptics.tap();
    final cursor = _text.selection.baseOffset;
    final tag = '@${p.fullName} ';
    _text.value = TextEditingValue(
      text: _text.text.replaceRange(active.start, cursor, tag),
      selection: TextSelection.collapsed(offset: active.start + tag.length),
    );
    _mentions[p.id] = '@${p.fullName}';
    setState(() => _suggestions = const []);
  }

  // ── media ──────────────────────────────────────────────────────────────
  Future<void> _pickImage() async {
    final file = await _picker.pickImage(
      source: ImageSource.gallery,
      maxWidth: 2000,
      imageQuality: 85,
    );
    if (file == null) return;
    final bytes = await file.readAsBytes();
    if (bytes.length > _maxImageBytes) {
      setState(() => _error = 'Image must be less than 5MB');
      return;
    }
    setState(() {
      _error = null;
      _imageBytes = bytes;
      _imageExt = file.path.contains('.')
          ? file.path.split('.').last.toLowerCase()
          : 'jpg';
    });
  }

  Future<void> _pickVideo(ImageSource source) async {
    final file = await _picker.pickVideo(
      source: source,
      maxDuration: const Duration(seconds: 30),
    );
    if (file == null) return;
    setState(() {
      _error = null;
      _videoUploading = true;
    });
    // Downscale first so a phone clip fits the 50MB limit.
    final video = await compressVideoForUpload(file.path);
    if (video.bytes.length > _maxVideoBytes) {
      if (!mounted) return;
      setState(() {
        _videoUploading = false;
        _error =
            'Video is still over 50MB after compression — try a shorter clip';
      });
      return;
    }
    final result = await ref
        .read(feedRepositoryProvider)
        .uploadPostVideo(video.bytes, video.extension);
    if (!mounted) return;
    result.when(
      ok: (url) => setState(() {
        _videoUploading = false;
        _videoUrl = url;
        _videoPanel = false;
      }),
      err: (f) => setState(() {
        _videoUploading = false;
        _error = 'Failed to upload video: ${f.message}';
      }),
    );
  }

  void _addYouTube() {
    final id = parseYouTubeId(_youtube.text);
    if (id == null) {
      setState(() => _error = 'Enter a valid YouTube video link');
      return;
    }
    setState(() {
      _error = null;
      _videoUrl = youTubeWatchUrl(id);
      _videoPanel = false;
      _youtube.clear();
    });
  }

  // ── submit ─────────────────────────────────────────────────────────────
  Future<void> _submit() async {
    final content = _text.text.trim();
    if ((content.isEmpty && _imageBytes == null && _videoUrl == null) ||
        _submitting) {
      return;
    }
    setState(() {
      _submitting = true;
      _error = null;
    });
    // A link posted before its preview finished loading (e.g. straight from a
    // share) would save without a card — fetch it now instead.
    var link = _link;
    final url = firstUrlIn(content);
    if (link == null &&
        url != null &&
        _videoUrl == null &&
        !_dismissedLinks.contains(url)) {
      link = await fetchLinkMetadata(url);
      if (!mounted) return;
    }
    String? imageUrl;
    if (_imageBytes != null) {
      final up = await ref
          .read(feedRepositoryProvider)
          .uploadPostImage(_imageBytes!, _imageExt, widget.ghostId);
      imageUrl = up.valueOrNull;
      if (imageUrl == null) {
        if (!mounted) return;
        setState(() {
          _submitting = false;
          _error = 'Failed to upload image.';
        });
        return;
      }
    }
    final ok = await widget.onSubmit(
      PostDraft(
        content: content,
        imageUrl: imageUrl,
        videoUrl: _videoUrl,
        linkMetadata: link,
        mentionedPoliticianIds: [
          for (final e in _mentions.entries)
            if (content.contains(e.value)) e.key,
        ],
        boundaryIds: _targetId == null ? const [] : [_targetId!],
      ),
    );
    if (!mounted) return;
    if (ok) {
      Navigator.of(context).pop();
    } else {
      setState(() {
        _submitting = false;
        _error = 'Could not post. Please try again.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final palette = ChosenoTheme.of(context);
    final canPost =
        _text.text.trim().isNotEmpty ||
        _imageBytes != null ||
        _videoUrl != null;
    final busy = _submitting || _videoUploading;
    final screenH = MediaQuery.of(context).size.height;
    return Container(
      constraints: BoxConstraints(maxHeight: screenH * 0.88),
      decoration: BoxDecoration(
        color: palette.surface,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Drag handle
            Center(
              child: Container(
                width: 40,
                height: 4,
                margin: const EdgeInsets.only(top: 10, bottom: 4),
                decoration: BoxDecoration(
                  color: palette.borderLight,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            // Header: close · title · Post
            Padding(
              padding: const EdgeInsets.fromLTRB(
                ChosenoSpacing.xs,
                0,
                ChosenoSpacing.md,
                0,
              ),
              child: Row(
                children: [
                  IconButton(
                    icon: Icon(Icons.close, color: palette.textMain),
                    onPressed: () => Navigator.of(context).pop(),
                  ),
                  Expanded(
                    child: Text(
                      'New post',
                      textAlign: TextAlign.center,
                      style: ChosenoTypography.display(
                        color: palette.textMain,
                        fontSize: 17,
                      ),
                    ),
                  ),
                  const SizedBox(width: 48),
                ],
              ),
            ),
            Divider(height: 12, color: palette.borderLight),
            Flexible(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(
                  horizontal: ChosenoSpacing.md,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Padding(
                      padding: const EdgeInsets.only(top: ChosenoSpacing.xs),
                      child: Row(
                        children: [
                          CircleAvatar(
                            radius: 20,
                            backgroundColor: palette.primary.withValues(
                              alpha: 0.14,
                            ),
                            child: Icon(Icons.person, color: palette.primary),
                          ),
                          const SizedBox(width: ChosenoSpacing.sm),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Share with your community',
                                  style: ChosenoTypography.body(
                                    color: palette.textMain,
                                    fontSize: 15,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                                if (widget.targets.length > 1)
                                  _targetPicker(palette),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                    TextField(
                      controller: _text,
                      focusNode: _focus,
                      onChanged: (v) {
                        setState(() {});
                        _onTextChanged(v);
                      },
                      maxLines: null,
                      minLines: 4,
                      keyboardType: TextInputType.multiline,
                      // Flutter's own copy/paste menu: iOS's native one threw
                      // inside UIKit (UIStoryboard name) on long-press.
                      contextMenuBuilder: (context, editableTextState) =>
                          AdaptiveTextSelectionToolbar.editableText(
                            editableTextState: editableTextState,
                          ),
                      textCapitalization: TextCapitalization.sentences,
                      style: ChosenoTypography.body(
                        color: palette.textMain,
                        fontSize: 17,
                        height: 1.45,
                      ),
                      decoration: InputDecoration(
                        hintText: widget.hint,
                        hintStyle: ChosenoTypography.body(
                          color: palette.textMuted,
                          fontSize: 17,
                          height: 1.45,
                        ),
                        filled: false,
                        border: InputBorder.none,
                        enabledBorder: InputBorder.none,
                        focusedBorder: InputBorder.none,
                        contentPadding: const EdgeInsets.symmetric(
                          vertical: ChosenoSpacing.sm,
                        ),
                      ),
                    ),
                    if (_suggestions.isNotEmpty) _suggestionList(palette),
                    if (_imageBytes != null) _imagePreview(palette),
                    if (_videoUrl != null) _videoChip(palette),
                    if (_link != null) _linkPreview(palette),
                    if (_videoPanel && _videoUrl == null)
                      _videoPanelView(palette),
                    if (_error != null)
                      Padding(
                        padding: const EdgeInsets.only(
                          bottom: ChosenoSpacing.sm,
                        ),
                        child: Text(
                          _error!,
                          style: ChosenoTypography.body(
                            color: palette.danger,
                            fontSize: 13,
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ),
            // Attach toolbar
            Divider(height: 1, color: palette.borderLight),
            Padding(
              padding: const EdgeInsets.symmetric(
                horizontal: ChosenoSpacing.sm,
                vertical: ChosenoSpacing.sm,
              ),
              child: Row(
                children: [
                  _toolButton(
                    palette,
                    icon: Icons.image_outlined,
                    label: 'Photo',
                    onTap: _submitting ? null : _pickImage,
                  ),
                  if (widget.allowVideo)
                    _toolButton(
                      palette,
                      icon: Icons.videocam_outlined,
                      label: 'Video Pitch',
                      active: _videoPanel,
                      onTap: _submitting || _videoUrl != null
                          ? null
                          : () => setState(() => _videoPanel = !_videoPanel),
                    ),
                  _toolButton(
                    palette,
                    icon: Icons.alternate_email,
                    label: 'Tag',
                    onTap: _insertTag,
                  ),
                  const Spacer(),
                  SizedBox(
                    height: 48,
                    child: FilledButton(
                      style: FilledButton.styleFrom(
                        padding: const EdgeInsets.symmetric(horizontal: 28),
                        shape: const StadiumBorder(),
                      ),
                      onPressed: busy || !canPost ? null : _submit,
                      child: _submitting
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            )
                          : const Text(
                              'Post',
                              style: TextStyle(
                                fontWeight: FontWeight.w700,
                                fontSize: 16,
                              ),
                            ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _insertTag() {
    final t = _text.text;
    final sel = _text.selection;
    final at = sel.isValid ? sel.baseOffset : t.length;
    final needsSpace = at > 0 && !RegExp(r'\s').hasMatch(t[at - 1]);
    final ins = needsSpace ? ' @' : '@';
    _text.value = TextEditingValue(
      text: t.replaceRange(at, at, ins),
      selection: TextSelection.collapsed(offset: at + ins.length),
    );
    _focus.requestFocus();
    setState(() {});
  }

  Widget _toolButton(
    ChosenoPalette palette, {
    required IconData icon,
    required String label,
    required VoidCallback? onTap,
    bool active = false,
  }) {
    final color = onTap == null
        ? palette.textMuted.withValues(alpha: 0.5)
        : (active ? palette.primary : palette.textSecondary);
    // Icon-only so the row fits beside the big Post button on any phone.
    return IconButton(
      tooltip: label,
      iconSize: 26,
      padding: const EdgeInsets.all(12),
      onPressed: onTap,
      icon: Icon(icon, color: color),
    );
  }

  String get _targetLabel => _targetId == null
      ? 'All my districts'
      : widget.targets
            .firstWhere(
              (t) => t.shapeId == _targetId,
              orElse: () => widget.targets.first,
            )
            .label;

  /// A bottom sheet rather than a dropdown menu: a menu is clipped by the
  /// keyboard / bottom nav and hides the lower districts; a sheet scrolls and
  /// always fits.
  Future<void> _chooseTarget() async {
    FocusScope.of(context).unfocus();
    final picked = await showModalBottomSheet<({int? id})>(
      context: context,
      useSafeArea: true,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (sheetContext) {
        final palette = ChosenoTheme.of(sheetContext);
        Widget row(int? id, String label) => ListTile(
          title: Text(label),
          trailing: id == _targetId
              ? Icon(Icons.check, color: palette.primary)
              : null,
          onTap: () => Navigator.of(sheetContext).pop((id: id)),
        );
        return ConstrainedBox(
          constraints: BoxConstraints(
            maxHeight: MediaQuery.of(sheetContext).size.height * 0.7,
          ),
          child: ListView(
            shrinkWrap: true,
            children: [
              const Padding(
                padding: EdgeInsets.fromLTRB(16, 0, 16, 8),
                child: Text(
                  'Post to',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
                ),
              ),
              row(null, 'All my districts'),
              for (final t in widget.targets) row(t.shapeId, t.label),
            ],
          ),
        );
      },
    );
    if (picked != null && mounted) setState(() => _targetId = picked.id);
  }

  Widget _targetPicker(ChosenoPalette palette) => Align(
    alignment: Alignment.centerLeft,
    child: Padding(
      padding: const EdgeInsets.only(top: 2),
      child: Material(
        color: palette.primary.withValues(alpha: 0.08),
        shape: StadiumBorder(
          side: BorderSide(color: palette.primary.withValues(alpha: 0.25)),
        ),
        child: InkWell(
          customBorder: const StadiumBorder(),
          onTap: _submitting ? null : _chooseTarget,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(12, 8, 8, 8),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.groups_outlined, size: 18, color: palette.primary),
                const SizedBox(width: 6),
                Flexible(
                  child: Text(
                    'Post to: $_targetLabel',
                    overflow: TextOverflow.ellipsis,
                    style: ChosenoTypography.body(
                      color: palette.primary,
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
                Icon(Icons.expand_more, size: 18, color: palette.primary),
              ],
            ),
          ),
        ),
      ),
    ),
  );

  Widget _suggestionList(ChosenoPalette palette) => Container(
    margin: const EdgeInsets.only(bottom: ChosenoSpacing.sm),
    decoration: BoxDecoration(
      color: palette.surfaceHover,
      borderRadius: BorderRadius.circular(ChosenoRadii.sm * 2),
      border: Border.all(color: palette.borderLight),
    ),
    child: Column(
      children: [
        for (final p in _suggestions)
          InkWell(
            onTap: () => _pickMention(p),
            child: Padding(
              padding: const EdgeInsets.symmetric(
                horizontal: ChosenoSpacing.md,
                vertical: ChosenoSpacing.sm,
              ),
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 14,
                    backgroundColor: palette.primary.withValues(alpha: 0.14),
                    backgroundImage: p.photoUrl == null
                        ? null
                        : NetworkImage(p.photoUrl!),
                    child: p.photoUrl == null
                        ? Icon(Icons.person, size: 16, color: palette.primary)
                        : null,
                  ),
                  const SizedBox(width: ChosenoSpacing.sm),
                  Expanded(
                    child: Text(
                      p.fullName,
                      style: ChosenoTypography.body(
                        color: palette.textMain,
                        fontSize: 14,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
      ],
    ),
  );

  Widget _linkPreview(ChosenoPalette palette) => Padding(
    padding: const EdgeInsets.only(bottom: ChosenoSpacing.sm),
    child: Stack(
      children: [
        LinkCard(
          url: _link!['url'] as String? ?? _linkUrl!,
          title: _link!['title'] as String?,
          description: _link!['description'] as String?,
          image: _link!['image'] as String?,
          onTap: () {},
        ),
        Positioned(
          top: 0,
          right: 0,
          child: IconButton(
            visualDensity: VisualDensity.compact,
            icon: const Icon(Icons.close, size: 16),
            onPressed: () => setState(() {
              _dismissedLinks.add(_linkUrl!);
              _link = null;
              _linkUrl = null;
            }),
          ),
        ),
      ],
    ),
  );

  Widget _imagePreview(ChosenoPalette palette) => Padding(
    padding: const EdgeInsets.only(bottom: ChosenoSpacing.sm),
    child: Stack(
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(ChosenoRadii.sm + 2),
          child: Image.memory(
            _imageBytes!,
            height: 160,
            width: double.infinity,
            fit: BoxFit.cover,
          ),
        ),
        Positioned(
          top: 4,
          right: 4,
          child: IconButton.filled(
            style: IconButton.styleFrom(backgroundColor: Colors.black54),
            icon: const Icon(Icons.close, size: 18, color: Colors.white),
            onPressed: () => setState(() => _imageBytes = null),
          ),
        ),
      ],
    ),
  );

  Widget _videoChip(ChosenoPalette palette) => GestureDetector(
    onTap: () => showInAppVideo(context, _videoUrl!),
    child: Container(
      margin: const EdgeInsets.only(bottom: ChosenoSpacing.sm),
      padding: const EdgeInsets.symmetric(
        horizontal: ChosenoSpacing.md,
        vertical: ChosenoSpacing.sm,
      ),
      decoration: BoxDecoration(
        color: palette.primary.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(ChosenoRadii.sm * 2),
      ),
      child: Row(
        children: [
          Icon(Icons.videocam, size: 18, color: palette.primary),
          const SizedBox(width: ChosenoSpacing.sm),
          Expanded(
            child: Text(
              'Campaign video attached · tap to preview',
              style: ChosenoTypography.body(
                color: palette.textMain,
                fontSize: 13,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          InkResponse(
            onTap: () => setState(() => _videoUrl = null),
            child: Icon(Icons.close, size: 18, color: palette.textMuted),
          ),
        ],
      ),
    ),
  );

  Widget _videoPanelView(ChosenoPalette palette) => Container(
    margin: const EdgeInsets.only(bottom: ChosenoSpacing.sm),
    padding: const EdgeInsets.all(ChosenoSpacing.md),
    decoration: BoxDecoration(
      color: palette.surfaceHover,
      borderRadius: BorderRadius.circular(ChosenoRadii.sm * 2),
      border: Border.all(color: palette.borderLight),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SegmentedButton<bool>(
          segments: const [
            ButtonSegment(value: false, label: Text('Record / Upload')),
            ButtonSegment(value: true, label: Text('YouTube link')),
          ],
          selected: {_youtubeMode},
          onSelectionChanged: (s) => setState(() {
            _youtubeMode = s.first;
            _error = null;
          }),
        ),
        const SizedBox(height: ChosenoSpacing.md),
        if (_youtubeMode) ...[
          TextField(
            controller: _youtube,
            keyboardType: TextInputType.url,
            decoration: const InputDecoration(
              hintText: 'Paste a YouTube video link',
            ),
          ),
          const SizedBox(height: ChosenoSpacing.sm),
          AppButton(label: 'Add video', onPressed: _addYouTube),
        ] else if (_videoUploading)
          const Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                CircularProgressIndicator(),
                SizedBox(height: ChosenoSpacing.sm),
                Text('Optimizing and uploading…'),
              ],
            ),
          )
        else ...[
          Text(
            'Record or upload a 30s pitch (max 50MB)',
            textAlign: TextAlign.center,
            style: ChosenoTypography.body(
              color: palette.textMuted,
              fontSize: 13,
            ),
          ),
          const SizedBox(height: ChosenoSpacing.sm),
          Row(
            children: [
              Expanded(
                child: AppButton(
                  label: 'Record',
                  icon: Icons.fiber_manual_record,
                  onPressed: () => _pickVideo(ImageSource.camera),
                ),
              ),
              const SizedBox(width: ChosenoSpacing.sm),
              Expanded(
                child: AppButton(
                  label: 'Upload',
                  icon: Icons.upload_file,
                  variant: AppButtonVariant.outline,
                  onPressed: () => _pickVideo(ImageSource.gallery),
                ),
              ),
            ],
          ),
        ],
      ],
    ),
  );
}
