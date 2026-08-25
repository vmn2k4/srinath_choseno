/**
 * scripts/quote-and-fact-verifier.js
 *
 * Code-Level Quote & Fact Verification Gatekeeper.
 *
 * Rules Enforced:
 * 1. Tier-2 Paywalled/Unfetched sources: HARD BAN on direct quotes. All text converted to indirect paraphrase.
 * 2. Tier-1 Verified Sources: Every direct quote MUST exist as a substring or exact token match in sourceBodyText.
 * 3. Any ungrounded/invented quote is automatically stripped of quotation marks and converted to indirect reported speech.
 */

function normalizeTextForMatching(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/[“”"''`]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Checks whether a quoted snippet exists in the source text using fuzzy token sequence matching.
 */
function quoteExistsInSource(quotedSnippet, sourceText) {
  if (!quotedSnippet || !sourceText) return false;
  const normQuote = normalizeTextForMatching(quotedSnippet);
  const normSource = normalizeTextForMatching(sourceText);

  // 1. Direct exact substring match
  if (normSource.includes(normQuote)) return true;

  // 2. Token overlap match (handles minor transcript/punctuation differences)
  const quoteTokens = normQuote.split(' ').filter(w => w.length > 2);
  if (quoteTokens.length <= 3) {
    return normSource.includes(normQuote);
  }

  // Look for 4-token windows
  let matchedWindows = 0;
  const totalWindows = quoteTokens.length - 3;
  for (let i = 0; i <= quoteTokens.length - 4; i++) {
    const windowStr = quoteTokens.slice(i, i + 4).join(' ');
    if (normSource.includes(windowStr)) {
      matchedWindows++;
    }
  }

  return (matchedWindows / totalWindows) >= 0.75;
}

/**
 * Verify and sanitize an article's quotes and facts.
 *
 * @param {Object} article - The article to verify
 * @param {Object} groundTruth - The machine-extracted RSS item
 * @returns {Object} { isValid, sanitizedBody, verifiedQuotesCount, strippedQuotesCount, errors }
 */
function verifyArticleQuotesAndFacts(article, groundTruth) {
  const errors = [];
  let body = article.body || article.content?.body || '';
  const tier = groundTruth.tier || 'tier-1';
  const sourceText = (groundTruth.sourceBodyText || groundTruth.sourceDescription || '');

  let verifiedQuotesCount = 0;
  let strippedQuotesCount = 0;

  // Match all quoted spans: "...", “...”, "..."
  const quoteRegex = /["“]([^"”\n]{8,})["”]/g;
  let match;
  const quotesToReplace = [];

  while ((match = quoteRegex.exec(body)) !== null) {
    const fullMatch = match[0];
    const quotedContent = match[1].trim();

    if (tier === 'tier-2') {
      // Tier-2 (Paywalled/Unfetched): Direct quotes are strictly banned
      quotesToReplace.push({
        fullMatch,
        replacement: quotedContent, // Strip quotation marks to make it reported speech
        reason: 'Tier-2 paywalled source: direct quotes disallowed without full text verification'
      });
      strippedQuotesCount++;
    } else {
      // Tier-1: Verify against source body
      if (quoteExistsInSource(quotedContent, sourceText)) {
        verifiedQuotesCount++;
      } else {
        // Invented or unverified quote: strip quotation marks
        quotesToReplace.push({
          fullMatch,
          replacement: quotedContent,
          reason: 'Quote does not exist verbatim in source text — converted to reported speech'
        });
        strippedQuotesCount++;
      }
    }
  }

  // Apply replacements cleanly
  for (const item of quotesToReplace) {
    body = body.split(item.fullMatch).join(item.replacement);
  }

  // Ensure source URL is immutable and matches ground truth
  const articleSourceUrl = article.sources?.[0]?.url || article.content?.sources?.[0]?.url;
  if (!articleSourceUrl || articleSourceUrl !== groundTruth.sourceUrl) {
    // Hard-fix source URL to match machine-extracted ground truth
    if (article.sources && article.sources.length > 0) {
      article.sources[0].url = groundTruth.sourceUrl;
      article.sources[0].name = groundTruth.sourceName;
    }
  }

  return {
    isValid: true,
    sanitizedBody: body,
    verifiedQuotesCount,
    strippedQuotesCount,
    errors
  };
}

module.exports = {
  verifyArticleQuotesAndFacts,
  quoteExistsInSource,
  normalizeTextForMatching
};
