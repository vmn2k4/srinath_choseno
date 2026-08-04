"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import AdminSubNav from "./AdminSubNav";
import CascadingBoundarySelector from "./CascadingBoundarySelector";
import AnswerValue from "./AnswerValue";
import { getGhostDisplayName } from "@/lib/utils/ghostName";
import {
  getElections,
  createElection,
  advanceElectionStatus,
  deleteElection,
  getElectionRoleTypes,
  getElectionSeatsByElectionId,
  getElectionCandidatesBySeatIds,
  createElectionSeats,
  deleteElectionSeat,
  deleteCandidacy,
  reviewCandidateApplication,
  getElectionQuestions,
  createElectionQuestion,
  deleteElectionQuestion,
  createElectionQuestionOptions,
  resolveRegionNames,
} from "@/lib/services/elections";
import {
  getCountries,
  listBoundaryTypes,
  getMapShapesByType,
  findShapesInContainers,
  getBoundaryCandidates,
} from "@/lib/services/boundaries";
import {
  getCandidateSourceInfoForSeats,
  fetchOfficialCandidates,
  addFetchedCandidate,
  type CandidateSourceInfo,
} from "@/lib/services/candidateSync";
import {
  Plus,
  Trash2,
  Landmark,
  MapPin,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  XCircle,
  Video,
  ExternalLink,
  Download,
  Loader2,
} from "lucide-react";
import {
  Card,
  Button,
  Badge,
  Input,
  Select,
  Checkbox,
  Spinner,
  EmptyState,
  PageHeader,
  ConfirmDialog,
} from "@/components/primitives";
import { createClient } from "@/lib/supabase/client";

const STATUS_FLOW: Record<string, string> = {
  draft: "nominations_open",
  nominations_open: "active",
  active: "closed",
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Open Nominations",
  nominations_open: "Activate Election",
  active: "Close Election",
};

const CANDIDATE_STATUS_TONE: Record<string, "amber" | "emerald" | "rose"> = {
  pending: "amber",
  approved: "emerald",
  rejected: "rose",
};

const ELECTION_STATUS_TONE: Record<string, "neutral" | "amber" | "emerald"> = {
  draft: "neutral",
  nominations_open: "amber",
  active: "emerald",
  closed: "neutral",
};

const QUESTION_TYPES = [
  { value: "single_choice", label: "Single choice" },
  { value: "multiple_choice", label: "Multiple choice" },
  { value: "text", label: "Free text" },
  { value: "rating", label: "Rating (1–5)" },
] as const;
const QUESTION_TYPE_NEEDS_OPTIONS = new Set(["single_choice", "multiple_choice"]);
const QUESTION_TYPE_LABEL: Record<string, string> = Object.fromEntries(
  QUESTION_TYPES.map((t) => [t.value, t.label])
);

type ConfirmTarget =
  | { kind: "election"; id: string; label: string }
  | { kind: "seat"; id: string; label: string }
  | { kind: "candidate"; id: string; label: string }
  | { kind: "question"; id: string; label: string };

