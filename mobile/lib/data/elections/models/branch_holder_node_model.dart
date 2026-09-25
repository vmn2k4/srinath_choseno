import '../../../domain/elections/entities/branch_holder_node.dart';

/// Port of `toNode()` (src/lib/services/elections.ts) — maps one raw
/// `office_holders` row (with its nested embeds) to the domain's
/// [BranchHolderNode].
extension BranchHolderNodeMapper on Map<String, dynamic> {
  BranchHolderNode toBranchHolderNode() {
    final profile = this['profiles'] as Map<String, dynamic>?;
    final politicianProfile =
        profile?['politician_profiles'] as Map<String, dynamic>?;
    final roleType = this['election_role_types'] as Map<String, dynamic>?;
    final party = this['political_parties'] as Map<String, dynamic>?;
    final shape = this['map_shapes'] as Map<String, dynamic>?;

    return BranchHolderNode(
      id: this['id'] as String,
      fullName: this['full_name'] as String,
      roleTitle: (roleType?['role_title'] as String?) ?? 'Elected Official',
      roleDescription: roleType?['description'] as String?,
      partyName: party?['name'] as String?,
      photoUrl:
          (this['photo_url'] as String?) ??
          (politicianProfile?['photo_url'] as String?) ??
          (politicianProfile?['avatar_url'] as String?),
      ghostId: profile?['current_ghost_id'] as String?,
      wallSlug: politicianProfile?['wall_slug'] as String?,
      boundaryName: shape?['name'] as String?,
      contactEmail:
          (this['contact_email'] as String?) ??
          (politicianProfile?['contact_email'] as String?),
      contactPhone:
          (this['contact_phone'] as String?) ??
          (politicianProfile?['contact_phone'] as String?),
      sourceUrl:
          (this['source_url'] as String?) ??
          (politicianProfile?['source_url'] as String?),
    );
  }

  String? get roleTitleOrNull =>
      (this['election_role_types'] as Map<String, dynamic>?)?['role_title']
          as String?;
}
