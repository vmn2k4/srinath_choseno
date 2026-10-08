export interface BlogInternalLink {
  title: string;
  url: string;
  description: string;
  badge?: string;
}

export interface BlogFaq {
  question: string;
  answer: string;
}

export interface BlogPost {
  slug: string;
  title: string;
  headline: string;
  excerpt: string;
  category: BlogCategory;
  publishedAt: string;
  updatedAt: string;
  readingTimeMinutes: number;
  primaryKeyword: string;
  secondaryKeywords: string[];
  metaTitle: string;
  metaDescription: string;
  takeaways: [string, string];
  contentMarkdown: string;
  faqs: BlogFaq[];
  internalLinks: BlogInternalLink[];
  featured?: boolean;
  /** Show the GPS-driven "your district" bar (DistrictRacesBanner) under the takeaways. */
  showDistrictBanner?: boolean;
}

export type BlogCategory =
  | "representation"
  | "powers"
  | "accountability"
  | "candidates"
  | "privacy"
  | "municipal"
  | "education"
  | "voting"
  | "campaigns"
  | "civics";

export interface BlogCategoryMeta {
  slug: BlogCategory;
  name: string;
  description: string;
}

export const BLOG_CATEGORIES: BlogCategoryMeta[] = [
  {
    slug: "representation",
    name: "Representation & Districts",
    description: "Find out who represents you across federal, state, and local electoral boundaries.",
  },
  {
    slug: "powers",
    name: "Government Powers",
    description: "Learn which level of government has the authority to solve specific everyday issues.",
  },
  {
    slug: "accountability",
    name: "Accountability & Ethics",
    description: "Tools and strategies to track voting records, campaign donations, and rate public officials.",
  },
  {
    slug: "candidates",
    name: "Candidate Vetting",
    description: "How to objectively evaluate candidates, analyze debate performances, and watch video Q&As.",
  },
  {
    slug: "privacy",
    name: "Safe Civic Voice",
    description: "Participate in local civic discourse without fear of doxxing, harassment, or workplace retaliation.",
  },
  {
    slug: "municipal",
    name: "City Hall & Mayors",
    description: "Understand city council procedures, municipal bylaws, urban zoning, and local budgets.",
  },
  {
    slug: "education",
    name: "School Boards",
    description: "The roles of school board trustees, curriculum policies, superintendent oversight, and bond measures.",
  },
  {
    slug: "voting",
    name: "Voting & Ballots",
    description: "State-by-state voter ID rules, voter registration deadlines, mail-in ballots, and sample ballot guides.",
  },
  {
    slug: "campaigns",
    name: "Running for Office",
    description: "Grassroots campaign guides, ballot nomination procedures, campaign finance limits, and canvassing tactics.",
  },
  {
    slug: "civics",
    name: "US vs Canada Civics",
    description: "Comparing the American presidential-congressional republic with the Canadian parliamentary system.",
  },
];
