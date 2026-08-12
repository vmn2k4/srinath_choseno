# Find My District - Directory Integration

## Overview

The Find My District page (`/find-my-district`) has been enhanced to display a "Chain of Representation" section below the electoral boundaries list. When a user selects a location, they now see:

1. **Electoral Boundaries List** - A clickable list of all electoral boundaries they belong to
2. **Chain of Representation** - A hierarchical view of officials representing them at different government levels

## Architecture

### Page Layout

```
┌─────────────────────────────────────────────────┐
│         Find Your District (Heading)             │
├─────────────────────────────────────────────────┤
│         Location Picker (Map + Search)           │
├─────────────────────────────────────────────────┤
│         Electoral Boundaries List                │
│  ┌──────────────────────────────────────────┐   │
│  │ • Vancouver Centre (Federal Riding)      │   │
│  │ • Vancouver-West End (Provincial Riding)│   │
│  │ • Vancouver Ward 1 (Municipal Ward)     │   │
│  └──────────────────────────────────────────┘   │
├─────────────────────────────────────────────────┤
│   Chain of Representation (NEW)                  │
│   ┌──────────────────────────────────────────┐  │
│   │ Tabs: All | Federal | Provincial ...     │  │
│   ├──────────────────────────────────────────┤  │
│   │ Federal Branch:                          │  │
│   │ ┌──────────┐  ┌──────────┐              │  │
│   │ │ PM Name  │  │ MP Name  │              │  │
│   │ └──────────┘  └──────────┘              │  │
│   │                                          │  │
│   │ Provincial Branch:                       │  │
│   │ ┌──────────┐  ┌──────────┐              │  │
│   │ │ Premier  │  │ MLA Name │              │  │
│   │ └──────────┘  └──────────┘              │  │
│   │                                          │  │
│   │ Municipal Branch:                        │  │
│   │ ┌──────────┐  ┌──────────┐ ┌─────────┐ │  │
│   │ │ Mayor    │  │ Councillor│ │Councillor│ │  │
│   │ └──────────┘  └──────────┘ └─────────┘ │  │
│   └──────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

### Component Structure

**FindMyDistrictClient.tsx** (`src/components/features/FindMyDistrictClient.tsx`)
- Main client component that orchestrates the flow
- Fetches boundaries when user selects a location
- Resolves branches (representatives) for each boundary
- Displays boundaries list and directory

**BoundaryDirectoryClient.tsx** (reused existing component)
- Renders the hierarchical view of representatives
- Supports tab switching between boundary types
- Intelligently lays out compact vs. wide branches

**RepresentationBranchTree.tsx** (reused existing component)
- Renders individual representative cards
- Shows role, party, contact info, and photo

## Implementation Details

### Helper Functions

#### `resolveBranch(supabase, shape)`
Converts a shape (boundary) into a `RepresentationBranch` object containing:
- **top**: The head of the branch (PM, Premier, Mayor, etc.)
- **bottom**: Other representatives (MPs, MLAs, Councillors)
- **key**: Unique identifier for the branch
- **label**: Display name (e.g., "Federal", "Provincial")

The function handles:
- Fetching office holders from the database
- Separating head roles from subordinate roles
- Resolving superior office holders (national/container-based)

#### `toNode(row)`
Transforms a database office holder record into a `BranchHolderNode` for display

### Data Flow

```
User selects location
    ↓
findBoundariesByPoint() → Get list of boundaries
    ↓
For each boundary:
    resolveBranch() → Fetch office holders
        ↓
    Separate head/bottom roles
        ↓
    Fetch superior if needed
        ↓
    Build RepresentationBranch
    ↓
