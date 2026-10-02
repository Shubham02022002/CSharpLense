export type CodeTypeKind = "Class" | "Interface" | "Struct" | "Record" | "Enum";

export type CodeMemberKind =
  | "Constructor"
  | "Method"
  | "Property"
  | "Field"
  | "Event";

export type RelationshipType = "Inheritance" | "Implementation" | "Dependency";

export type DiagnosticSeverity = "Error" | "Warning" | "Info" | "Hidden";

/** A 1-based span in the analyzed source. */
export interface CodeLocation {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}

export interface CodeMember {
  id: string;
  name: string;
  kind: CodeMemberKind;
  returnType: string;
  accessibility: string;
  isStatic: boolean;
  parameters: string[];
  location: CodeLocation;
}

export interface CodeType {
  id: string;
  name: string;
  namespace: string;
  kind: CodeTypeKind;
  accessibility: string;
  isAbstract: boolean;
  isStatic: boolean;
  /** Names this type inherits or implements, as written in source. */
  baseTypes: string[];
  members: CodeMember[];
  location: CodeLocation;
}

export interface CodeRelationship {
  sourceId: string;
  targetId: string;
  type: RelationshipType;
}

export interface CodeDiagnostic {
  id: string;
  /** Compiler diagnostic id, e.g. "CS0103". */
  code: string;
  message: string;
  severity: DiagnosticSeverity;
  location: CodeLocation;
}

export interface CodeAnalysis {
  id: string;
  types: CodeType[];
  relationships: CodeRelationship[];
  diagnostics: CodeDiagnostic[];
}

export interface Capabilities {
  aiConfigured: boolean;
  speechConfigured: boolean;
  explanationSource: string;
}

export interface CodeExplanation {
  answer: string;
  focusNodeIds: string[];
  concepts: string[];
  /** Which service produced this, e.g. "anthropic" or "heuristic". */
  source: string;
}
