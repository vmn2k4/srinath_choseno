// Port of resolveRepresentationBranch + getActiveSeats(ByShapeIds)
// (src/lib/services/elections.ts). See elections_remote_data_source.dart's
// header for the one enrichment fallback not yet ported.
import 'dart:typed_data';

import 'package:collection/collection.dart';
import 'package:supabase_flutter/supabase_flutter.dart' as supabase;

import '../../../core/errors/app_failure.dart';
import '../../../core/errors/result.dart';
import '../../../domain/boundaries/entities/map_shape.dart';
import '../../../domain/boundaries/repositories/boundaries_repository.dart';
import '../../../domain/elections/entities/branch_holder_node.dart';
import '../../../domain/elections/entities/candidacy_detail.dart';
import '../../../domain/elections/entities/candidacy_question_answer.dart';
import '../../../domain/elections/entities/candidate_answer_draft.dart';
import '../../../domain/elections/entities/candidate_application.dart';
import '../../../domain/elections/entities/editable_question.dart';
import '../../../domain/elections/entities/election_candidate.dart';
import '../../../domain/elections/entities/election_seat.dart';
import '../../../domain/elections/entities/election_seat_summary.dart';
import '../../../domain/elections/entities/my_candidacy.dart';
import '../../../domain/elections/entities/my_election_admin_application.dart';
import '../../../domain/elections/entities/politician_engagement.dart';
import '../../../domain/elections/entities/representation_branch.dart';
import '../../../domain/elections/entities/seat_admin_status.dart';
import '../../../domain/elections/repositories/elections_repository.dart';
import '../datasources/elections_remote_data_source.dart';
import '../models/branch_holder_node_model.dart';
import '../models/election_seat_model.dart';
import '../models/election_seat_summary_model.dart';

/// The role a person holds when they ARE the head of their branch, rather
/// than a local representative reporting up to one — ported verbatim from
/// `HEAD_ROLE_TITLES` (src/lib/services/elections.ts).
const _headRoleTitles = {
  'Mayor',
  'Governor',
  'Premier',
  'Prime Minister',
  'President',
  'Chief Minister',
  'Board Chair',
};

sealed class _SuperiorSource {
  const _SuperiorSource();
}

class _NationalSource extends _SuperiorSource {
  const _NationalSource();
}

class _ContainerSource extends _SuperiorSource {
  const _ContainerSource(this.containerType);
  final String containerType;
}

/// Ported verbatim from `SUPERIOR_SOURCE` (src/lib/services/elections.ts) —
/// where to find the "top" office for a boundary_type that isn't itself a
/// head-of-branch shape.
final Map<String, _SuperiorSource> _superiorSource = {
  'Canada:Federal': const _NationalSource(),
  'USA:Federal': const _NationalSource(),
  'India:Lok Sabha': const _NationalSource(),
  'Canada:Provincial': const _ContainerSource('Province'),
  'USA:State Senate': const _ContainerSource('State'),
  'USA:State House': const _ContainerSource('State'),
  'India:Vidhan Sabha': const _ContainerSource('State'),
};

String _branchKeyFor(MapShape shape) =>
    (shape.boundaryType ?? '').toLowerCase().replaceAll(RegExp(r'\s+'), '-');

class ElectionsRepositoryImpl implements ElectionsRepository {
  const ElectionsRepositoryImpl(this._remote, this._boundariesRepository);

  final ElectionsRemoteDataSource _remote;
  final BoundariesRepository _boundariesRepository;

  bool _isHead(Map<String, dynamic> row) =>
      _headRoleTitles.contains(row.roleTitleOrNull ?? '');

  @override
  Future<Result<List<MyCandidacy>>> getMyCandidacies(String profileId) async {
    try {
      final rows = await _remote.getMyCandidacies(profileId);
      return Result.ok(
        rows
            .cast<Map<String, dynamic>>()
            .map((r) => r.toMyCandidacy())
            .toList(),
      );
    } on supabase.PostgrestException catch (e) {
      return Result.err(ServerFailure(e.message, code: e.code));
    } catch (_) {
      return const Result.err(NetworkFailure());
    }
  }

  @override
  Future<Result<void>> applyForSeat(String seatId) async {
    try {
      await _remote.applyForSeat(seatId);
      return const Result.ok(null);
    } on supabase.PostgrestException catch (e) {
      return Result.err(ServerFailure(e.message, code: e.code));
    } catch (_) {
      return const Result.err(NetworkFailure());
    }
  }

  @override
  Future<Result<void>> deleteCandidacy(String candidateId) async {
    try {
      await _remote.deleteCandidacy(candidateId);
      return const Result.ok(null);
    } on supabase.PostgrestException catch (e) {
      return Result.err(ServerFailure(e.message, code: e.code));
    } catch (_) {
      return const Result.err(NetworkFailure());
    }
  }

