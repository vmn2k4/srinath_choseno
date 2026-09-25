import 'package:flutter/foundation.dart';

@immutable
class PoliticalParty {
  const PoliticalParty({required this.id, required this.name});
  final int id;
  final String name;
}
