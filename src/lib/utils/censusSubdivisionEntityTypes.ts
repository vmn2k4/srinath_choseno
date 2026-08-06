// Statistics Canada Census Subdivision Type (CSDTYPE) code -> entity_types
// category name. Source: StatsCan SGC 2021 CSD type reference. Codes not
// listed are left unclassified (no filtering effect) rather than guessed at.
export const CSD_TYPE_PROPERTY_KEY = "CSDTYPE";

export const CSD_TYPE_TO_ENTITY_TYPE: Record<string, string> = {
  // Municipality
  C: "Municipality",
  CY: "Municipality",
  CV: "Municipality",
  DM: "Municipality",
  VL: "Municipality",
  V: "Municipality",
  T: "Municipality",
  TV: "Municipality",
  TP: "Municipality",
  M: "Municipality",
  MU: "Municipality",
  RM: "Municipality",
  RGM: "Municipality",
  MRM: "Municipality",
  RMU: "Municipality",
  IM: "Municipality",
  RCR: "Municipality",
  RDR: "Municipality",
  SC: "Municipality",
  CT: "Municipality",
  CU: "Municipality",
  PE: "Municipality",
  P: "Municipality",
  "MÉ": "Municipality",
  SV: "Municipality",
  MD: "Municipality",
  SM: "Municipality", // Specialized municipality (Alberta, e.g. Wood Buffalo) -- incorporated, elected council
  RV: "Municipality", // Resort village (Saskatchewan) -- incorporated, elected council
  GR: "Municipality", // Gouvernement régional (Quebec regional government) -- elected local governance
  // Indian Reserve
  IRI: "Indian Reserve",
  // Indian Settlement
  "S-É": "Indian Settlement",
  "SÉ": "Indian Settlement",
  SET: "Indian Settlement",
  IGD: "Indian Settlement",
  // Regional Electoral Area
  RDA: "Regional Electoral Area",
  // Treaty / Self-Governing Land
  NL: "Treaty / Self-Governing Land",
  TAL: "Treaty / Self-Governing Land",
  TWL: "Treaty / Self-Governing Land",
  TL: "Treaty / Self-Governing Land", // Teslin land (Yukon self-governing First Nation)
  TC: "Treaty / Self-Governing Land",
  TI: "Treaty / Self-Governing Land",
  TK: "Treaty / Self-Governing Land",
  VC: "Treaty / Self-Governing Land",
  VK: "Treaty / Self-Governing Land",
  VN: "Treaty / Self-Governing Land",
  NV: "Treaty / Self-Governing Land", // Northern village (Quebec Nunavik) -- same governance category as Village nordique (VN)
  // Other / Unorganized
  NO: "Other / Unorganized",
  SNO: "Other / Unorganized",
  CC: "Other / Unorganized",
  CG: "Other / Unorganized",
  SG: "Other / Unorganized",
  HAM: "Other / Unorganized",
  NH: "Other / Unorganized",
  ID: "Other / Unorganized",
  LGD: "Other / Unorganized",
  SA: "Other / Unorganized",
  FD: "Other / Unorganized",
};

export function getEntityTypeNameForShape(properties: Record<string, unknown> | null | undefined): string | null {
  const code = properties?.[CSD_TYPE_PROPERTY_KEY];
  if (typeof code !== "string") return null;
  return CSD_TYPE_TO_ENTITY_TYPE[code] ?? null;
}
