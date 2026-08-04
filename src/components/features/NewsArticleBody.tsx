"use client";

import ReactMarkdown from "react-markdown";

interface Props {
  body: string;
}

export default function NewsArticleBody({ body }: Props) {
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
    ">
      <ReactMarkdown>{body}</ReactMarkdown>
    </div>
  );
}
