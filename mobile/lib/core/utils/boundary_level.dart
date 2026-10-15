// Level of a boundary (federal / provincial / municipal …) from its raw
// `boundary_type` — used wherever districts are listed so same-named ones
// (Surrey federal vs Surrey municipal) can be told apart.

/// Specificity rank, the web's `boundaryTypeRank`: federal first, then
/// provincial/state, then municipal, then anything else.
int boundaryTypeRank(String? type) {
  if (type == null || type.isEmpty) return 99;
  final t = type.toLowerCase();
  if (t.contains('federal') ||
      t.contains('congressional') ||
      t.contains('commons')) {
    return 1;
  }
  if (t.contains('provincial') ||
      t.contains('state') ||
      t.contains('territorial')) {
    return 2;
  }
  if (t.contains('municipal') ||
      t.contains('city') ||
      t.contains('county') ||
      t.contains('town')) {
    return 3;
  }
  return 4;
}

String? boundaryLevelLabel(String? type) {
  if (type == null || type.isEmpty) return null;
  final t = type.toLowerCase();
  if (t.contains('federal') ||
      t.contains('congressional') ||
      t.contains('commons')) {
    return 'Federal';
  }
  if (t.contains('provincial')) return 'Provincial';
  if (t.contains('state')) return 'State';
  if (t.contains('territorial')) return 'Territorial';
  if (t.contains('municipal') ||
      t.contains('city') ||
      t.contains('county') ||
      t.contains('town')) {
    return 'Municipal';
  }
  return type;
}
