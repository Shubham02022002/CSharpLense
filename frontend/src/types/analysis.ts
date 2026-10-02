export type CodeTypeKind = "Class" | "Interface" | "Struct" | "Record" | "Enum";

export type CodeMemberKind = "Constructor" | "Method" | "Property" | "Field";

export type RelationshipType = "Inheritance" | "Implementation" | "Dependency";

export interface CodeMember {
  id: string;
  name: string;
  kind: CodeMemberKind | number;
  returnType: string;
  parameters: string[];
}

export interface CodeType {
  id: string;
  name: string;
  kind: CodeTypeKind | number;
  members: CodeMember[];
}

export interface CodeRelationship {
  sourceId: string;
  targetId: string;
  type: RelationshipType | number;
}

export interface CodeDiagnostic {
  id: string;
  message: string;
  severity: string;
  startLine: number;
  startColumn: number;
}

export interface CodeAnalysis {
  types: CodeType[];
  relationships: CodeRelationship[];
  diagnostics: CodeDiagnostic[];
} 
