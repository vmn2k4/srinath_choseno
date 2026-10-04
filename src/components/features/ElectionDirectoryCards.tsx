"use client";

import Link from "next/link";
import { ChevronRight, Landmark, MapPin, Users } from "lucide-react";
import { Card } from "@/components/primitives";
import { useTranslation } from "@/contexts/LanguageContext";
import type { ElectionCardData } from "@/lib/utils/electionsIndexSeo";

// The logged-out /elections view: one card per live election, each linking to
// that election's hub page (/elections/e/...), where its parties, races and
// every candidate live. Elections with no published candidates yet render as
// plain cards -- their hub is noindex until a roster exists.
export default function ElectionDirectoryCards({ elections }: { elections: ElectionCardData[] }) {
  const { t } = useTranslation();

  return (
    <section aria-labelledby="election-directory-heading" className="space-y-4">
      <div className="px-1">
        <h2 id="election-directory-heading" className="text-xl font-bold text-text-main flex items-center gap-2">
          <Landmark size={18} className="text-accent" />
          {t("elections.browseTitle")}
        </h2>
        <p className="text-sm text-text-muted mt-1">{t("elections.browseSubtitle")}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {elections.map((e) => {
          const body = (
            <>
              <div className="min-w-0">
                {e.dateLabel && <p className="text-xs text-text-muted mb-1">{e.dateLabel}</p>}
                <h3 className="text-lg font-bold text-text-main">{e.name}</h3>
                <p className="text-xs text-text-muted mt-1.5 flex items-center gap-1.5">
                  <Users size={12} />
                  {e.candidateCount > 0
                    ? `${e.candidateCount.toLocaleString("en-CA")} ${t("elections.candidateCount")} · ${e.seatCount.toLocaleString("en-CA")} ${t("elections.races")}`
                    : t("elections.candidatesComingSoon")}
                </p>
              </div>
              {e.href && (
                <ChevronRight
                  size={18}
                  className="text-text-darker group-hover:text-primary-light transition-colors shrink-0"
                />
              )}
            </>
          );

          return e.href ? (
            <Card
              key={e.id}
              as={Link}
              href={e.href}
              interactive
              className="w-full text-left overflow-hidden flex items-center justify-between gap-4 group"
            >
              {body}
            </Card>
          ) : (
            <Card key={e.id} className="w-full overflow-hidden flex items-center justify-between gap-4 opacity-80">
              {body}
            </Card>
          );
        })}
      </div>

      {elections.some((e) => e.places.length > 0) && (
        <div className="space-y-4 pt-2">
          <div className="px-1">
            <h2 className="text-lg font-bold text-text-main flex items-center gap-2">
              <MapPin size={16} className="text-accent" />
              {t("elections.placesTitle")}
            </h2>
            <p className="text-sm text-text-muted mt-1">{t("elections.placesSubtitle")}</p>
          </div>
          {elections
            .filter((e) => e.places.length > 0)
            .map((e) => (
              <div key={e.id} className="px-1">
                <h3 className="text-sm font-semibold text-text-secondary mb-2">{e.name}</h3>
                <ul className="flex flex-wrap gap-2">
                  {e.places.map((pl) => (
                    <li key={pl.href}>
                      <Link
                        href={pl.href}
                        className="inline-flex items-center gap-1.5 rounded-full border border-border-light/60 bg-surface-elevated px-3 py-1 text-xs font-medium text-text-main hover:border-primary/50 hover:text-primary transition-colors"
                      >
                        {pl.name}
                        <span className="text-text-muted font-normal">
                          {pl.candidateCount.toLocaleString("en-CA")}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
        </div>
      )}
    </section>
  );
}
