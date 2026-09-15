"use client";

import React, { useState } from "react";
import Modal from "@/components/primitives/Modal";
import { Card, Button, Input, Avatar, Spinner } from "@/components/primitives";
import { searchPoliticians } from "@/lib/services/politicians";
import { addUnregisteredCandidate } from "@/lib/services/elections";
import { getOrCreatePoliticalParty } from "@/lib/services/politicalParties";
import { startCandidateCall } from "@/lib/services/calls";
import { createClient } from "@/lib/supabase/client";
import { X, Search, Phone, CheckCircle2 } from "lucide-react";

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
  profiles?: {
    full_name?: string;
    politician_profiles?: { contact_email?: string | null; contact_phone?: string | null } | { contact_email?: string | null; contact_phone?: string | null }[] | null;
  } | null;
}

// Same search-and-select shape as SendInterviewInviteFlow (this and that
// component are intentionally near-identical -- one places a call, one
// sends an email invite -- reusing its search/select/stub-creation logic
// rather than introducing a second pattern for the same job). Kept as a
// separate component rather than a shared base because the two diverge
// enough in their final step (phone + Twilio call vs. email + Supabase
// function) that a shared abstraction would mostly be conditionals.
export default function StartCallFlow({
  seatId,
  existingCandidates,
  onClose,
  onCalled,
}: {
  seatId: string;
  existingCandidates: ExistingCandidate[];
  onClose: () => void;
  onCalled: () => void;
}) {
  const supabase = createClient();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<SearchResult | null>(null);
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [phoneOnFile, setPhoneOnFile] = useState(false);
  const [calling, setCalling] = useState(false);
  const [status, setStatus] = useState("");
  const [called, setCalled] = useState(false);

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

  const findExistingCandidate = (fullName: string) =>
    existingCandidates.find((c) => c.profiles?.full_name?.trim().toLowerCase() === fullName.trim().toLowerCase());

  const selectPerson = (person: SearchResult) => {
    setSelected(person);
    setStatus("");
    const existing = findExistingCandidate(person.full_name);
    const pp = existing?.profiles?.politician_profiles;
    const record = Array.isArray(pp) ? pp[0] : pp;
    setPhone(record?.contact_phone || "");
    setPhoneOnFile(Boolean(record?.contact_phone));
    setEmail(record?.contact_email || "");
  };

  const placeCall = async () => {
    if (!selected || !phone.trim()) return;
    setCalling(true);
    setStatus("");
    try {
      let candidateId = findExistingCandidate(selected.full_name)?.id;
      if (!candidateId) {
        let partyId: number | null = null;
        if (selected.party_name && selected.country) {
          const { data: resolvedPartyId } = await getOrCreatePoliticalParty(supabase, selected.country, selected.party_name);
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

      const { error: callError } = await startCandidateCall({
        candidateId,
        seatId,
        phoneNumber: phone.trim(),
        email: email.trim() || null,
      });
      if (callError) throw new Error(callError.message);

      setCalled(true);
      onCalled();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to start call";
      setStatus("Error: " + message);
    } finally {
      setCalling(false);
    }
  };

  return (
    <Modal onOverlayClick={onClose}>
      <Card padding="md" className="w-full max-w-lg space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-sm text-text-main flex items-center gap-2">
            <Phone size={16} className="text-primary" /> Call Candidate
          </h3>
          <Button size="sm" variant="ghost" onClick={onClose}>
            <X size={16} />
          </Button>
        </div>

        {called ? (
          <div className="text-center py-6 space-y-3">
            <CheckCircle2 size={32} className="text-success mx-auto" />
            <p className="text-sm font-semibold text-text-main">Calling {selected?.full_name}…</p>
            <p className="text-xs text-text-muted">
              Track this call's status, transcript, and outcome from the{" "}
              <a href="/admin/calls" className="text-primary underline">
                Calls dashboard
              </a>
              .
            </p>
            <Button size="sm" onClick={onClose} className="w-full">
              Done
            </Button>
          </div>
        ) : (
          <>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <Input value={query} onChange={(e) => runSearch(e.target.value)} placeholder="Search by name..." className="pl-9" />
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
                    {phoneOnFile ? "Phone number (on file — edit if needed):" : "Phone number (none on file — add one):"}
                  </label>
                  <Input type="tel" autoComplete="off" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 604 555 0100" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-text-muted">Email (optional — enables the automatic follow-up invite if they say yes):</label>
                  <Input type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="candidate@example.com" />
                </div>
                <Button onClick={placeCall} disabled={calling || !phone.trim()} className="w-full gap-1.5">
                  {calling ? <Spinner size="sm" /> : <Phone size={14} />}
                  {calling ? "Placing call..." : "Start Call"}
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
