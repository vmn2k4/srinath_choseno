import '../../../core/errors/result.dart';
import '../entities/geocode_suggestion.dart';

abstract interface class GeocodingRepository {
  /// Free-text address → up to 5 candidate points, restricted to the three
  /// countries Choseno has electoral-boundary coverage for (US, Canada,
  /// India) — same restriction as the web's `geocodeAddressFree`. Queries
  /// shorter than 3 characters return an empty list without a request.
  Future<Result<List<GeocodeSuggestion>>> search(String query);
}