Display boundaries + BoundaryDirectoryClient(branches)
```

### State Management

```typescript
const [boundaries, setBoundaries] = useState<MatchedBoundary[] | null>(null)
const [branches, setBranches] = useState<RepresentationBranch[]>([])
const [loading, setLoading] = useState(false)
const [branchesLoading, setBranchesLoading] = useState(false)
const [error, setError] = useState("")
```

## Key Features

### 1. **Hierarchical View**
Representatives are organized by government level:
- Federal: Prime Minister → MP
- Provincial: Premier → MLA
- Municipal: Mayor → Councillors

### 2. **Responsive Layout**
- Compact branches (2-3 people): Side-by-side grid
- Wide branches (4+ people): Full-width layout
- Mobile-friendly: Stacks vertically

### 3. **Tab Filtering**
- "All" tab shows all branches for the location
- Specific tabs filter by government level (Federal, Provincial, Municipal)

### 4. **Error Handling**
- Gracefully handles missing boundaries
- Shows "No office holders data available" if branch resolution fails
- Continues processing other boundaries even if one fails

## Code Reuse

The implementation follows the DRY principle by reusing existing components:

1. **BoundaryDirectoryClient** - Already handles branch rendering and tab logic
2. **RepresentationBranchTree** - Already renders representative cards
3. **ResolveBranch logic** - Ported directly from elections page for consistency

## Performance Considerations

### Concurrent Fetching
- All boundary branches are fetched in parallel using `Promise.all()`
- Reduces total load time vs. sequential fetching

### Error Resilience
- `resolveBranch()` wrapped in try-catch
- Failed branches filtered out, others still display
- No single boundary blocks page rendering

### Optimization Opportunities

Future improvements could include:
1. **Caching** - Memoize branch resolution results
2. **Lazy Loading** - Load branches on-demand when user selects tab
3. **Pagination** - For areas with many representatives
4. **Prefetching** - Load branches while user searches address

## Testing Scenarios

### Test Case 1: Standard Location
- **Input**: 1055 W Georgia St, Vancouver
- **Expected**: 
  - Shows 3+ boundaries (Federal, Provincial, Municipal)
  - Directory displays Federal (PM + MP), Provincial (Premier + MLA), Municipal (Mayor + Councillors)
  - Tab filtering works correctly

### Test Case 2: Remote/Rural Area
- **Input**: Rural location with fewer boundaries
- **Expected**: 
  - Shows 1-2 boundaries
  - Directory only shows available branches
  - "No data" message for missing branches

### Test Case 3: Loading States
- **Expected**:
  - Spinner shows while fetching boundaries
  - Second spinner shows while fetching branches
  - Page remains responsive

### Test Case 4: Empty Results
- **Input**: International location or unmapped area
- **Expected**: 
  - Shows "No mapped boundaries" message
  - No directory section displayed

## Integration with Elections Page

The elections page (`/elections/[boundarySlug]`) uses the same pattern:
- Same `resolveBranch()` logic for consistency
- Same `BoundaryDirectoryClient` for rendering
- Same data structures and types

This integration ensures:
- Consistent UX across pages
- Shared code reduces maintenance burden
- Future changes benefit both pages

## Component Props

### FindMyDistrictClient
No props - fully self-contained client component

### BoundaryDirectoryClient
```typescript
interface Props {
  branches: RepresentationBranch[]
  defaultBranchKey: string  // Which tab opens initially (e.g., "all" or "federal")
}
```

## File Changes

### Modified Files
- `src/components/features/FindMyDistrictClient.tsx` - Enhanced with directory display

### Unchanged Files (Reused)
- `src/components/features/BoundaryDirectoryClient.tsx`
- `src/components/features/RepresentationBranchTree.tsx`
- `src/lib/services/boundaries.ts`
- `src/lib/services/elections.ts`

## Future Enhancements

1. **Bookmark Boundaries** - Save favorite boundaries for quick access
2. **Share Results** - Generate shareable link with location
3. **Political Stance** - Show officials' positions on key issues
4. **Contact Widget** - In-page contact forms for representatives
5. **Event Listings** - Show upcoming town halls, office hours
6. **Comparison View** - Compare representatives across boundaries
