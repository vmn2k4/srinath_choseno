import 'package:flutter/foundation.dart';

import 'branch_holder_node.dart';

/// Port of `RepresentationBranch` (src/components/features/RepresentationBranchTree.tsx)
/// — one governance branch (Federal, Provincial, Municipal, School District,
/// ...) for a boundary: its head-of-branch node (`top`, nullable — some
/// branches, like a riding, have no head of their own) plus the rest
/// (`bottom`).
@immutable
class RepresentationBranch {
  const RepresentationBranch({
    required this.key,
    required this.label,
    this.districtName,
    this.top,
    this.bottom = const [],
  });

  final String key;
  final String label;
  final String? districtName;
  final BranchHolderNode? top;
  final List<BranchHolderNode> bottom;
}