  @override
  Future<Result<ElectionSeat>> getSeatById(String seatId) async {
    try {
      final row = await _remote.getSeatById(seatId);
      return Result.ok(row.toElectionSeat());
    } on supabase.PostgrestException catch (e) {
      return Result.err(ServerFailure(e.message, code: e.code));
    } catch (_) {
      return const Result.err(NetworkFailure());
    }
  }

  @override
  Future<Result<List<ElectionCandidate>>> getCandidatesForSeat(
    String seatId,
  ) async {
    try {
      final rows = await _remote.getCandidatesForSeat(seatId);
      return Result.ok(
        rows
            .cast<Map<String, dynamic>>()
            .map((r) => r.toElectionCandidate())
            .toList(),
      );
    } on supabase.PostgrestException catch (e) {
      return Result.err(ServerFailure(e.message, code: e.code));
    } catch (_) {
      return const Result.err(NetworkFailure());
    }
  }

  @override
  Future<Result<CandidacyDetail>> getCandidateById(String candidateId) async {
    try {
      final row = await _remote.getCandidateById(candidateId);
      return Result.ok(row.toCandidacyDetail());
    } on supabase.PostgrestException catch (e) {
      return Result.err(ServerFailure(e.message, code: e.code));
    } catch (_) {
      return const Result.err(NetworkFailure());
    }
  }

  @override
  Future<Result<List<CandidacyQuestionAnswer>>> getCandidateAnswers(
    String candidateId,
  ) async {
    try {
      final rows = await _remote.getPublicCandidateAnswers(candidateId);
      return Result.ok(
        rows
            .cast<Map<String, dynamic>>()
            .map((r) => r.toCandidacyQuestionAnswer())
            .toList(),
      );
    } on supabase.PostgrestException catch (e) {
      return Result.err(ServerFailure(e.message, code: e.code));
    } catch (_) {
      return const Result.err(NetworkFailure());
    }
  }

  @override
  Future<Result<void>> requestCandidacyClaim(
    String candidateId, {
    required String motivation,
    required String contactEmail,
    String? socialMediaInfo,
  }) async {
    try {
      await _remote.requestCandidacyClaim(
        candidateId,
        motivation: motivation,
        contactEmail: contactEmail,
        socialMediaInfo: socialMediaInfo,
      );
      return const Result.ok(null);
    } on supabase.PostgrestException catch (e) {
      return Result.err(ServerFailure(e.message, code: e.code));
    } catch (_) {
      return const Result.err(NetworkFailure());
    }
  }

  @override
  Future<Result<SeatAdminStatus>> getSeatAdminStatus(String seatId) async {
    try {
      final row = await _remote.getSeatAdminStatus(seatId);
      return Result.ok(row.toSeatAdminStatus());
    } on supabase.PostgrestException catch (e) {
      return Result.err(ServerFailure(e.message, code: e.code));
    } catch (_) {
      return const Result.err(NetworkFailure());
    }
  }

  @override
  Future<Result<void>> applyForElectionAdmin(
    String seatId, {
    required String motivation,
    required String contactEmail,
    String? socialMediaInfo,
  }) async {
    try {
      await _remote.applyForElectionAdmin(
        seatId,
        motivation: motivation,
        contactEmail: contactEmail,
        socialMediaInfo: socialMediaInfo,
      );
      return const Result.ok(null);
    } on supabase.PostgrestException catch (e) {
      return Result.err(ServerFailure(e.message, code: e.code));
    } catch (_) {
      return const Result.err(NetworkFailure());
    }
  }

  @override
  Future<Result<List<MyElectionAdminApplication>>>
  getMyElectionAdminApplications(String profileId) async {
    try {
      final rows = await _remote.getMyElectionAdminApplications(profileId);
      return Result.ok(
        rows
            .cast<Map<String, dynamic>>()
            .map((r) => r.toMyElectionAdminApplication())
            .toList(),
      );
    } on supabase.PostgrestException catch (e) {
      return Result.err(ServerFailure(e.message, code: e.code));
    } catch (_) {
      return const Result.err(NetworkFailure());
    }
  }

  @override
  Future<Result<CandidateApplication>> getCandidateApplication(
    String candidateId,
  ) async {
    try {
      final row = await _remote.getCandidateApplication(candidateId);
      return Result.ok(row.toCandidateApplication());
    } on supabase.PostgrestException catch (e) {
      return Result.err(ServerFailure(e.message, code: e.code));
    } catch (_) {
      return const Result.err(NetworkFailure());
    }
  }

