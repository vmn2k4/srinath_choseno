import Script from "next/script";

// Google Publisher Center's "Sync updates with your CMS" snippet
// (swg-basic). Reports each article's status to Google News / News
// Showcase as it's viewed, so publish/update/unpublish changes reflect
// there without waiting on a manual re-crawl.
//
// Per Google's own instructions this belongs on the article content
// itself, not site-wide -- see news/[slug]/page.tsx, the only place this
// is mounted. Values below (isPartOfProductId, theme, lang) are copied
// verbatim from the Choseno Publisher Center account; don't change them
// without pulling a fresh snippet from Publisher Center.
//
// Production-only, same gate as GoogleAnalytics.tsx -- dev/localhost views
// shouldn't report into Publisher Center's article-sync stats.
export default function GoogleNewsShowcaseSync() {
  if (process.env.NODE_ENV !== "production") return null;

  return (
    <>
      <Script
        async
        type="application/javascript"
        src="https://news.google.com/swg/js/v1/swg-basic.js"
        strategy="afterInteractive"
      />
      <Script id="swg-basic-init" strategy="afterInteractive">
        {`(self.SWG_BASIC = self.SWG_BASIC || []).push(basicSubscriptions => {
  basicSubscriptions.init({
    type: "NewsArticle",
    isPartOfType: ["Product"],
    isPartOfProductId: "CAowtK_hCw:openaccess",
    clientOptions: { theme: "light", lang: "en" },
  });
});`}
      </Script>
    </>
  );
}
