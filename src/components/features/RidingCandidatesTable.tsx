import Link from "next/link";
import { partyTone } from "@/lib/utils/electionParties";

export interface RidingRow {
  seatId: string;
  /** Seat page, e.g. /elections/seat/mla-surrey-south-a8ba7b */
  href: string;
  areaLabel: string;
  roleTitle: string;
  candidates: Array<{ id: string; name: string; href: string; partyId: number | null; partyName: string | null }>;
}

// Riding-by-riding table of candidates and parties. Server-rendered and fully
// expanded so a crawler gets every name; each name links to the candidate
// page, each riding to its race page.
export default function RidingCandidatesTable({
  rows,
  nounTitle,
  showRole,
}: {
  rows: RidingRow[];
  nounTitle: string;
  showRole: boolean;
}) {
  const letters = Array.from(new Set(rows.map((r) => (r.areaLabel[0] || "#").toUpperCase())));
  const seen = new Set<string>();
  return (
    <section aria-labelledby="ridings-table-heading" className="space-y-3">
      <h2 id="ridings-table-heading" className="font-display text-2xl font-bold text-text-main">
        Candidates by {nounTitle.toLowerCase()}
      </h2>
      {letters.length > 6 && (
        <nav aria-label={`Jump to a ${nounTitle.toLowerCase()} by first letter`} className="flex flex-wrap gap-1.5 text-sm">
          {letters.map((l) => (
            <a key={l} href={`#letter-${l}`} className="rounded-md border border-border-light px-2 py-0.5 font-semibold text-primary hover:bg-surface-hover">
              {l}
            </a>
          ))}
        </nav>
      )}
      <div className="overflow-x-auto rounded-xl border border-border-light">
        <table className="w-full min-w-[34rem] border-collapse text-left text-sm">
          <caption className="sr-only">Candidates and parties in each {nounTitle.toLowerCase()}</caption>
          <thead className="bg-surface-hover text-xs uppercase tracking-wider text-text-muted">
            <tr>
              <th scope="col" className="px-3 py-2 font-semibold">{nounTitle}</th>
              {showRole && <th scope="col" className="px-3 py-2 font-semibold">Race</th>}
              <th scope="col" className="px-3 py-2 font-semibold">Candidates (party)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const letter = (r.areaLabel[0] || "#").toUpperCase();
              const first = !seen.has(letter);
              seen.add(letter);
              return (
                <tr key={r.seatId} id={first ? `letter-${letter}` : undefined} className="border-t border-border-light align-top">
                  <th scope="row" className="px-3 py-2 font-semibold text-text-main">
                    <Link href={r.href} className="text-primary hover:underline">
                      {r.areaLabel}
                    </Link>
                  </th>
                  {showRole && <td className="px-3 py-2 text-text-secondary">{r.roleTitle}</td>}
                  <td className="px-3 py-2">
                    <ul className="space-y-0.5 [&>li]:flex [&>li]:flex-wrap [&>li]:items-baseline [&>li]:gap-x-1.5 [&_a]:font-medium [&_a]:text-text-main [&_a:hover]:underline">
                      {r.candidates.map((c) => (
                        <li key={c.id}>
                          <Link href={c.href}>{c.name}</Link>
                          <span className={`text-xs ${partyTone(c.partyName, c.partyId).text}`}>{c.partyName || "Independent / no party"}</span>
                        </li>
                      ))}
                    </ul>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
