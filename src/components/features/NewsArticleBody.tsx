"use client";

import ReactMarkdown from "react-markdown";

interface Props {
  body: string;
}

// Two optional extensions on top of plain Markdown, for long explainers:
//   :::details Summary text   ...markdown...   :::   -> collapsible <details>
//   consecutive lines starting with "|"               -> table (header row, "---" row, body rows)
// Plain Markdown bodies are unaffected.
type Block =
  | { type: "md"; text: string }
  | { type: "table"; rows: string[][] }
  | { type: "details"; summary: string; blocks: Block[] };

function splitRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
}

function parseBlocks(lines: string[]): Block[] {
  const blocks: Block[] = [];
  let buf: string[] = [];
  const flush = () => {
    if (buf.length && buf.some((l) => l.trim())) blocks.push({ type: "md", text: buf.join("\n") });
    buf = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const detailsMatch = line.match(/^:::details\s+(.+)$/);
    if (detailsMatch) {
      flush();
      const inner: string[] = [];
      i++;
      while (i < lines.length && lines[i].trim() !== ":::") {
        inner.push(lines[i]);
        i++;
      }
      blocks.push({ type: "details", summary: detailsMatch[1].trim(), blocks: parseBlocks(inner) });
      continue;
    }
    if (line.trim().startsWith("|")) {
      flush();
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        if (!/^\|?\s*:?-{3,}/.test(lines[i].trim())) rows.push(splitRow(lines[i]));
        i++;
      }
      i--;
      blocks.push({ type: "table", rows });
      continue;
    }
    buf.push(line);
  }
  flush();
  return blocks;
}

function renderBlocks(blocks: Block[]) {
  return blocks.map((block, idx) => {
    if (block.type === "md") {
      return <ReactMarkdown key={idx}>{block.text}</ReactMarkdown>;
    }
    if (block.type === "table") {
      const [head, ...rows] = block.rows;
      return (
        <div key={idx} className="overflow-x-auto rounded-xl border border-border-light/30">
          <table className="w-full min-w-[720px] border-collapse text-left text-xs sm:text-sm">
            <thead>
              <tr className="bg-surface">
                {head.map((cell, c) => (
                  <th
                    key={c}
                    className={`px-3 py-2 font-bold text-text-main align-bottom ${c === 0 ? "sticky left-0 bg-surface" : ""}`}
                  >
                    {cell}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, r) => (
                <tr key={r} className="border-t border-border-light/20 align-top">
                  {row.map((cell, c) => (
                    <td
                      key={c}
                      className={
                        c === 0
                          ? "sticky left-0 bg-surface px-3 py-2 font-semibold text-text-main"
                          : "px-3 py-2 text-text-secondary"
                      }
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    return (
      <details key={idx} className="group rounded-xl border border-border-light/30 bg-surface/40 px-4 py-3">
        <summary className="cursor-pointer select-none list-none font-bold text-text-main flex items-center justify-between gap-3">
          <span>{block.summary}</span>
          <span className="text-text-muted text-sm transition-transform group-open:rotate-180" aria-hidden="true">
            ▾
          </span>
        </summary>
        <div className="mt-3 space-y-4">{renderBlocks(block.blocks)}</div>
      </details>
    );
  });
}

export default function NewsArticleBody({ body }: Props) {
  const blocks = parseBlocks(body.split("\n"));
  return (
    <div className="prose prose-sm prose-invert max-w-none text-text-secondary leading-relaxed space-y-4
      [&_h2]:text-text-main [&_h2]:font-bold [&_h2]:text-xl [&_h2]:mt-6 [&_h2]:mb-3
      [&_h3]:text-text-main [&_h3]:font-semibold [&_h3]:text-base [&_h3]:mt-5 [&_h3]:mb-2
      [&_p]:text-text-secondary [&_p]:leading-relaxed
      [&_a]:text-primary [&_a]:underline [&_a]:hover:text-primary-hover
      [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1
      [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1
      [&_li]:text-text-secondary [&_li]:text-sm
      [&_blockquote]:border-l-4 [&_blockquote]:border-primary/40 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-text-muted
      [&_code]:bg-surface [&_code]:text-primary [&_code]:text-xs [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded
      [&_pre]:bg-surface [&_pre]:rounded-xl [&_pre]:p-4 [&_pre]:overflow-x-auto [&_pre]:text-xs
      [&_strong]:text-text-main [&_strong]:font-semibold
      [&_hr]:border-border-light/20 [&_hr]:my-6
      [&_summary::-webkit-details-marker]:hidden
    ">
      {renderBlocks(blocks)}
    </div>
  );
}
