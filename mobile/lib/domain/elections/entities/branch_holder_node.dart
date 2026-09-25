import 'package:flutter/foundation.dart';

/// Port of `BranchHolderNode` (src/components/features/RepresentationBranchTree.tsx)
/// — one elected official (or candidate-adjacent office holder) in a
/// representation branch card.
@immutable
class BranchHolderNode {
  const BranchHolderNode({
    required this.id,
    required this.fullName,
    required this.roleTitle,
    this.roleDescription,
    this.partyName,
    this.photoUrl,
    this.ghostId,
    this.wallSlug,
    this.boundaryName,
    this.contactEmail,
    this.contactPhone,
    this.sourceUrl,
  });

  final String id;
  final String fullName;
  final String roleTitle;
  final String? roleDescription;
  final String? partyName;
  final String? photoUrl;
  final String? ghostId;
  final String? wallSlug;
  final String? boundaryName;
  final String? contactEmail;
  final String? contactPhone;
  final String? sourceUrl;
}