export default function ElectionsAdminClient() {
  const supabase = createClient();
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [elections, setElections] = useState<any[]>([]);
  const [loadingElections, setLoadingElections] = useState(true);
  const [selectedElection, setSelectedElection] = useState<any>(null);

  const [newName, setNewName] = useState("");
  const [newDate, setNewDate] = useState("");
  const [createStatus, setCreateStatus] = useState("");

  const [seats, setSeats] = useState<any[]>([]);
  const [loadingSeats, setLoadingSeats] = useState(false);

  // Candidate questionnaire (per election)
  const [questions, setQuestions] = useState<any[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [newQuestionText, setNewQuestionText] = useState("");
  const [newQuestionType, setNewQuestionType] = useState("single_choice");
  const [newQuestionOptions, setNewQuestionOptions] = useState(["", ""]);
  const [newQuestionRequired, setNewQuestionRequired] = useState(true);
  const [newQuestionAllowContext, setNewQuestionAllowContext] = useState(false);
  const [newQuestionVisible, setNewQuestionVisible] = useState(true);
  const [questionStatus, setQuestionStatus] = useState("");

  const [expandedCandidateId, setExpandedCandidateId] = useState<string | null>(null);

  // Official candidate data (docs/ELECTION_DATA_SOURCES.md)
  const [candidateSourceInfo, setCandidateSourceInfo] = useState<Map<string, CandidateSourceInfo>>(
    new Map()
  );
  const [fetchResultsBySeat, setFetchResultsBySeat] = useState<Record<string, any>>({});
  const [addingCandidateKey, setAddingCandidateKey] = useState<string | null>(null);

  // Seat-building wizard
  const [countries, setCountries] = useState<string[]>([]);
  const [seatCountry, setSeatCountry] = useState("");
  const [boundaryTypes, setBoundaryTypes] = useState<any[]>([]);
  const [containerType, setContainerType] = useState("");
  const [containerId, setContainerId] = useState("");
  const [containerOptions, setContainerOptions] = useState<{ value: string; label: string }[]>([]);
  const [loadingContainers, setLoadingContainers] = useState(false);
  const [targetType, setTargetType] = useState("");
  const [boundaryCandidates, setBoundaryCandidates] = useState<any[]>([]);
  const [loadingBoundaryCandidates, setLoadingBoundaryCandidates] = useState(false);
  const [boundarySearch, setBoundarySearch] = useState("");
  const [pendingShapeIds, setPendingShapeIds] = useState<Set<number>>(new Set());
  // null = no restriction yet (browse every targetType boundary in
  // seatCountry); once "Find Matching Boundaries" runs, holds exactly the
  // ids it found so the review picker only shows that scoped set instead of
  // every boundary of that type country-wide.
  const [matchedShapeIds, setMatchedShapeIds] = useState<Set<number> | null>(null);
  const [roleTypes, setRoleTypes] = useState<any[]>([]);
  const [selectedRoleKeys, setSelectedRoleKeys] = useState<Set<string>>(new Set());
  const [seatStatus, setSeatStatus] = useState("");

  const [confirmTarget, setConfirmTarget] = useState<ConfirmTarget | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const fetchElections = async () => {
    setLoadingElections(true);
    const { data } = await getElections(supabase);
    setElections(data || []);
    setLoadingElections(false);

    const electionIdParam = searchParams.get("election");
    if (electionIdParam && data) {
      const match = data.find((e: any) => e.id === electionIdParam);
      if (match) setSelectedElection(match);
    }
  };

  useEffect(() => {
    Promise.resolve().then(() => fetchElections());
    getCountries(supabase).then(({ data }) => setCountries((data || []).map((c: any) => c.name)));
    listBoundaryTypes(supabase).then(({ data }) => setBoundaryTypes(data || []));
  }, [supabase]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchSeats = async (electionId: string) => {
    setLoadingSeats(true);
    const { data: seatRows } = await getElectionSeatsByElectionId(supabase, electionId);

    const seatIds = (seatRows || []).map((s: any) => s.id);
    const candidatesBySeat: Record<string, any[]> = {};
    if (seatIds.length > 0) {
      const { data: candRows } = await getElectionCandidatesBySeatIds(supabase, seatIds);
      (candRows || []).forEach((c: any) => {
        candidatesBySeat[c.seat_id] = candidatesBySeat[c.seat_id] || [];
        const sortedAnswers = [...(c.election_candidate_answers || [])].sort(
          (a: any, b: any) => (a.election_questions?.rank ?? 0) - (b.election_questions?.rank ?? 0)
        );
        candidatesBySeat[c.seat_id].push({ ...c, election_candidate_answers: sortedAnswers });
      });
    }

    const nextSeats = (seatRows || []).map((s: any) => ({
      ...s,
      candidates: candidatesBySeat[s.id] || [],
    }));
    setSeats(nextSeats);
    setLoadingSeats(false);
    setFetchResultsBySeat({});

    const sourceInfo = await getCandidateSourceInfoForSeats(supabase, nextSeats);
    setCandidateSourceInfo(sourceInfo);
  };

  const fetchQuestions = async (electionId: string) => {
    setLoadingQuestions(true);
    const { data } = await getElectionQuestions(supabase, electionId);
    setQuestions(
      (data || []).map((q: any) => ({
        ...q,
        election_question_options: [...(q.election_question_options || [])].sort(
          (a: any, b: any) => a.rank - b.rank
        ),
      }))
    );
    setLoadingQuestions(false);
  };

  useEffect(() => {
    Promise.resolve().then(() => {
      if (selectedElection) {
        fetchSeats(selectedElection.id);
        fetchQuestions(selectedElection.id);
        setExpandedCandidateId(null);
        setPendingShapeIds(new Set());
        setMatchedShapeIds(null);
        setSelectedRoleKeys(new Set());
        setSeatStatus("");
      } else {
        setSeats([]);
        setQuestions([]);
      }
    });
  }, [selectedElection?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const typesForSeatCountry = seatCountry ? boundaryTypes.filter((t) => t.country === seatCountry) : [];
  // Container types (Canada's Province, ...) exist purely to help admins
  // scope a seat-building batch. USA's 'State' is BOTH a container (like
  // Province) AND a real target (Governor/U.S. Senator seats attach to it
  // directly) — is_container and admin_only are deliberately separate flags,
  // so a type can be one, the other, or both.
  const containerTypeOptions = typesForSeatCountry
    .filter((t) => t.is_container)
    .map((t) => ({ value: t.type_name, label: t.type_name }));
  const targetTypeOptions = typesForSeatCountry.filter((t) => !t.admin_only);
  const countryOptions = countries.map((c) => ({ value: c, label: c }));

  // Country scopes both the container/target-type pickers and the manual
  // seat picker below — reset any selection tied to the previous country.
  useEffect(() => {
    Promise.resolve().then(() => {
      setTargetType("");
      setContainerType("");
      setContainerId("");
      setContainerOptions([]);
      setPendingShapeIds(new Set());
      setMatchedShapeIds(null);
      setBoundaryCandidates([]);
    });
  }, [seatCountry]);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      setContainerId("");
      if (!seatCountry || !containerType) {
        setContainerOptions([]);
        return;
      }
      setLoadingContainers(true);
      (async () => {
        const { data } = await getMapShapesByType(supabase, {
          country: seatCountry,
          boundaryType: containerType,
          columns: "id, name",
          orderBy: "name",
        });
        if (!cancelled) {
          setContainerOptions((data || []).map((s: any) => ({ value: String(s.id), label: s.name })));
          setLoadingContainers(false);
        }
      })();
    });
    return () => {
      cancelled = true;
    };
  }, [seatCountry, containerType]); // eslint-disable-line react-hooks/exhaustive-deps

  // Target type scopes both the shape selection and the role catalog — reset
  // both when it changes so a stale selection from a different boundary type
  // can't leak into seat creation.
  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      setPendingShapeIds(new Set());
      setMatchedShapeIds(null);
      setSelectedRoleKeys(new Set());
      setBoundarySearch("");
      if (!seatCountry || !targetType) {
        setBoundaryCandidates([]);
        return;
      }
      setLoadingBoundaryCandidates(true);
      (async () => {
        const { data } = await getBoundaryCandidates(supabase, {
          boundaryTypeFilter: [targetType],
          countryFilter: seatCountry,
        });
        if (!cancelled) {
          setBoundaryCandidates(data || []);
          setLoadingBoundaryCandidates(false);
        }
      })();
    });
    return () => {
      cancelled = true;
    };
  }, [seatCountry, targetType]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (!seatCountry || !targetType) {
        setRoleTypes([]);
        return;
      }
      (async () => {
        const { data } = await getElectionRoleTypes(supabase, seatCountry, targetType);
        if (!cancelled) setRoleTypes(data || []);
      })();
    });
    return () => {
      cancelled = true;
    };
  }, [seatCountry, targetType]); // eslint-disable-line react-hooks/exhaustive-deps

  // Checkbox labels always show the default (region_override='') title — a
  // single seat-creation batch can span multiple regions, so the actual
  // per-seat title is resolved per shape in handleCreateSeats, not assumed
  // uniform across the batch.
  const roleOptions = roleTypes.filter((r) => r.region_override === "");

  const toggleRoleKey = (key: string) => {
    setSelectedRoleKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleShapeId = (id: number) => {
    setPendingShapeIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const resolveRoleTitle = (roleKey: string, regionName?: string | null) => {
    const override =
      regionName && roleTypes.find((r) => r.role_key === roleKey && r.region_override === regionName);
    if (override) return override.role_title;
    const fallback = roleTypes.find((r) => r.role_key === roleKey && r.region_override === "");
    return fallback ? fallback.role_title : roleKey;
  };

  const handleCreateElection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newDate) return;
    setCreateStatus("");

    const { data, error } = await createElection(supabase, {
      name: newName.trim(),
      electionDate: newDate,
    });

    if (error) {
      setCreateStatus("Error: " + error.message);
      return;
    }

    setNewName("");
    setNewDate("");
    await fetchElections();
    if (data) {
      setSelectedElection(data);
      router.push(`/admin/elections?election=${data.id}`);
    }
  };

  const handleAdvanceStatus = async (electionId: string, currentStatus: string) => {
    const nextStatus = STATUS_FLOW[currentStatus];
    if (!nextStatus) return;
    const { error } = await advanceElectionStatus(supabase, electionId, nextStatus);
    if (error) {
      setSeatStatus("Error: " + error.message);
      return;
    }
    if (selectedElection?.id === electionId) {
      setSelectedElection({ ...selectedElection, status: nextStatus });
    }
    await fetchElections();
  };

  const handleFindMatching = async () => {
    if (!targetType) {
      setSeatStatus("Pick a target type first.");
      return;
    }
    const containerShapeIds = containerId ? [Number(containerId)] : [];

    const { data, error } = containerShapeIds.length > 0
      ? await findShapesInContainers(supabase, {
          containerShapeIds,
          targetBoundaryType: targetType,
          country: seatCountry,
        })
      : await getMapShapesByType(supabase, { country: seatCountry, boundaryType: targetType, paginated: true });
    if (error) {
      setSeatStatus("Error: " + ((error as any).message || "Operation failed"));
      return;
    }
    setPendingShapeIds((prev) => {
      const next = new Set(prev);
      (data || []).forEach((shape: any) => next.add(shape.id));
      return next;
    });
    // Additive: running "Find Matching Boundaries" again grows the
    // restriction rather than replacing it, so the review list shows the
    // union of every run instead of just the most recent one.
    setMatchedShapeIds((prev) => {
      const next = new Set(prev || []);
      (data || []).forEach((shape: any) => next.add(shape.id));
      return next;
    });
    const scopeLabel = containerShapeIds.length > 0 ? "the selected container" : `all of ${seatCountry}`;
    setSeatStatus(
      `Added ${data?.length || 0} matching boundaries (from ${scopeLabel}) to the selection below — review and deselect any stragglers before creating seats.`
    );
  };

  const handleCreateSeats = async () => {
    if (!selectedElection) return;
    if (selectedRoleKeys.size === 0 || pendingShapeIds.size === 0) {
      setSeatStatus("Error: select at least one role and one boundary.");
      return;
    }
    const shapeIds = [...pendingShapeIds];
    const { data: regionRows, error: regionError } = await resolveRegionNames(supabase, shapeIds, seatCountry);
    if (regionError) {
      setSeatStatus("Error: " + regionError.message);
      return;
    }
    const regionByShape = new Map((regionRows || []).map((r: any) => [r.map_shape_id, r.region_name]));

    const rows: { election_id: string; map_shape_id: number; role_title: string }[] = [];
    shapeIds.forEach((map_shape_id) => {
      const regionName = regionByShape.get(map_shape_id);
      selectedRoleKeys.forEach((roleKey) => {
        rows.push({
          election_id: selectedElection.id,
          map_shape_id,
          role_title: resolveRoleTitle(roleKey, regionName as string | undefined),
        });
      });
    });

    const { error } = await createElectionSeats(supabase, rows);
    if (error) {
      setSeatStatus("Error: " + error.message);
      return;
    }
    setPendingShapeIds(new Set());
    setContainerId("");
    setSelectedRoleKeys(new Set());
    setSeatStatus(`Created ${rows.length} seat(s).`);
    fetchSeats(selectedElection.id);
  };

  const handleFetchCandidates = async (seatId: string) => {
    setFetchResultsBySeat((prev) => ({ ...prev, [seatId]: { loading: true } }));
    const result = await fetchOfficialCandidates(supabase, seatId);
    setFetchResultsBySeat((prev) => ({ ...prev, [seatId]: { loading: false, ...result } }));
  };

  const handleAddFetchedCandidate = async (seat: any, candidate: { name: string; party?: string | null }) => {
    const key = `${seat.id}:${candidate.name}`;
    setAddingCandidateKey(key);
    const { error } = await addFetchedCandidate(supabase, seat.id, seat.map_shapes?.country ?? null, candidate);
    setAddingCandidateKey(null);
    if (error) {
      setSeatStatus("Error adding candidate: " + error.message);
      return;
    }
    if (selectedElection) await fetchSeats(selectedElection.id);
  };

  const handleRejectCandidate = async (candidateId: string) => {
    if (!user) return;
    const { error } = await reviewCandidateApplication(supabase, candidateId, {
      approve: false,
      reviewedBy: user.id,
    });
    if (error) {
      setSeatStatus("Error: " + error.message);
      return;
    }
    if (selectedElection) fetchSeats(selectedElection.id);
  };

  const updateNewOptionField = (i: number, val: string) => {
    setNewQuestionOptions((prev) => prev.map((o, idx) => (idx === i ? val : o)));
  };
  const addNewOptionField = () => setNewQuestionOptions((prev) => [...prev, ""]);
  const removeNewOptionField = (i: number) => setNewQuestionOptions((prev) => prev.filter((_, idx) => idx !== i));

  const handleAddQuestion = async () => {
    if (!selectedElection) return;
    const needsOptions = QUESTION_TYPE_NEEDS_OPTIONS.has(newQuestionType);
    const opts = needsOptions ? newQuestionOptions.map((o) => o.trim()).filter(Boolean) : [];
    if (!newQuestionText.trim() || (needsOptions && opts.length < 2)) {
      setQuestionStatus(
        needsOptions
          ? "Error: question text and at least 2 options are required."
          : "Error: question text is required."
      );
      return;
    }
    const { data: q, error } = await createElectionQuestion(supabase, {
      election_id: selectedElection.id,
      question_text: newQuestionText.trim(),
      question_type: newQuestionType,
      required: newQuestionRequired,
      allow_context: newQuestionAllowContext,
      visible_to_public: newQuestionVisible,
      rank: questions.length,
    });
    if (error || !q) {
      setQuestionStatus("Error: " + (error?.message || "Failed to create question."));
      return;
    }

    if (needsOptions) {
      const { error: optErr } = await createElectionQuestionOptions(
        supabase,
        opts.map((option_text, i) => ({ question_id: q.id, option_text, rank: i }))
      );
      if (optErr) {
        setQuestionStatus("Error: " + optErr.message);
        return;
      }
    }

    setNewQuestionText("");
    setNewQuestionType("single_choice");
    setNewQuestionOptions(["", ""]);
    setNewQuestionRequired(true);
    setNewQuestionAllowContext(false);
    setNewQuestionVisible(true);
    setQuestionStatus("");
    fetchQuestions(selectedElection.id);
  };

  const handleConfirmDelete = async () => {
    if (!confirmTarget) return;
    setConfirmBusy(true);
    if (confirmTarget.kind === "election") {
      await deleteElection(supabase, confirmTarget.id);
      if (selectedElection?.id === confirmTarget.id) {
        setSelectedElection(null);
        router.push("/admin/elections");
      }
      await fetchElections();
    } else if (confirmTarget.kind === "seat") {
      await deleteElectionSeat(supabase, confirmTarget.id);
      if (selectedElection) await fetchSeats(selectedElection.id);
    } else if (confirmTarget.kind === "candidate") {
      await deleteCandidacy(supabase, confirmTarget.id);
      if (selectedElection) await fetchSeats(selectedElection.id);
    } else if (confirmTarget.kind === "question") {
      await deleteElectionQuestion(supabase, confirmTarget.id);
      if (selectedElection) await fetchQuestions(selectedElection.id);
    }
    setConfirmBusy(false);
    setConfirmTarget(null);
  };

  const filteredBoundaryCandidates = boundaryCandidates
    .filter((shape) => !matchedShapeIds || matchedShapeIds.has(shape.id))
    .filter((shape) => !boundarySearch.trim() || shape.name?.toLowerCase().includes(boundarySearch.trim().toLowerCase()))
    .slice(0, 500);

  if (loadingElections) return <Spinner fullPage />;

  return (
    <div className="w-full max-w-none animate-fade-in pb-20 px-4 lg:px-8 space-y-8">
      <PageHeader
        title="Elections & Seats Admin"
        subtitle="Manage electoral events, seat boundaries, and candidate applications."
      />

      <AdminSubNav active="elections" />

      {/* Create New Election Form */}
      <Card padding="md" className="space-y-4">
        <h2 className="text-lg font-bold text-text-main flex items-center gap-2">
          <Plus size={18} className="text-primary" /> Create New Election Event
        </h2>

        <form onSubmit={handleCreateElection} className="flex flex-wrap gap-3 items-center">
          <Input
            placeholder="Election Name (e.g. 2026 Vancouver Municipal)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="text-xs w-72"
            required
          />
          <Input
            type="date"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            className="text-xs w-44"
            required
          />
          <Button type="submit" size="sm" className="text-xs">
            Create Election
          </Button>
        </form>

        {createStatus && <p className="text-xs text-danger">{createStatus}</p>}
      </Card>

      {/* Elections List */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold text-text-muted uppercase tracking-wider">
          All Elections ({elections.length})
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {elections.map((elec) => {
            const isSelected = selectedElection?.id === elec.id;
            const tone = ELECTION_STATUS_TONE[elec.status] || "neutral";

            return (
              <Card
                key={elec.id}
                padding="md"
                className={`space-y-3 cursor-pointer transition-all ${
                  isSelected
                    ? "border-primary bg-primary/5 shadow-md"
                    : "hover:border-border-light/60"
                }`}
                onClick={() => {
                  setSelectedElection(elec);
                  router.push(`/admin/elections?election=${elec.id}`);
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-text-main text-base">
                      {elec.name}
                    </h3>
                    <p className="text-xs text-text-muted mt-0.5">
                      Date: {elec.election_date}
                    </p>
                  </div>
                  <Badge tone={tone}>{elec.status}</Badge>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border-light/20 text-xs">
                  {STATUS_FLOW[elec.status] && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAdvanceStatus(elec.id, elec.status);
                      }}
                      className="text-xs py-1"
                    >
                      {STATUS_LABEL[elec.status]}
                    </Button>
                  )}

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmTarget({ kind: "election", id: elec.id, label: elec.name });
                    }}
                    className="text-text-muted hover:text-danger p-1 ml-auto cursor-pointer"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Selected Election Detail & Seats List */}
      {selectedElection && (
        <>
          <Card padding="md" className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h2 className="text-xl font-bold text-text-main">{selectedElection.name}</h2>
              <p className="text-xs text-text-muted mt-1">
                {selectedElection.election_date} · Status:{" "}
                <span className="font-semibold text-text-secondary">
                  {selectedElection.status.replace("_", " ")}
                </span>
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {STATUS_FLOW[selectedElection.status] && (
                <Button
                  onClick={() => handleAdvanceStatus(selectedElection.id, selectedElection.status)}
                  size="sm"
                >
                  {STATUS_LABEL[selectedElection.status]}
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                className="text-danger border-danger/40"
                onClick={() =>
                  setConfirmTarget({ kind: "election", id: selectedElection.id, label: selectedElection.name })
                }
              >
                <Trash2 size={14} /> Delete Election
              </Button>
            </div>
          </Card>

          {/* CANDIDATE QUESTIONNAIRE */}
          <Card padding="md" className="space-y-5">
            <div>
              <h3 className="text-lg font-bold text-text-main flex items-center gap-2">
                <HelpCircle size={18} className="text-primary" /> Candidate Questionnaire
              </h3>
              <p className="text-xs text-text-muted mt-1">
                Every candidate must answer required questions (and can add optional written context, if you
                allow it) before submitting their application.
              </p>
            </div>

            {loadingQuestions ? (
              <div className="flex justify-center py-4">
                <Spinner size="sm" />
              </div>
            ) : questions.length === 0 ? (
              <p className="text-xs text-text-muted">
                No questions configured yet — candidates will only need to submit a statement and intro video.
              </p>
            ) : (
              <div className="space-y-2.5">
                {questions.map((q, i) => (
                  <div key={q.id} className="p-3.5 bg-surface/40 rounded-xl border border-border-light/30">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-text-secondary">
                          {i + 1}. {q.question_text}
                        </p>
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          <Badge tone="neutral">{QUESTION_TYPE_LABEL[q.question_type] || q.question_type}</Badge>
                          {q.required && <Badge tone="amber">Required</Badge>}
                          {q.allow_context && (
                            <span className="text-[9px] bg-primary/15 text-primary-light px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">
                              Context allowed
                            </span>
                          )}
                          {!q.visible_to_public && <Badge tone="neutral">Hidden from voters</Badge>}
                        </div>
                        {q.election_question_options?.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {q.election_question_options.map((o: any) => (
                              <span
                                key={o.id}
                                className="text-xs px-2 py-1 bg-surface-hover/60 border border-border-light/30 rounded text-text-tertiary"
                              >
                                {o.option_text}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <Button
                        variant="icon"
                        tone="danger"
                        size="sm"
                        onClick={() =>
                          setConfirmTarget({ kind: "question", id: q.id, label: q.question_text })
                        }
                        className="shrink-0"
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-3 border-t border-border-light/30 space-y-3">
              <Input
                type="text"
                size="sm"
                placeholder="Question text (e.g. Do you support the new transit levy?)"
                value={newQuestionText}
                onChange={(e) => setNewQuestionText(e.target.value)}
              />
              <Select
                value={newQuestionType}
                onChange={(e) => setNewQuestionType(e.target.value)}
                size="sm"
                className="max-w-xs"
              >
                {QUESTION_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </Select>
              {QUESTION_TYPE_NEEDS_OPTIONS.has(newQuestionType) ? (
                <div className="space-y-2">
                  {newQuestionOptions.map((opt, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input
                        type="text"
                        size="sm"
                        placeholder={`Option ${i + 1}`}
                        value={opt}
                        onChange={(e) => updateNewOptionField(i, e.target.value)}
                        className="flex-1"
                      />
                      {newQuestionOptions.length > 2 && (
                        <Button variant="icon" tone="danger" size="sm" onClick={() => removeNewOptionField(i)}>
                          <Trash2 size={13} />
                        </Button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addNewOptionField}
                    className="text-xs font-semibold text-primary-light hover:text-primary transition-colors flex items-center gap-1"
                  >
                    <Plus size={13} /> Add option
                  </button>
                </div>
              ) : newQuestionType === "rating" ? (
                <p className="text-xs text-text-muted">
                  Candidates will rate this on a fixed 1–5 scale — no options needed.
                </p>
              ) : (
                <p className="text-xs text-text-muted">
                  Candidates will type a free-form written answer — no options needed.
                </p>
              )}
              <div className="flex flex-wrap gap-4">
                <Checkbox
                  label="Required"
                  checked={newQuestionRequired}
                  onChange={(e) => setNewQuestionRequired(e.target.checked)}
                />
                <Checkbox
                  label="Allow written context"
                  checked={newQuestionAllowContext}
                  onChange={(e) => setNewQuestionAllowContext(e.target.checked)}
                />
                <Checkbox
                  label="Visible to voters"
                  checked={newQuestionVisible}
                  onChange={(e) => setNewQuestionVisible(e.target.checked)}
                />
              </div>
              <Button onClick={handleAddQuestion} size="sm">
                <Plus size={16} /> Add Question
              </Button>
              {questionStatus && <p className="text-danger text-xs">{questionStatus}</p>}
            </div>
          </Card>

          {/* SEAT-BUILDING WIZARD */}
          {selectedElection.status === "draft" && (
            <Card padding="md" className="space-y-5">
              <h3 className="text-lg font-bold text-text-main flex items-center gap-2">
                <Landmark size={18} className="text-primary" /> Build Seats
              </h3>

              <div>
                <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
                  1. Country + optional container
                </p>
                <CascadingBoundarySelector
                  countries={countryOptions}
                  country={seatCountry}
                  onCountryChange={setSeatCountry}
                  containerTypes={containerTypeOptions}
                  containerType={containerType}
                  onContainerTypeChange={setContainerType}
                  containers={containerOptions}
                  containerId={containerId}
                  onContainerChange={setContainerId}
                  loading={loadingContainers}
                />
                <p className="text-[10px] text-text-muted mt-1.5">
                  Leave the container empty to match every boundary of the target type in the whole country.
                </p>
              </div>

              <div className="flex flex-wrap gap-3 items-center">
                <Select
                  value={targetType}
                  onChange={(e) => setTargetType(e.target.value)}
                  disabled={!seatCountry}
                  size="sm"
                  className="flex-1 min-w-[200px]"
                >
                  <option value="">{seatCountry ? "Select target boundary type..." : "Select a country first"}</option>
                  {targetTypeOptions.map((t) => (
                    <option key={t.type_name} value={t.type_name}>
                      {t.type_name}
                    </option>
                  ))}
                </Select>
                <Button variant="outline" size="sm" onClick={handleFindMatching} disabled={!targetType}>
                  Find Matching Boundaries
                </Button>
              </div>

              <div>
                <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
                  2. Review / manually add or remove seat boundaries
                </p>
                {!targetType ? (
                  <p className="text-xs text-text-muted">Select a target boundary type above first.</p>
                ) : (
                  <>
                    <Input
                      size="sm"
                      placeholder="Filter by name..."
                      value={boundarySearch}
                      onChange={(e) => setBoundarySearch(e.target.value)}
                      className="mb-2"
                    />
                    {loadingBoundaryCandidates ? (
                      <div className="flex justify-center py-6">
                        <Spinner size="sm" />
                      </div>
                    ) : (
                      <div className="max-h-72 overflow-y-auto rounded-xl border border-border-light/30 bg-surface/20 divide-y divide-border-light/10">
                        {filteredBoundaryCandidates.length === 0 ? (
                          <p className="text-xs text-text-muted text-center py-4">No boundaries match.</p>
                        ) : (
                          filteredBoundaryCandidates.map((shape) => (
                            <div key={shape.id} className="px-3 py-1.5 hover:bg-surface-hover/40">
                              <Checkbox
                                label={shape.name}
                                checked={pendingShapeIds.has(shape.id)}
                                onChange={() => toggleShapeId(shape.id)}
                                className="text-xs"
                              />
                            </div>
                          ))
                        )}
                      </div>
                    )}
                    {boundaryCandidates.length > 500 && (
                      <p className="text-[10px] text-text-muted mt-1">
                        Showing first 500 matches — narrow with the filter above to find more.
                      </p>
                    )}
                  </>
                )}
                <p className="text-xs text-text-muted mt-2">{pendingShapeIds.size} boundary(ies) selected</p>
              </div>

              <div className="pt-2 border-t border-border-light/30">
                <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
                  3. Select role(s) for these seats
                </p>
                {!targetType ? (
                  <p className="text-xs text-text-muted">Select a target boundary type above first.</p>
                ) : roleOptions.length === 0 ? (
                  <p className="text-xs text-text-muted">
                    No roles catalogued yet for {seatCountry} / {targetType}.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {roleOptions.map((r) => (
                      <label
                        key={r.role_key}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                          selectedRoleKeys.has(r.role_key)
                            ? "bg-primary/15 border-primary/40 text-primary-light font-semibold"
                            : "bg-surface-hover/60 border-border-light text-text-muted hover:bg-surface-hover"
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="hidden"
                          checked={selectedRoleKeys.has(r.role_key)}
                          onChange={() => toggleRoleKey(r.role_key)}
                        />
                        {r.role_title}
                      </label>
                    ))}
                  </div>
                )}
                <p className="text-[10px] text-text-muted mt-1.5">
                  Regional titles (e.g. Ontario → MPP) are applied automatically per boundary when seats are created.
                </p>
              </div>

              <div className="flex flex-wrap gap-3 items-center pt-2 border-t border-border-light/30">
                <Button onClick={handleCreateSeats} size="sm">
                  Create Seats for Selected
                </Button>
              </div>
              {seatStatus && <p className="text-xs text-primary-light">{seatStatus}</p>}
            </Card>
          )}

          {/* SEATS + CANDIDATES */}
          <Card padding="md">
            <h3 className="text-lg font-bold text-text-main mb-4">Seats ({seats.length})</h3>
            {loadingSeats ? (
              <Spinner />
            ) : seats.length === 0 ? (
              <EmptyState
                title="No Seats Created"
                description="No election seats have been provisioned for this election event."
              />
            ) : (
              <div className="space-y-3">
                {seats.map((seat) => {
                  const info = candidateSourceInfo.get(seat.id);
                  const fetchResult = fetchResultsBySeat[seat.id];
                  return (
                    <div key={seat.id} className="p-3.5 bg-surface/40 rounded-xl border border-border-light/30">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <MapPin size={14} className="text-accent shrink-0" />
                          <a
                            href={`/elections/seat/${seat.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-bold text-text-secondary hover:text-primary transition-colors text-sm truncate flex items-center gap-1.5 group/seat"
                            title="Open in Seat Administrator view"
                          >
                            <span className="group-hover/seat:underline">
                              {seat.role_title} — {seat.map_shapes?.name}
                            </span>
                            <ExternalLink
                              size={13}
                              className="text-text-muted group-hover/seat:text-primary shrink-0 opacity-75 group-hover/seat:opacity-100"
                            />
                          </a>
                          <span className="text-[10px] text-text-muted shrink-0">
                            ({seat.map_shapes?.boundary_type})
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {info && info.status !== "unsupported" && (
                            <>
                              {info.status === "no_event" ? (
                                <span className="text-[10px] text-text-muted italic">{info.label}</span>
                              ) : (
                                <>
                                  {info.url && (
                                    <a
                                      href={info.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      title={info.status === "active" ? `Official candidate list — ${info.label}` : info.label}
                                      className="p-1.5 text-text-muted hover:text-primary-light hover:bg-primary/10 rounded-lg transition-colors"
                                    >
                                      <ExternalLink size={13} />
                                    </a>
                                  )}
                                  {info.status === "active" && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleFetchCandidates(seat.id)}
                                      disabled={fetchResult?.loading}
                                    >
                                      {fetchResult?.loading ? (
                                        <Loader2 size={13} className="animate-spin" />
                                      ) : (
                                        <Download size={13} />
                                      )}
                                      Fetch candidates
                                    </Button>
                                  )}
                                </>
                              )}
                            </>
                          )}
                          {selectedElection.status === "draft" && (
                            <Button
                              variant="icon"
                              tone="danger"
                              size="sm"
                              onClick={() =>
                                setConfirmTarget({ kind: "seat", id: seat.id, label: seat.role_title })
                              }
                            >
                              <Trash2 size={14} />
                            </Button>
                          )}
                        </div>
                      </div>

                      {fetchResult && !fetchResult.loading && (
                        <div className="mt-2.5 pl-6 p-3 bg-surface-hover/30 rounded-lg border border-border-light/20 text-xs">
                          {fetchResult.error ? (
                            <p className="text-danger">Error: {fetchResult.error}</p>
                          ) : fetchResult.status === "no_candidates_yet" ? (
                            <p className="text-text-muted italic">
                              No candidates confirmed yet on the official source ({fetchResult.eventName}).
                            </p>
                          ) : fetchResult.status === "no_event" ? (
                            <p className="text-text-muted italic">No known election event for this jurisdiction yet.</p>
                          ) : fetchResult.candidates?.length > 0 ? (
                            <>
                              <p className="text-text-muted mb-2">
                                {fetchResult.eventName} — {fetchResult.candidates.length} candidate(s) on the
                                official source:
                              </p>
                              <div className="space-y-1.5">
                                {fetchResult.candidates.map((c: any) => {
                                  const alreadyHere = seat.candidates.some(
                                    (existing: any) =>
                                      (existing.profiles?.full_name || "").trim().toLowerCase() ===
                                      c.name.trim().toLowerCase()
                                  );
                                  const key = `${seat.id}:${c.name}`;
                                  return (
                                    <div key={key} className="flex items-center justify-between gap-2 py-1">
                                      <span className="text-text-secondary">
                                        {c.name} {c.party && <span className="text-text-muted">— {c.party}</span>}
                                        {c.elected && (
                                          <Badge tone="emerald" className="ml-1.5">
                                            Elected
                                          </Badge>
                                        )}
                                      </span>
                                      {alreadyHere ? (
                                        <span className="text-[10px] text-success font-semibold uppercase shrink-0">
                                          Already added
                                        </span>
                                      ) : (
                                        <Button
                                          variant="icon"
                                          tone="primary"
                                          size="sm"
                                          onClick={() => handleAddFetchedCandidate(seat, c)}
                                          disabled={addingCandidateKey === key}
                                          className="shrink-0"
                                          title="Add to Choseno"
                                        >
                                          {addingCandidateKey === key ? (
                                            <Loader2 size={13} className="animate-spin" />
                                          ) : (
                                            <Plus size={13} />
                                          )}
                                        </Button>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </>
                          ) : (
                            <p className="text-text-muted italic">No candidates found.</p>
                          )}
                        </div>
                      )}

                      {seat.candidates.length > 0 && (
                        <div className="mt-2.5 pl-6 space-y-2">
                          {seat.candidates.map((c: any) => {
                            const name = c.profiles?.full_name || getGhostDisplayName(c.profiles?.current_ghost_id);
                            const isExpanded = expandedCandidateId === c.id;
                            const canReview = !!c.submitted_at;
                            return (
                              <div key={c.id} className="text-xs bg-surface/30 rounded-lg border border-border-light/20">
                                <div className="flex items-center justify-between gap-2 p-2">
                                  <button
                                    onClick={() => setExpandedCandidateId(isExpanded ? null : c.id)}
                                    className="flex items-center gap-1.5 text-text-secondary hover:text-text-main transition-colors min-w-0"
                                  >
                                    {isExpanded ? (
                                      <ChevronUp size={13} className="shrink-0" />
                                    ) : (
                                      <ChevronDown size={13} className="shrink-0" />
                                    )}
                                    <span className="truncate">{name}</span>
                                  </button>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <Badge tone={CANDIDATE_STATUS_TONE[c.status]}>{c.status}</Badge>
                                    {!c.submitted_at && (
                                      <span className="text-[9px] text-text-muted uppercase font-bold">
                                        Draft — not submitted
                                      </span>
                                    )}
                                    {/* Candidates auto-approve on submit (submit_candidate_application
                                        flips status) — only rejecting a live candidacy is an admin action. */}
                                    {canReview && c.status !== "rejected" && (
                                      <Button
                                        variant="icon"
                                        tone="danger"
                                        size="sm"
                                        onClick={() => handleRejectCandidate(c.id)}
                                        title="Reject"
                                      >
                                        <XCircle size={14} />
                                      </Button>
                                    )}
                                    <Button
                                      variant="icon"
                                      tone="danger"
                                      size="sm"
                                      onClick={() => setConfirmTarget({ kind: "candidate", id: c.id, label: name })}
                                      title="Remove candidate"
                                    >
                                      <Trash2 size={12} />
                                    </Button>
                                  </div>
                                </div>

                                {isExpanded && (
                                  <div className="p-3 pt-0 space-y-3 border-t border-border-light/20 mt-1">
                                    {c.statement && (
                                      <div>
                                        <p className="text-[9px] text-text-muted uppercase font-bold tracking-wider mb-1">
                                          Why running
                                        </p>
                                        <p className="text-text-tertiary whitespace-pre-wrap">{c.statement}</p>
                                      </div>
                                    )}
                                    {c.intro_video_url ? (
                                      <div>
                                        <p className="text-[9px] text-text-muted uppercase font-bold tracking-wider mb-1 flex items-center gap-1">
                                          <Video size={11} /> Intro Video
                                        </p>
                                        <video src={c.intro_video_url} controls className="w-full max-h-64 rounded-lg bg-black" />
                                      </div>
                                    ) : (
                                      <p className="text-text-muted italic">No intro video uploaded yet.</p>
                                    )}
                                    {c.election_candidate_answers.length === 0 ? (
                                      <p className="text-text-muted italic">No questionnaire answers yet.</p>
                                    ) : (
                                      <div className="space-y-2">
                                        {c.election_candidate_answers.map((a: any) => (
                                          <div key={a.id} className="p-2 bg-surface-hover/30 rounded-lg">
                                            <p className="font-semibold text-text-secondary">
                                              {a.election_questions?.question_text}
                                            </p>
                                            <AnswerValue
                                              questionType={a.election_questions?.question_type}
                                              optionText={a.election_question_options?.option_text}
                                              selectedOptionTexts={(a.election_candidate_answer_options || [])
                                                .map((o: any) => o.election_question_options?.option_text)
                                                .filter(Boolean)}
                                              textAnswer={a.text_answer}
                                              ratingValue={a.rating_value}
                                            />
                                            {a.context_text && (
                                              <p className="text-text-muted mt-1 italic">&quot;{a.context_text}&quot;</p>
                                            )}
                                            {a.video_url && (
                                              <video src={a.video_url} controls className="w-full max-h-48 rounded-lg mt-1.5 bg-black" />
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </>
      )}

      <ConfirmDialog
        open={!!confirmTarget}
        title={
          confirmTarget?.kind === "election"
            ? `Delete "${confirmTarget.label}"?`
            : confirmTarget?.kind === "seat"
              ? `Delete the "${confirmTarget.label}" seat?`
              : confirmTarget?.kind === "candidate"
                ? `Remove ${confirmTarget.label} from this seat?`
                : confirmTarget?.kind === "question"
                  ? "Delete this question?"
                  : ""
        }
        message={
          confirmTarget?.kind === "election"
            ? "This will permanently remove the election and all associated seats and questions."
            : confirmTarget?.kind === "seat"
              ? "Any candidate applications for it will be removed too."
              : confirmTarget?.kind === "question"
                ? "Any candidate answers to it will be removed too."
                : undefined
        }
        loading={confirmBusy}
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmTarget(null)}
      />
    </div>
  );
}