  @override
  Future<Result<List<EditableQuestion>>> getElectionQuestions(
    String electionId,
  ) async {
    try {
      final rows = await _remote.getElectionQuestions(electionId);
      return Result.ok(
        rows
            .cast<Map<String, dynamic>>()
            .map((r) => r.toEditableQuestion())
            .toList(),
      );
    } on supabase.PostgrestException catch (e) {
      return Result.err(ServerFailure(e.message, code: e.code));
    } catch (_) {
      return const Result.err(NetworkFailure());
    }
  }

  @override
  Future<Result<List<CandidateAnswerDraft>>> getCandidateAnswerDrafts(
    String candidateId,
  ) async {
    try {
      final rows = await _remote.getCandidateAnswerDrafts(candidateId);
      return Result.ok(
        rows
            .cast<Map<String, dynamic>>()
            .map((r) => r.toCandidateAnswerDraft())
            .toList(),
      );
    } on supabase.PostgrestException catch (e) {
      return Result.err(ServerFailure(e.message, code: e.code));
    } catch (_) {
      return const Result.err(NetworkFailure());
    }
  }

  @override
  Future<Result<void>> updateCandidateStatement(
    String candidateId,
    String statement,
  ) async {
    try {
      await _remote.updateCandidateStatement(candidateId, statement);
      return const Result.ok(null);
    } on supabase.PostgrestException catch (e) {
      return Result.err(ServerFailure(e.message, code: e.code));
    } catch (_) {
      return const Result.err(NetworkFailure());
    }
  }

  @override
  Future<Result<void>> updateCandidateIntroVideoUrl(
    String candidateId,
    String url,
  ) async {
    try {
      await _remote.updateCandidateIntroVideoUrl(candidateId, url);
      return const Result.ok(null);
    } on supabase.PostgrestException catch (e) {
      return Result.err(ServerFailure(e.message, code: e.code));
    } catch (_) {
      return const Result.err(NetworkFailure());
    }
  }

  @override
  Future<Result<String>> uploadCandidateVideo(
    Uint8List bytes,
    String fileExtension,
  ) async {
    try {
      final url = await _remote.uploadCandidateVideo(bytes, fileExtension);
      return Result.ok(url);
    } on supabase.StorageException catch (e) {
      return Result.err(ServerFailure(e.message));
    } catch (_) {
      return const Result.err(NetworkFailure());
    }
  }

  @override
  Future<Result<CandidateAnswerDraft>> upsertCandidateAnswer(
    String candidateId,
    String questionId, {
    String? optionId,
    String? textAnswer,
    int? ratingValue,
  }) async {
    try {
      final row = await _remote.upsertCandidateAnswer(
        candidateId,
        questionId,
        optionId: optionId,
        textAnswer: textAnswer,
        ratingValue: ratingValue,
      );
      return Result.ok(row.toCandidateAnswerDraftFromUpsert());
    } on supabase.PostgrestException catch (e) {
      return Result.err(ServerFailure(e.message, code: e.code));
    } catch (_) {
      return const Result.err(NetworkFailure());
    }
  }

  @override
  Future<Result<void>> setCandidateAnswerOptions(
    String answerId,
    List<String> optionIds,
  ) async {
    try {
      await _remote.setCandidateAnswerOptions(answerId, optionIds);
      return const Result.ok(null);
    } on supabase.PostgrestException catch (e) {
      return Result.err(ServerFailure(e.message, code: e.code));
    } catch (_) {
      return const Result.err(NetworkFailure());
    }
  }

  @override
  Future<Result<void>> setCandidateAnswerRanking(
    String answerId,
    List<String> orderedOptionIds,
  ) async {
    try {
      await _remote.setCandidateAnswerRanking(answerId, orderedOptionIds);
      return const Result.ok(null);
    } on supabase.PostgrestException catch (e) {
      return Result.err(ServerFailure(e.message, code: e.code));
    } catch (_) {
      return const Result.err(NetworkFailure());
    }
  }

  @override
  Future<Result<void>> submitCandidateApplication(String candidateId) async {
    try {
      await _remote.submitCandidateApplication(candidateId);
      return const Result.ok(null);
    } on supabase.PostgrestException catch (e) {
      return Result.err(ServerFailure(e.message, code: e.code));
    } catch (_) {
      return const Result.err(NetworkFailure());
    }
  }

  @override
  Future<Result<Map<String, PoliticianEngagement>>>
  getPoliticianEngagementSummaries(List<String> politicianIds) async {
    try {
      final rows = await _remote.getPoliticianEngagementSummaries(
        politicianIds,
      );
      final byId = <String, PoliticianEngagement>{};
      for (final row in rows.cast<Map<String, dynamic>>()) {
        final engagement = row.toPoliticianEngagement();
        byId[engagement.politicianId] = engagement;
      }
      return Result.ok(byId);
    } on supabase.PostgrestException catch (e) {
      return Result.err(ServerFailure(e.message, code: e.code));
    } catch (_) {
      return const Result.err(NetworkFailure());
    }
  }

