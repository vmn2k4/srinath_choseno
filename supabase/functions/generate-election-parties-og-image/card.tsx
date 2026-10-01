// JSX layout for the election "parties & candidates" share card, split into its
// own .tsx so index.ts (the Deno.serve entrypoint) never needs a JSX parse --
// same split as generate-election-og-image. Rendered by @vercel/og (Satori +
// resvg-wasm). Mirrors the party grid on /elections/e/[election].
import React from 'npm:react@^19';

export interface PartyCardRow {
  name: string;
  count: number;
  raceCount: number;
  hue: string;
  /** Up to 4 avatars: data-URI photo or null (-> initial), plus the name for the initial. */
  avatars: { name: string; photo: string | null }[];
}

export interface PartiesOgCardInput {
  electionName: string;
  dateLabel: string | null;
  totalCandidates: number;
  partyCount: number;
  totalRaces: number;
  parties: PartyCardRow[]; // already capped to what fits
  hiddenParties: number;
}

const INK = '#17324d';
const MUTED = '#64809a';

function Avatar({ name, photo }: { name: string; photo: string | null }) {
  const box = { width: 34, height: 34, borderRadius: 17, marginRight: -10, border: '2px solid #ffffff' };
  if (photo) {
    return <img src={photo} width={34} height={34} style={{ ...box, objectFit: 'cover' }} />;
  }
  return (
    <div
      style={{
        ...box,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#7c6bd6',
        color: '#ffffff',
        fontSize: 15,
        fontWeight: 900,
      }}
    >
      {(name.trim()[0] || '?').toUpperCase()}
    </div>
  );
}

export function PartiesOgCard(input: PartiesOgCardInput) {
  const { parties } = input;
  const cols = Math.min(4, Math.max(1, parties.length));
  const rows = Math.max(1, Math.ceil(parties.length / cols));
  const GAP = 16;
  const GRID_H = 630 - 36 - 112 - 20 - 32 - (input.hiddenParties > 0 ? 24 : 0);
  const cardH = Math.floor((GRID_H - GAP * (rows - 1)) / rows);
  const cardW = Math.floor((1200 - 72 - GAP * (cols - 1)) / cols);

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        padding: '36px 36px 32px 36px',
        background: 'linear-gradient(135deg, #f6f9ff 0%, #eef2ff 55%, #e8dcf8 100%)',
        fontFamily: 'Public Sans, sans-serif',
        color: INK,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', height: 112 }}>
        <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 840 }}>
          <div style={{ display: 'flex', fontSize: 18, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: 2 }}>
            {input.dateLabel ? `Election day · ${input.dateLabel}` : 'Election'}
          </div>
          <div style={{ display: 'flex', fontSize: 44, fontWeight: 900, lineHeight: 1.1, marginTop: 6 }}>{input.electionName}</div>
          <div style={{ display: 'flex', fontSize: 20, fontWeight: 700, color: MUTED, marginTop: 8 }}>
            {`${input.totalCandidates.toLocaleString('en-US')} candidates · ${input.partyCount} ${input.partyCount === 1 ? 'party' : 'parties'}${input.totalRaces ? ` · ${input.totalRaces} races` : ''}`}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', fontSize: 34, fontWeight: 900, color: '#f97316' }}>Choseno</div>
          <div style={{ display: 'flex', fontSize: 16, fontWeight: 700, color: MUTED, marginTop: 2 }}>choseno.com</div>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', marginTop: 20, gap: GAP, width: 1128 }}>
        {parties.length === 0 && (
          <div style={{ display: 'flex', fontSize: 30, fontWeight: 700, color: MUTED }}>
            Candidates will appear as nominations are confirmed.
          </div>
        )}
        {parties.map((p) => {
          const coverage = input.totalRaces > 0 ? Math.min(100, Math.round((p.raceCount / input.totalRaces) * 100)) : 0;
          const more = p.count - p.avatars.length;
          // Long party names shrink instead of truncating ("New Democratic Party (NDP)").
          const nameSize = p.name.length > 24 ? 15 : p.name.length > 19 ? 17 : 21;
          return (
            <div
              key={p.name}
              style={{
                width: cardW,
                height: cardH,
                display: 'flex',
                flexDirection: 'column',
                background: 'rgba(255,255,255,0.94)',
                borderRadius: 20,
                border: '1px solid rgba(100,128,154,0.25)',
                boxShadow: '0 8px 22px rgba(30,40,80,0.10)',
                overflow: 'hidden',
              }}
            >
              <div style={{ display: 'flex', height: 7, width: '100%', background: p.hue }} />
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  flex: 1,
                  padding: '14px 18px',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', fontSize: nameSize, fontWeight: 900, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {p.name}
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <div style={{ display: 'flex', fontSize: 50, fontWeight: 900, lineHeight: 1, color: p.hue }}>{p.count}</div>
                  <div style={{ display: 'flex', fontSize: 16, fontWeight: 700, color: MUTED, marginLeft: 8, marginBottom: 6 }}>
                    {p.count === 1 ? 'candidate' : 'candidates'}
                  </div>
                </div>
                {input.totalRaces > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 700, color: MUTED }}>
                      <div style={{ display: 'flex' }}>{`Running in ${p.raceCount} of ${input.totalRaces} races`}</div>
                      <div style={{ display: 'flex', color: INK }}>{`${coverage}%`}</div>
                    </div>
                    <div style={{ display: 'flex', height: 8, borderRadius: 4, background: '#d8e6f3', marginTop: 6, overflow: 'hidden' }}>
                      <div style={{ display: 'flex', height: 8, width: `${coverage}%`, background: p.hue, borderRadius: 4 }} />
                    </div>
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', paddingRight: 10 }}>
                  {p.avatars.map((a, k) => (
                    <Avatar key={k} name={a.name} photo={a.photo} />
                  ))}
                  {more > 0 && (
                    <div style={{ display: 'flex', fontSize: 14, fontWeight: 700, color: MUTED, marginLeft: 18 }}>{`+${more} more`}</div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {input.hiddenParties > 0 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: 16, fontWeight: 700, color: MUTED, marginTop: 8 }}>
          {`+ ${input.hiddenParties} more ${input.hiddenParties === 1 ? 'party' : 'parties'} on choseno.com`}
        </div>
      )}
    </div>
  );
}
