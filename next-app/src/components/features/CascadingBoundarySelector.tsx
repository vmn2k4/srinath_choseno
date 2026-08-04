import Select from "@/components/primitives/Select";
import Spinner from "@/components/primitives/Spinner";

export type SelectOption = { value: string; label: string };

// Extracted from a pattern hand-rolled independently in four places found
// during the migration inventory: PoliticianElections.jsx's "Browse a
// Different Area" panel, ElectionsAdmin.jsx's seat-building wizard,
// BoundaryVisualizer.jsx, and RedistrictingPanel.jsx — all four are some
// variant of "pick a country, then a container type (e.g. Province/State),
// then a specific container." Purely presentational: the page composing
// this owns the actual data fetching (via the ported boundaries service in
// Phase 4) and passes the three option lists + current selections down.
export default function CascadingBoundarySelector({
  countries,
  country,
  onCountryChange,
  containerTypes,
  containerType,
  onContainerTypeChange,
  containers,
  containerId,
  onContainerChange,
  loading = false,
  className = "",
}: {
  countries: SelectOption[];
  country: string;
  onCountryChange: (value: string) => void;
  containerTypes: SelectOption[];
  containerType: string;
  onContainerTypeChange: (value: string) => void;
  containers: SelectOption[];
  containerId: string;
  onContainerChange: (value: string) => void;
  loading?: boolean;
  className?: string;
}) {
  return (
    <div className={`grid grid-cols-1 sm:grid-cols-3 gap-3 ${className}`.trim()}>
      <Select value={country} onChange={(e) => onCountryChange(e.target.value)}>
        <option value="">Country</option>
        {countries.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </Select>

      <Select
        value={containerType}
        onChange={(e) => onContainerTypeChange(e.target.value)}
        disabled={!country || containerTypes.length === 0}
      >
        <option value="">Container type</option>
        {containerTypes.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </Select>

      <div className="flex items-center gap-2">
        <Select
          value={containerId}
          onChange={(e) => onContainerChange(e.target.value)}
          disabled={!containerType || containers.length === 0}
          className="flex-1"
        >
          <option value="">Container</option>
          {containers.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </Select>
        {loading && <Spinner size="sm" />}
      </div>
    </div>
  );
}
