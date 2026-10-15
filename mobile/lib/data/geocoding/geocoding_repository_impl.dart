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

  static final _usZip = RegExp(r'^\d{5}(-\d{4})?$');
  static final _caPostal = RegExp(
    r'^([A-Za-z]\d[A-Za-z])[ -]?(\d[A-Za-z]\d)?$',
  );
  static final _inPin = RegExp(r'^\d{6}$');

  static const _headers = {
    'Accept-Language': 'en',
    'User-Agent': 'Choseno-Civic-App/1.0',
  };

  @override
  Future<Result<List<GeocodeSuggestion>>> search(String query) async {
    final trimmed = query.trim();
    if (trimmed.length < 3) return const Result.ok([]);
    try {
      // Postal codes: free-text Nominatim matches them poorly (often the wrong
      // country or nothing), so resolve them as postal codes first.
      final postal = await _searchPostal(trimmed);
      if (postal.isNotEmpty) return Result.ok(postal);
      return Result.ok(await _nominatim({'q': trimmed}));
    } catch (_) {
      return const Result.err(NetworkFailure());
    }
  }

  Future<List<GeocodeSuggestion>> _searchPostal(String q) async {
    if (_usZip.hasMatch(q)) {
      final zip = q.substring(0, 5);
      final hit = await _zippopotam('us', zip);
      if (hit.isNotEmpty) return hit;
      return _nominatim({'postalcode': zip, 'country': 'United States'});
    }
    final ca = _caPostal.firstMatch(q);
    if (ca != null) {
      final fsa = ca.group(1)!.toUpperCase();
      if (ca.group(2) != null) {
        final full = await _nominatim({
          'postalcode': '$fsa ${ca.group(2)!.toUpperCase()}',
          'country': 'Canada',
        });
        if (full.isNotEmpty) return full;
      }
      // Full code unknown to OSM: the 3-character area centroid is still close.
      return _zippopotam('ca', fsa);
    }
    if (_inPin.hasMatch(q)) {
      final hit = await _zippopotam('in', q);
      if (hit.isNotEmpty) return hit;
      return _nominatim({'postalcode': q, 'country': 'India'});
    }
    return const [];
  }

  Future<List<GeocodeSuggestion>> _zippopotam(String cc, String code) async {
    final response = await _client.get(
      Uri.https('api.zippopotam.us', '/$cc/$code'),
    );
    if (response.statusCode != 200) return const [];
    final places = (jsonDecode(response.body)['places'] as List?) ?? const [];
    return [
      for (final p in places.cast<Map<String, dynamic>>())
        GeocodeSuggestion(
          displayName:
              '${p['place name']}, ${p['state abbreviation'] ?? p['state']} $code',
          lat: double.parse(p['latitude'] as String),
          lng: double.parse(p['longitude'] as String),
        ),
    ].take(5).toList();
  }

  Future<List<GeocodeSuggestion>> _nominatim(Map<String, String> params) async {
    final uri = Uri.https('nominatim.openstreetmap.org', '/search', {
      'format': 'json',
      ...params,
      'limit': '8',
      // Structured queries name their own country.
      if (!params.containsKey('country'))
        'countrycodes': _supportedCountryCodes,
    });
    final response = await _client.get(uri, headers: _headers);
    if (response.statusCode != 200) return const [];
    final rows = (jsonDecode(response.body) as List)
        .cast<Map<String, dynamic>>();
    final seen = <String>{};
    return [
      for (final r in rows)
        if (seen.add(r['display_name'] as String? ?? ''))
          GeocodeSuggestion(
            displayName: r['display_name'] as String? ?? '',
            lat: double.parse(r['lat'] as String),
            lng: double.parse(r['lon'] as String),
          ),
    ].take(5).toList();
  }
}
