// Port of `geocodeAddressFree` (src/lib/utils/geocode.ts) — OpenStreetMap
// Nominatim, same request shape and `countrycodes` restriction. Nominatim's
// usage policy requires an identifying User-Agent, sent here as on the web.
import 'dart:convert';

import 'package:http/http.dart' as http;

import '../../core/errors/app_failure.dart';
import '../../core/errors/result.dart';
import '../../domain/geocoding/entities/geocode_suggestion.dart';
import '../../domain/geocoding/repositories/geocoding_repository.dart';

const _supportedCountryCodes = 'us,ca,in';

class GeocodingRepositoryImpl implements GeocodingRepository {
  GeocodingRepositoryImpl({http.Client? client})
    : _client = client ?? http.Client();

  final http.Client _client;

  @override
  Future<Result<List<GeocodeSuggestion>>> search(String query) async {
    final trimmed = query.trim();
    if (trimmed.length < 3) return const Result.ok([]);
    try {
      final uri = Uri.https('nominatim.openstreetmap.org', '/search', {
        'format': 'json',
        'q': trimmed,
        'limit': '5',
        'countrycodes': _supportedCountryCodes,
      });
      final response = await _client.get(
        uri,
        headers: const {
          'Accept-Language': 'en',
          'User-Agent': 'Choseno-Civic-App/1.0',
        },
      );
      if (response.statusCode != 200) return const Result.ok([]);
      final rows = (jsonDecode(response.body) as List)
          .cast<Map<String, dynamic>>();
      return Result.ok(
        rows
            .map(
              (r) => GeocodeSuggestion(
                displayName: r['display_name'] as String? ?? '',
                lat: double.parse(r['lat'] as String),
                lng: double.parse(r['lon'] as String),
              ),
            )
            .toList(),
      );
    } catch (_) {
      return const Result.err(NetworkFailure());
    }
  }
}