  @override
  Future<Result<RepresentationBranch>> resolveRepresentationBranch(
    MapShape shape,
  ) async {
    try {
      final rawRows = await _remote.getOfficeHoldersForShape(shape.id);
      final rows = rawRows.cast<Map<String, dynamic>>();

      final headHere = rows.where(_isHead).toList();
      final restHere = rows.where((r) => !_isHead(r)).toList();

      BranchHolderNode? top;
      List<BranchHolderNode> bottom;

      if (headHere.isNotEmpty) {
        top = headHere.first.toBranchHolderNode();
        bottom = restHere.map((r) => r.toBranchHolderNode()).toList();
      } else {
        bottom = rows.map((r) => r.toBranchHolderNode()).toList();
        final config =
            _superiorSource['${shape.country}:${shape.boundaryType}'];

        if (config is _NationalSource) {
          final nationalResult = await _boundariesRepository
              .getNationalShapeForCountry(shape.country ?? '');
          final national = nationalResult.valueOrNull;
          if (national != null) {
            final nHolders = await _remote.getOfficeHoldersForShape(
              national.id,
            );
            final head = nHolders
                .cast<Map<String, dynamic>>()
                .where(_isHead)
                .firstOrNull;
            if (head != null) top = head.toBranchHolderNode();
          }
        } else if (config is _ContainerSource) {
          final containersResult = await _boundariesRepository
              .getShapeContainers(shape.id);
          final containers = containersResult.valueOrNull ?? const [];
          final match = containers
              .where((c) => c.boundaryType == config.containerType)
              .firstOrNull;
          if (match != null) {
            final cHolders = await _remote.getOfficeHoldersForShape(match.id);
            final head = cHolders
                .cast<Map<String, dynamic>>()
                .where(_isHead)
                .firstOrNull;
            if (head != null) top = head.toBranchHolderNode();
          }
        }
      }

      return Result.ok(
        RepresentationBranch(
          key: _branchKeyFor(shape),
          label: shape.boundaryType ?? '',
          districtName: shape.name,
          top: top,
          bottom: bottom,
        ),
      );
    } on supabase.PostgrestException catch (e) {
      return Result.err(ServerFailure(e.message, code: e.code));
    } catch (_) {
      return const Result.err(NetworkFailure());
    }
  }

  Future<Map<String, int>> _candidateCounts(List<String> seatIds) async {
    if (seatIds.isEmpty) return {};
    final rows = await _remote.getCandidateSeatIds(seatIds);
    final counts = <String, int>{};
    for (final row in rows.cast<Map<String, dynamic>>()) {
      final seatId = row['seat_id'] as String;
      counts[seatId] = (counts[seatId] ?? 0) + 1;
    }
    return counts;
  }

  @override
  Future<Result<List<ElectionSeatSummary>>> getActiveSeatsByShapeIds(
    List<int> shapeIds,
  ) async {
    try {
      if (shapeIds.isEmpty) return const Result.ok([]);
      final rows = await _remote.getActiveSeatsByShapeIds(shapeIds);
      final seatRows = rows.cast<Map<String, dynamic>>();
      final counts = await _candidateCounts(
        seatRows.map((r) => r['id'] as String).toList(),
      );
      return Result.ok(
        seatRows
            .map(
              (r) =>
                  r.toElectionSeatSummary(candidateCount: counts[r['id']] ?? 0),
            )
            .toList(),
      );
    } on supabase.PostgrestException catch (e) {
      return Result.err(ServerFailure(e.message, code: e.code));
    } catch (_) {
      return const Result.err(NetworkFailure());
    }
  }

  @override
  Future<Result<List<ElectionSeatSummary>>> getActiveSeats({
    int limit = 30,
    int offset = 0,
  }) async {
    try {
      final rows = await _remote.getActiveSeats(limit: limit, offset: offset);
      final seatRows = rows.cast<Map<String, dynamic>>();
      final counts = await _candidateCounts(
        seatRows.map((r) => r['id'] as String).toList(),
      );
      return Result.ok(
        seatRows
            .map(
              (r) =>
                  r.toElectionSeatSummary(candidateCount: counts[r['id']] ?? 0),
            )
            .toList(),
      );
    } on supabase.PostgrestException catch (e) {
      return Result.err(ServerFailure(e.message, code: e.code));
    } catch (_) {
      return const Result.err(NetworkFailure());
    }
  }
}
