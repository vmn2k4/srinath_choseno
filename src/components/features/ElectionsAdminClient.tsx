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
  updateElectionQuestion,
  deleteElectionQuestion,
  createElectionQuestionOptions,
  updateElectionQuestionOption,
  deleteElectionQuestionOption,
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
  FileJson,
  Upload,
  X,
  Copy,
  Check,
  Pencil,
} from "lucide-react";
import {
  Card,
  Button,
  Badge,
  Input,
  Textarea,
  Select,
  Checkbox,
  Spinner,
  EmptyState,
  PageHeader,
  ConfirmDialog,
  Modal,
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
  { value: "ranking", label: "Priority ranking" },
] as const;
const QUESTION_TYPE_NEEDS_OPTIONS = new Set(["single_choice", "multiple_choice", "ranking"]);
const QUESTION_TYPE_LABEL: Record<string, string> = Object.fromEntries(
  QUESTION_TYPES.map((t) => [t.value, t.label])
);

// Sample payload + prompt shown in the "Import from JSON" modal — the
// instructions are written to be copy-pasted verbatim into an AI chat so it
// can generate a matching questionnaire without seeing this codebase.
const QUESTION_IMPORT_SAMPLE = {
  questions: [
    {
      question_text: "Do you support the proposed transit levy?",
      question_type: "single_choice",
      required: true,
      allow_context: true,
      allow_video: true,
      visible_to_public: true,
      options: ["Yes", "No", "Undecided"],
    },
    {
      question_text: "Which of the following issues are your top priorities? (select all that apply)",
      question_type: "multiple_choice",
      required: true,
      allow_context: false,
      allow_video: true,
      visible_to_public: true,
      options: ["Housing affordability", "Public transit", "Policing budget", "Climate action", "Local business support"],
    },
    {
      question_text: "What is the single biggest issue facing this community, and how would you address it?",
      question_type: "text",
      required: true,
      allow_context: false,
      allow_video: false,
      visible_to_public: true,
    },
    {
      question_text: "How would you rate the current state of local infrastructure (roads, water, transit)?",
      question_type: "rating",
      required: false,
      allow_context: true,
      allow_video: false,
      visible_to_public: true,
    },
    {
      question_text: "Rank the following issues in order of priority for your term, from most to least important.",
      question_type: "ranking",
      required: true,
      allow_context: true,
      allow_video: false,
      visible_to_public: true,
      options: ["Housing affordability", "Public transit", "Public safety", "Climate action", "Economic development", "Parks & recreation"],
    },
  ],
};

const QUESTION_IMPORT_INSTRUCTIONS = `Generate a candidate questionnaire for a local election as a JSON object.

Output ONLY valid JSON matching this exact shape (no markdown, no commentary):

{
  "questions": [
    {
      "question_text": string,               // the question shown to candidates
      "question_type": "single_choice" | "multiple_choice" | "text" | "rating" | "ranking",
      "required": boolean,                    // must candidates answer this before submitting?
      "allow_context": boolean,                // let candidates add optional free-text elaboration to their answer?
      "allow_video": boolean,                  // let candidates record/upload a short video answering this question?
      "visible_to_public": boolean,            // shown to voters, or admin-only?
      "options": string[]                      // for "single_choice" / "multiple_choice" / "ranking" — at least 2 strings. Omit for "text" and "rating".
    }
  ]
}

Rules:
- "single_choice": candidate picks exactly one option from "options".
- "multiple_choice": candidate can pick several options from "options".
- "text": free-form written answer, no "options" field.
- "rating": candidate rates on a fixed 1–5 scale, no "options" field.
- "ranking": candidate orders every item in "options" from highest to lowest priority (no ties, every item must be placed) — use this for "rank these N issues" style questions, not "rating" (which is a single 1–5 score for one thing).
- "allow_context" and "allow_video" apply to every question_type equally — they add an optional elaboration on top of however the primary answer is captured.
- Use a healthy mix of question_type values — don't make every question the same type.
- Write questions specific to the election/jurisdiction described below, covering policy positions, priorities, and background.
- Keep each question_text concise and unambiguous (one clear question, not multiple questions joined together).
- Aim for 6–12 questions total unless told otherwise.

Election context: <describe the election here — e.g. "2026 Vancouver municipal election, city council seat">`;

