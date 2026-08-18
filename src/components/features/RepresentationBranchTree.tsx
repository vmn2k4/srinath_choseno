"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, Phone, ExternalLink, UserCheck, ArrowRight, Flag } from "lucide-react";
import { Avatar, Badge, Button, Card } from "@/components/primitives";
import { buildPoliticianWallSlug } from "@/lib/utils/slugs";
import ReportDialog from "./ReportDialog";
import type { ReportTargetType } from "@/lib/services/moderation";

type ReportFn = (targetType: ReportTargetType, targetId: string, abuseType: string) => Promise<{ error?: unknown }>;

export interface BranchHolderNode {
  id: string;
  full_name: string;
  role_title: string;
  role_description: string | null;
  party_name: string | null;
  photo_url: string | null;
  ghost_id: string | null;
  wall_slug?: string | null;
  boundary_name: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  source_url?: string | null;
}

export interface RepresentationBranch {
  key: string;
  label: string;
  districtName?: string | null;
  top: BranchHolderNode | null;
  bottom: BranchHolderNode[];
}

function slugFor(node: BranchHolderNode) {
  return buildPoliticianWallSlug(node.full_name, node.role_title);
}

// Note: the "View Wall" footer is the only <a> in this card (not the whole
// card wrapped in a Link) -- the card also renders mailto:/tel:/external <a>
// tags for contact info, and nested <a> elements are invalid HTML that
// triggers a hydration mismatch (the browser silently un-nests them
// client-side, producing a different DOM than what the server rendered).
function NodeCard({ node, emphasized, onReport }: { node: BranchHolderNode; emphasized?: boolean; onReport?: ReportFn }) {
  const [showReport, setShowReport] = useState(false);

  return (
    <Card
      padding="sm"
      // w-full + a fixed max-width + mx-auto (rather than the old w-full
      // sm:w-56) is the single source of truth for card size everywhere
      // NodeCard is used -- top node, lone bottom node, and each card in the
      // multi-bottom-node grid below all resolve to the same 320px cap now,
      // instead of each card sizing to its own content (a flex-wrap row
      // with no explicit item basis lets w-full collapse to max-content,
      // so a longer name/party badge silently made that one card wider).
      className={`relative w-full max-w-xs mx-auto space-y-1.5 transition-all hover:shadow-md group/node ${
        emphasized ? "border-2 border-primary/40 bg-primary/5" : "border border-border-light/50"
      }`}
    >
      {onReport && (
        <button
          type="button"
          onClick={() => setShowReport(true)}
          className="absolute top-2 right-2 z-10 text-text-muted/40 hover:text-danger opacity-0 group-hover/node:opacity-100 focus-visible:opacity-100 transition-opacity cursor-pointer"
          title="Report incorrect information"
        >
          <Flag size={12} />
        </button>
      )}

      <div className="flex items-center gap-2.5">
        <Avatar src={node.photo_url} name={node.full_name} size={emphasized ? "md" : "sm"} />
        <div className="min-w-0 flex-1">
          <h4 className="font-bold text-text-main text-sm truncate" title={node.full_name}>
            {node.full_name}
          </h4>
          <div className="flex items-center gap-1 flex-wrap mt-0.5 max-w-full">
            {/* Role badge carries the "why this role matters" copy as a hover
                tooltip instead of a permanent paragraph -- keeps the card
                short while the info stays one hover away. whitespace-normal
                overrides Badge's default nowrap so long party names (e.g.
                "New Democratic Party (NDP)") wrap inside the card instead of
                pushing it wider than its column. */}
            <span
              className="relative group/role"
              title={node.role_description || undefined}
            >
              <Badge tone="primary" size="xs" className="cursor-default">
                {node.role_title}
              </Badge>
              {node.role_description && (
                <span className="pointer-events-none absolute left-0 top-full z-20 mt-1 hidden w-64 rounded-lg border border-border-light/60 bg-surface p-2.5 text-[11px] font-normal normal-case leading-snug text-text-muted shadow-lg group-hover/role:block">
                  {node.role_description}
                </span>
              )}
            </span>
            {node.party_name && (
              // Badge's base recipe hard-codes whitespace-nowrap; a plain
              // className override loses that specificity fight (both are
              // single utility classes, so Tailwind's stylesheet order picks
              // the winner, not attribute order), so force it inline instead
              // -- long party names ("New Democratic Party (NDP)") need to
              // wrap across 2 lines rather than push the card wider.
              <Badge
                tone="neutral"
                size="xs"
                uppercase={false}
                className="break-words text-left max-w-full"
                style={{ whiteSpace: "normal" }}
              >
                {node.party_name}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {node.boundary_name && <p className="text-[11px] text-text-darker truncate">{node.boundary_name}</p>}

      <div className="flex items-center gap-3 pt-1 text-[11px] text-text-muted flex-wrap">
        {node.contact_email && (
          <a href={`mailto:${node.contact_email}`} className="flex items-center gap-1 hover:text-primary transition-colors">
            <Mail size={11} /> Email
          </a>
        )}
        {node.contact_phone && (
          <a href={`tel:${node.contact_phone}`} className="flex items-center gap-1 hover:text-primary transition-colors">
            <Phone size={11} /> Call
          </a>
        )}
        {node.source_url && (
          <a
            href={node.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 hover:text-primary transition-colors"
          >
            <ExternalLink size={11} /> Official
          </a>
        )}
      </div>

      {node.ghost_id && (
        <div className="pt-1.5 mt-0.5 border-t border-border-light/30">
          {/* Link straight to the canonical single-segment wall URL (stored
              wall_slug, same fallback every other wall link in the app
              uses) instead of /wall/<ghost_id>/<slug> -- that two-segment
              form always cost two server redirects (ghost_id -> slug,
              then slug/slug -> slug) before landing on the real page. */}
          <Button as={Link} href={`/wall/${node.wall_slug || slugFor(node)}`} variant="primary" size="sm" className="w-full text-[11px] px-3 py-1.5">
            <UserCheck size={12} />
            View Wall
            <ArrowRight size={11} />
          </Button>
        </div>
      )}

      {showReport && onReport && (
        <ReportDialog
          targetType="office_holder"
          targetId={node.id}
          onReport={onReport}
          onClose={() => setShowReport(false)}
        />
      )}
    </Card>
  );
}

// Renders one branch (Federal, Provincial, Municipal, ...) as a two-tier
// vertical org chart: a single "top" office (Prime Minister/Premier/Governor/
// Mayor -- either fetched from the superior boundary, or the head role found
// on this shape itself) connected down to one or more "bottom" holders tied
// directly to the viewed boundary (MP/MLA, or Councillors alongside a Mayor
// top node). A vertical stub connects top to bottom; multiple bottom nodes
// share a horizontal trunk line (border-top) so they read as siblings.
export default function RepresentationBranchTree({ branch, onReport }: { branch: RepresentationBranch; onReport?: ReportFn }) {
  if (!branch.top && branch.bottom.length === 0) {
    return (
      <p className="text-sm text-text-muted text-center py-6">
        No {branch.label.toLowerCase()} office holders recorded yet.
      </p>
    );
  }

  return (
    <div className="flex flex-col items-center py-1">
      {branch.top && <NodeCard node={branch.top} emphasized onReport={onReport} />}

      {branch.top && branch.bottom.length > 0 && <div className="w-px h-5 bg-border-light" />}

      {branch.bottom.length === 1 ? (
        <NodeCard node={branch.bottom[0]} onReport={onReport} />
      ) : branch.bottom.length > 1 ? (
        // Grid, not flex-wrap: grid columns are equal-width by definition,
        // which is what actually guarantees every card in the row matches —
        // flex-wrap items size to their own content unless given an
        // explicit basis, which was the root cause of mismatched card
        // widths here.
        <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-5 pt-3 border-t-2 border-primary/25">
          {branch.bottom.map((node) => (
            <div key={node.id} className="relative flex flex-col items-center">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-px h-3 bg-border-light" />
              <NodeCard node={node} onReport={onReport} />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
