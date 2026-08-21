"use client";

import React, { useState } from "react";
import Modal from "@/components/primitives/Modal";
import { Card, Button, Input, Avatar, Spinner } from "@/components/primitives";
import { searchPoliticians } from "@/lib/services/politicians";
import { addUnregisteredCandidate, inviteCandidateToClaim } from "@/lib/services/elections";
import { getOrCreatePoliticalParty } from "@/lib/services/politicalParties";
import { createClient } from "@/lib/supabase/client";
import { X, Search, Send, CheckCircle2 } from "lucide-react";

interface SearchResult {
  result_key: string;
  full_name: string;
  role_title: string | null;
  jurisdiction_name: string | null;
  party_name: string | null;
  country: string | null;
  photo_url: string | null;
  politician_profile_id: string | null;
}

interface ExistingCandidate {
  id: string;
  profiles?: { full_name?: string; politician_profiles?: { contact_email?: string | null } | { contact_email?: string | null }[] | null } | null;
}

// Search-and-invite flow: search anyone on Choseno (politicians +
// officeholders, reusing search_politicians_and_officeholders -- the same
// RPC the nav-bar global search uses), select one, confirm/edit their
// email, and send the interview invite in one step -- instead of the
// existing two-step "Add Candidate Directly" then separately "Invite to
// Claim" panels (both stay, this is a faster on-ramp, not a replacement).
//
// No new backend needed: if the selected person isn't already a candidate
// for this seat, a stub is created via add_unregistered_candidate exactly
// like "Add Candidate Directly" does, pre-filled from the search result.
// The invite always goes through the existing claim-token flow
// (create_claim_invite -> Supabase auto-signin email -> claim_candidacy_via_token),
// which already correctly merges onto the REAL account if the invitee turns
// out to already have one -- see finalize_candidate_claim's identity-merge
// logic in 20260802000001_candidacy_claims.sql. That merge is what makes
// "search finds an already-registered politician" safe to handle exactly
// the same way as a brand-new person, with no separate code path.
export default function SendInterviewInviteFlow({
  seatId,
  existingCandidates,
  onClose,
  onSent,
}: {
  seatId: string;
  existingCandidates: ExistingCandidate[];
  onClose: () => void;
  onSent: () => void;
}) {
  const supabase = createClient();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<SearchResult | null>(null);
  const [email, setEmail] = useState("");
  // Tracked separately from `email` itself -- the label below needs to know
  // whether the CURRENT value came from our own database, not just whether
  // the field happens to be non-empty. Browser autofill can populate an
  // empty email input the instant it renders/focuses (a saved credential
  // from this browser profile, nothing to do with our data), which would
  // make `email` truthy without it actually being "on file" -- inferring
  // the label from that would misreport an autofilled guess as real data.
  const [emailOnFile, setEmailOnFile] = useState(false);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState("");
  const [sent, setSent] = useState(false);

  const runSearch = async (q: string) => {
    setQuery(q);
    setSelected(null);
    setStatus("");
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    const { data } = await searchPoliticians(supabase, q.trim());
    setResults((data as SearchResult[]) || []);
    setSearching(false);
  };

  // If this person already has a candidate row for this seat (matched by
  // name -- search doesn't expose a direct id to join against
  // election_candidates), pre-fill their email from that row instead of
  // starting blank, and reuse that row instead of creating a duplicate stub.
  const findExistingCandidate = (fullName: string) =>
    existingCandidates.find((c) => c.profiles?.full_name?.trim().toLowerCase() === fullName.trim().toLowerCase());

  const selectPerson = (person: SearchResult) => {
    setSelected(person);
    setStatus("");
    const existing = findExistingCandidate(person.full_name);
    const pp = existing?.profiles?.politician_profiles;
    const existingEmail = Array.isArray(pp) ? pp[0]?.contact_email : pp?.contact_email;
    setEmail(existingEmail || "");
    setEmailOnFile(Boolean(existingEmail));
  };

  const sendInvite = async () => {
    if (!selected || !email.trim()) return;
    setSending(true);
    setStatus("");
    try {
      let candidateId = findExistingCandidate(selected.full_name)?.id;
      if (!candidateId) {
        // Resolve party_name (plain text from the search result -- it also
        // matches office_holders rows that were never normalized against
        // political_parties, so it can't return an id directly) to a real
        // party id before creating the stub, so it -- and everything else
        // finalize_candidate_claim copies from the stub on claim -- actually
        // pre-fills instead of leaving onboarding to ask for it again.
        let partyId: number | null = null;
        if (selected.party_name && selected.country) {
          const { data: resolvedPartyId } = await getOrCreatePoliticalParty(
            supabase,
            selected.country,
            selected.party_name
          );
          partyId = (resolvedPartyId as number) ?? null;
        }

        const { data: newCandidate, error: addError } = await addUnregisteredCandidate(supabase, seatId, {
          fullName: selected.full_name,
          avatarUrl: selected.photo_url || undefined,
          partyId,
        });
        if (addError || !newCandidate) throw new Error(addError?.message || "Could not add candidate");
        candidateId = (newCandidate as { id: string }).id;
      }

      const { error: inviteError } = await inviteCandidateToClaim(supabase, candidateId, email.trim());
      if (inviteError) throw new Error(inviteError.message);

      setSent(true);
      onSent();
    } catch (err: any) {
      setStatus("Error: " + (err?.message || "Failed to send invite"));
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal onOverlayClick={onClose}>
      <Card padding="md" className="w-full max-w-lg space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-sm text-text-main flex items-center gap-2">
            <Send size={16} className="text-primary" /> Send Interview Invite
          </h3>
          <Button size="sm" variant="ghost" onClick={onClose}>
            <X size={16} />
          </Button>
        </div>

        {sent ? (
          <div className="text-center py-6 space-y-3">
            <CheckCircle2 size={32} className="text-success mx-auto" />
            <p className="text-sm font-semibold text-text-main">Invite sent to {selected?.full_name}</p>
            <p className="text-xs text-text-muted">
              They'll get an email with a link to claim their candidacy and answer the interview questions —
              no account needed beforehand.
            </p>
            <Button size="sm" onClick={onClose} className="w-full">
              Done
            </Button>
          </div>
        ) : (
          <>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <Input
                value={query}
                onChange={(e) => runSearch(e.target.value)}
                placeholder="Search by name..."
                className="pl-9"
              />
            </div>

            {searching && (
              <div className="flex justify-center py-3">
                <Spinner size="sm" />
              </div>
            )}

            {!selected && results.length > 0 && (
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {results.map((r) => (
                  <button
                    key={r.result_key}
                    type="button"
                    onClick={() => selectPerson(r)}
                    className="w-full flex items-center gap-2.5 p-2 rounded-xl border border-border-light/30 hover:border-primary/40 hover:bg-surface-hover/40 transition-all text-left cursor-pointer"
                  >
                    <Avatar src={r.photo_url} name={r.full_name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-text-main truncate">{r.full_name}</p>
                      <p className="text-[11px] text-text-muted truncate">
                        {[r.role_title, r.jurisdiction_name].filter(Boolean).join(" — ") || r.party_name || ""}
                      </p>
                    </div>
                    {findExistingCandidate(r.full_name) && (
                      <span className="text-[10px] bg-primary/15 text-primary-light px-1.5 py-0.5 rounded-full font-semibold shrink-0">
                        Already added
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}

            {!selected && !searching && query.trim().length >= 2 && results.length === 0 && (
              <p className="text-xs text-text-muted text-center py-3">No matches on Choseno for "{query}".</p>
            )}

            {selected && (
              <div className="space-y-3 pt-2 border-t border-border-light/30">
                <div className="flex items-center gap-2.5">
                  <Avatar src={selected.photo_url} name={selected.full_name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-text-main truncate">{selected.full_name}</p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => setSelected(null)} className="text-xs">
                    Change
                  </Button>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-text-muted">
                    {emailOnFile ? "Contact email (on file — edit if needed):" : "Contact email (none on file — add one):"}
                  </label>
                  <Input
                    type="email"
                    autoComplete="off"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="candidate@example.com"
                  />
                </div>
                <Button onClick={sendInvite} disabled={sending || !email.trim()} className="w-full gap-1.5">
                  {sending ? <Spinner size="sm" /> : <Send size={14} />}
                  {sending ? "Sending..." : "Send Interview Invite"}
                </Button>
                {status && <p className="text-xs text-danger">{status}</p>}
              </div>
            )}
          </>
        )}
      </Card>
    </Modal>
  );
}
