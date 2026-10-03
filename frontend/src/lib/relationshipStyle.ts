import type { CodeTypeKind, RelationshipType } from "../types/analysis";

/** Colours for the 2D graph, which resolves CSS variables. */
export const RELATIONSHIP_COLORS: Record<RelationshipType, string> = {
  Inheritance: "#4f2bab",
  Implementation: "#0f7a72",
  Dependency: "var(--gold)",
};

/** The same colours as literals; WebGL cannot resolve a CSS variable. */
export const RELATIONSHIP_HEX: Record<RelationshipType, string> = {
  Inheritance: "#4f2bab",
  Implementation: "#0f7a72",
  Dependency: "#b8862a",
};

/** One hue per kind, so the scene stays readable without reading the label. */
export const TYPE_HEX: Record<CodeTypeKind, string> = {
  Class: "#4f2bab",
  Interface: "#0f7a72",
  Struct: "#b8862a",
  Enum: "#2f6fb5",
  Record: "#9e6de9",
};