type ImportedQuestion = {
  question_text?: string;
  question_type?: string;
  required?: boolean;
  allow_context?: boolean;
  allow_video?: boolean;
  visible_to_public?: boolean;
  options?: string[];
};

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
  const [newQuestionAllowVideo, setNewQuestionAllowVideo] = useState(true);
  const [newQuestionVisible, setNewQuestionVisible] = useState(true);
  const [questionStatus, setQuestionStatus] = useState("");

  // Editing an existing question in place (question_type stays fixed once
  // created -- changing it would orphan already-collected answers)
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editOptions, setEditOptions] = useState<{ id: string | null; text: string }[]>([]);
  const [editRequired, setEditRequired] = useState(true);
  const [editAllowContext, setEditAllowContext] = useState(false);
  const [editAllowVideo, setEditAllowVideo] = useState(true);
  const [editVisible, setEditVisible] = useState(true);
  const [editStatus, setEditStatus] = useState("");
  const [editBusy, setEditBusy] = useState(false);

  // Bulk "Import from JSON" flow for the questionnaire
  const [showImportModal, setShowImportModal] = useState(false);
  const [importJsonText, setImportJsonText] = useState("");
  const [importStatus, setImportStatus] = useState("");
  const [importBusy, setImportBusy] = useState(false);
  const [showImportHelp, setShowImportHelp] = useState(false);
  const [copiedKey, setCopiedKey] = useState<"instructions" | "sample" | null>(null);

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

  const selectAllVisibleShapeIds = () => {
    setPendingShapeIds((prev) => {
      const next = new Set(prev);
      filteredBoundaryCandidates.forEach((shape) => next.add(shape.id));
      return next;
    });
  };

  const clearVisibleShapeIds = () => {
    setPendingShapeIds((prev) => {
      const visibleIds = new Set(filteredBoundaryCandidates.map((shape) => shape.id));
      return new Set([...prev].filter((id) => !visibleIds.has(id)));
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
      allow_video: newQuestionAllowVideo,
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
    setNewQuestionAllowVideo(true);
    setNewQuestionVisible(true);
    setQuestionStatus("");
    fetchQuestions(selectedElection.id);
  };

  const startEditQuestion = (q: any) => {
    setEditingQuestionId(q.id);
    setEditText(q.question_text);
    setEditRequired(q.required);
    setEditAllowContext(q.allow_context);
    setEditAllowVideo(q.allow_video !== false);
    setEditVisible(q.visible_to_public);
    setEditOptions(
      [...(q.election_question_options || [])]
        .sort((a: any, b: any) => a.rank - b.rank)
        .map((o: any) => ({ id: o.id, text: o.option_text }))
    );
    setEditStatus("");
  };

  const cancelEditQuestion = () => setEditingQuestionId(null);

  const updateEditOptionField = (i: number, val: string) =>
    setEditOptions((prev) => prev.map((o, idx) => (idx === i ? { ...o, text: val } : o)));
  const addEditOptionField = () => setEditOptions((prev) => [...prev, { id: null, text: "" }]);
  const removeEditOptionField = (i: number) => setEditOptions((prev) => prev.filter((_, idx) => idx !== i));

  const handleSaveQuestionEdit = async (q: any) => {
    const needsOptions = QUESTION_TYPE_NEEDS_OPTIONS.has(q.question_type);
    const trimmedOptions = needsOptions
      ? editOptions.map((o) => ({ ...o, text: o.text.trim() })).filter((o) => o.text)
      : [];
    if (!editText.trim() || (needsOptions && trimmedOptions.length < 2)) {
      setEditStatus(
        needsOptions
          ? "Error: question text and at least 2 options are required."
          : "Error: question text is required."
      );
      return;
    }

    setEditBusy(true);
    const { error } = await updateElectionQuestion(supabase, q.id, {
      question_text: editText.trim(),
      required: editRequired,
      allow_context: editAllowContext,
      allow_video: editAllowVideo,
      visible_to_public: editVisible,
    });
    if (error) {
      setEditBusy(false);
      setEditStatus("Error: " + error.message);
      return;
    }

    if (needsOptions) {
      const keptIds = new Set(trimmedOptions.filter((o) => o.id).map((o) => o.id));
      const removedIds = (q.election_question_options || [])
        .map((o: any) => o.id)
        .filter((id: string) => !keptIds.has(id));
      for (const id of removedIds) {
        await deleteElectionQuestionOption(supabase, id);
      }
      for (let i = 0; i < trimmedOptions.length; i++) {
        const opt = trimmedOptions[i];
        if (opt.id) await updateElectionQuestionOption(supabase, opt.id, { option_text: opt.text, rank: i });
      }
      const newOnes = trimmedOptions
        .map((opt, i) => ({ text: opt.text, id: opt.id, rank: i }))
        .filter((opt) => !opt.id);
      if (newOnes.length > 0) {
        await createElectionQuestionOptions(
          supabase,
          newOnes.map((o) => ({ question_id: q.id, option_text: o.text, rank: o.rank }))
        );
      }
    }

    setEditBusy(false);
    setEditingQuestionId(null);
    setQuestionStatus("Question updated.");
    fetchQuestions(selectedElection.id);
  };

  const handleImportFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;
    const text = await file.text();
    setImportJsonText(text);
    setImportStatus("");
  };

  const handleCopy = async (key: "instructions" | "sample", text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((prev) => (prev === key ? null : prev)), 2000);
    } catch {
      setImportStatus("Error: couldn't access the clipboard — copy the text manually.");
    }
  };

  const handleImportQuestions = async () => {
    if (!selectedElection) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(importJsonText);
    } catch {
      setImportStatus("Error: that's not valid JSON.");
      return;
    }
    const rawQuestions: ImportedQuestion[] | undefined = Array.isArray(parsed)
      ? (parsed as ImportedQuestion[])
      : (parsed as { questions?: ImportedQuestion[] })?.questions;
    if (!Array.isArray(rawQuestions) || rawQuestions.length === 0) {
      setImportStatus('Error: expected a "questions" array (or a top-level array) with at least one question.');
      return;
    }

    const validTypes = new Set<string>(QUESTION_TYPES.map((t) => t.value));
    const normalized: {
      question_text: string;
      question_type: (typeof QUESTION_TYPES)[number]["value"];
      required: boolean;
      allow_context: boolean;
      allow_video: boolean;
      visible_to_public: boolean;
      options: string[];
    }[] = [];
    for (let i = 0; i < rawQuestions.length; i++) {
      const item = rawQuestions[i];
      const questionType = item?.question_type ?? "";
      const needsOptions = QUESTION_TYPE_NEEDS_OPTIONS.has(questionType);
      const text = item?.question_text?.trim();
      if (!text) {
        setImportStatus(`Error: question ${i + 1} is missing "question_text".`);
        return;
      }
      if (!validTypes.has(questionType)) {
        setImportStatus(
          `Error: question ${i + 1} has an invalid "question_type" (${questionType || "(none)"}). Must be one of: ${QUESTION_TYPES.map((t) => t.value).join(", ")}.`
        );
        return;
      }
      const opts = (item.options || []).map((o) => o?.trim()).filter((o): o is string => Boolean(o));
      if (needsOptions && opts.length < 2) {
        setImportStatus(`Error: question ${i + 1} (${questionType}) needs an "options" array with at least 2 entries.`);
        return;
      }
      normalized.push({
        question_text: text,
        question_type: questionType as (typeof QUESTION_TYPES)[number]["value"],
        required: item.required ?? true,
        allow_context: item.allow_context ?? false,
        allow_video: item.allow_video ?? true,
        visible_to_public: item.visible_to_public ?? true,
        options: needsOptions ? opts : [],
      });
    }

    setImportBusy(true);
    setImportStatus("");
    let created = 0;
    for (let i = 0; i < normalized.length; i++) {
      const item = normalized[i];
      const { data: q, error } = await createElectionQuestion(supabase, {
        election_id: selectedElection.id,
        question_text: item.question_text,
        question_type: item.question_type,
        required: item.required,
        allow_context: item.allow_context,
        allow_video: item.allow_video,
        visible_to_public: item.visible_to_public,
        rank: questions.length + i,
      });
      if (error || !q) {
        setImportBusy(false);
        setImportStatus(`Error: failed to create question ${i + 1} (${error?.message || "unknown error"}). ${created} question(s) were imported before this failure.`);
        fetchQuestions(selectedElection.id);
        return;
      }
      if (item.options.length > 0) {
        const { error: optErr } = await createElectionQuestionOptions(
          supabase,
          item.options.map((option_text, idx) => ({ question_id: q.id, option_text, rank: idx }))
        );
        if (optErr) {
          setImportBusy(false);
          setImportStatus(`Error: failed to create options for question ${i + 1} (${optErr.message}). ${created} question(s) were imported before this failure.`);
          fetchQuestions(selectedElection.id);
          return;
        }
      }
      created++;
    }

    setImportBusy(false);
    setImportJsonText("");
    setShowImportModal(false);
    setQuestionStatus(`Imported ${created} question(s) from JSON.`);
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
    .filter((shape) => !boundarySearch.trim() || shape.name?.toLowerCase().includes(boundarySearch.trim().toLowerCase()));

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
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <h3 className="text-lg font-bold text-text-main flex items-center gap-2">
                  <HelpCircle size={18} className="text-primary" /> Candidate Questionnaire
                </h3>
                <p className="text-xs text-text-muted mt-1">
                  Every candidate must answer required questions (and can add optional written context, if you
                  allow it) before submitting their application.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setImportStatus("");
                  setShowImportModal(true);
                }}
                className="shrink-0"
              >
                <FileJson size={14} /> Import from JSON
              </Button>
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
                {questions.map((q, i) =>
                  editingQuestionId === q.id ? (
                    <div key={q.id} className="p-3.5 bg-surface/60 rounded-xl border border-primary/30 space-y-3">
                      <div className="flex items-center gap-2">
                        <Badge tone="neutral">{QUESTION_TYPE_LABEL[q.question_type] || q.question_type}</Badge>
                        <span className="text-[10px] text-text-muted">Question type can&apos;t be changed after creation.</span>
                      </div>
                      <Input
                        type="text"
                        size="sm"
                        placeholder="Question text"
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                      />
                      {QUESTION_TYPE_NEEDS_OPTIONS.has(q.question_type) && (
                        <div className="space-y-2">
                          {q.question_type === "ranking" && (
                            <p className="text-xs text-text-muted">Candidates will rank every item below.</p>
                          )}
                          {editOptions.map((opt, idx) => (
                            <div key={opt.id ?? `new-${idx}`} className="flex items-center gap-2">
                              <Input
                                type="text"
                                size="sm"
                                placeholder={`Option ${idx + 1}`}
                                value={opt.text}
                                onChange={(e) => updateEditOptionField(idx, e.target.value)}
                                className="flex-1"
                              />
                              {editOptions.length > 2 && (
                                <Button variant="icon" tone="danger" size="sm" onClick={() => removeEditOptionField(idx)}>
                                  <Trash2 size={13} />
                                </Button>
                              )}
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={addEditOptionField}
                            className="text-xs font-semibold text-primary-light hover:text-primary transition-colors flex items-center gap-1"
                          >
                            <Plus size={13} /> Add option
                          </button>
                        </div>
                      )}
                      <div className="flex flex-wrap gap-4">
                        <Checkbox label="Required" checked={editRequired} onChange={(e) => setEditRequired(e.target.checked)} />
                        <Checkbox
                          label="Allow written context"
                          checked={editAllowContext}
                          onChange={(e) => setEditAllowContext(e.target.checked)}
                        />
                        <Checkbox
                          label="Allow video answer"
                          checked={editAllowVideo}
                          onChange={(e) => setEditAllowVideo(e.target.checked)}
                        />
                        <Checkbox label="Visible to voters" checked={editVisible} onChange={(e) => setEditVisible(e.target.checked)} />
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="sm" onClick={() => handleSaveQuestionEdit(q)} disabled={editBusy}>
                          {editBusy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Save
                        </Button>
                        <Button variant="ghost" size="sm" onClick={cancelEditQuestion} disabled={editBusy}>
                          Cancel
                        </Button>
                      </div>
                      {editStatus && <p className="text-danger text-xs">{editStatus}</p>}
                    </div>
                  ) : (
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
                            {q.allow_video && (
                              <span className="text-[9px] bg-accent/15 text-accent-light px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">
                                Video allowed
                              </span>
                            )}
                            {!q.visible_to_public && <Badge tone="neutral">Hidden from voters</Badge>}
                            {q.allow_video === false && <Badge tone="neutral">Video disabled</Badge>}
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
                        <div className="flex items-center gap-1 shrink-0">
                          <Button variant="icon" size="sm" onClick={() => startEditQuestion(q)}>
                            <Pencil size={14} />
                          </Button>
                          <Button
                            variant="icon"
                            tone="danger"
                            size="sm"
                            onClick={() =>
                              setConfirmTarget({ kind: "question", id: q.id, label: q.question_text })
                            }
                          >
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )
                )}
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
                  {newQuestionType === "ranking" && (
                    <p className="text-xs text-text-muted">
                      Candidates will order every item below from 1 (top priority) to {Math.max(newQuestionOptions.length, 2)} (lowest) — add one item per thing you want ranked.
                    </p>
                  )}
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
                  label="Allow video answer"
                  checked={newQuestionAllowVideo}
                  onChange={(e) => setNewQuestionAllowVideo(e.target.checked)}
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
              {questionStatus && (
                <p className={`text-xs ${questionStatus.startsWith("Error") ? "text-danger" : "text-success"}`}>
                  {questionStatus}
                </p>
              )}
            </div>
          </Card>

          {/* IMPORT QUESTIONS FROM JSON */}
          {showImportModal && (
            <Modal onOverlayClick={() => !importBusy && setShowImportModal(false)}>
              <Card padding="md" className="space-y-4 w-full max-w-2xl max-h-[85vh] overflow-y-auto">
                <div className="flex justify-between items-center">
                  <h3 className="font-bold text-sm text-text-main flex items-center gap-2">
                    <FileJson size={16} className="text-primary" /> Import Questions from JSON
                  </h3>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowImportModal(false)}
                    disabled={importBusy}
                  >
                    <X size={14} />
                  </Button>
                </div>

                <button
                  type="button"
                  onClick={() => setShowImportHelp((v) => !v)}
                  className="text-xs font-semibold text-primary-light hover:text-primary transition-colors flex items-center gap-1"
                >
                  {showImportHelp ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  Show sample JSON &amp; AI instructions
                </button>

                {showImportHelp && (
                  <div className="space-y-3 p-3 bg-surface/40 rounded-xl border border-border-light/30">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">
                          Instructions — paste this into an AI chat
                        </p>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopy("instructions", QUESTION_IMPORT_INSTRUCTIONS)}
                        >
                          {copiedKey === "instructions" ? <Check size={12} /> : <Copy size={12} />}
                          {copiedKey === "instructions" ? "Copied" : "Copy"}
                        </Button>
                      </div>
                      <pre className="text-[11px] whitespace-pre-wrap text-text-secondary bg-surface-hover/60 border border-border-light/20 rounded-lg p-2.5 max-h-56 overflow-y-auto">
                        {QUESTION_IMPORT_INSTRUCTIONS}
                      </pre>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">
                          Sample JSON (matches the expected shape)
                        </p>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            handleCopy("sample", JSON.stringify(QUESTION_IMPORT_SAMPLE, null, 2))
                          }
                        >
                          {copiedKey === "sample" ? <Check size={12} /> : <Copy size={12} />}
                          {copiedKey === "sample" ? "Copied" : "Copy"}
                        </Button>
                      </div>
                      <pre className="text-[11px] whitespace-pre-wrap text-text-secondary bg-surface-hover/60 border border-border-light/20 rounded-lg p-2.5 max-h-56 overflow-y-auto">
                        {JSON.stringify(QUESTION_IMPORT_SAMPLE, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-xs font-semibold text-primary-light hover:text-primary transition-colors cursor-pointer w-fit">
                    <Upload size={14} />
                    Upload a .json file
                    <input type="file" accept=".json,application/json" onChange={handleImportFileChange} className="hidden" />
                  </label>
                  <Textarea
                    size="sm"
                    rows={10}
                    placeholder='Paste JSON here — either { "questions": [ ... ] } or a bare [ ... ] array'
                    value={importJsonText}
                    onChange={(e) => setImportJsonText(e.target.value)}
                    className="font-mono text-xs"
                  />
                </div>

                {importStatus && (
                  <p className={`text-xs ${importStatus.startsWith("Error") ? "text-danger" : "text-success"}`}>
                    {importStatus}
                  </p>
                )}

                <div className="flex justify-end gap-2 pt-1">
                  <Button variant="ghost" size="sm" onClick={() => setShowImportModal(false)} disabled={importBusy}>
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleImportQuestions}
                    disabled={importBusy || !importJsonText.trim()}
                  >
                    {importBusy ? <Loader2 size={14} className="animate-spin" /> : <FileJson size={14} />}
                    {importBusy ? "Importing..." : "Import Questions"}
                  </Button>
                </div>
              </Card>
            </Modal>
          )}

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
                    {!loadingBoundaryCandidates && filteredBoundaryCandidates.length > 0 && (
                      <div className="flex items-center gap-2 mb-1.5">
                        <button
                          type="button"
                          onClick={selectAllVisibleShapeIds}
                          className="text-[10px] font-semibold text-primary-light hover:text-primary transition-colors"
                        >
                          Select all ({filteredBoundaryCandidates.length})
                        </button>
                        <span className="text-text-muted/40">·</span>
                        <button
                          type="button"
                          onClick={clearVisibleShapeIds}
                          className="text-[10px] font-semibold text-text-muted hover:text-danger transition-colors"
                        >
                          Clear
                        </button>
                      </div>
                    )}
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
                                              selectedOptionTexts={[...(a.election_candidate_answer_options || [])]
                                                .sort((x: any, y: any) => (x.rank ?? 0) - (y.rank ?? 0))
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
