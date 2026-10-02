import type {
  CodeAnalysis,
  CodeLocation,
  CodeMember,
  CodeType,
} from "../types/analysis";

/** A type or member, flattened so every panel can address it by one id. */
export interface NodeSpan {
  id: string;
  name: string;
  kind: string;
  /** The type this span belongs to, or the type's own id. */
  typeId: string;
  isMember: boolean;
  location: CodeLocation;
}

export function buildSpans(analysis: CodeAnalysis): NodeSpan[] {
  const spans: NodeSpan[] = [];

  for (const type of analysis.types) {
    spans.push({
      id: type.id,
      name: type.name,
      kind: type.kind,
      typeId: type.id,
      isMember: false,
      location: type.location,
    });

    for (const member of type.members) {
      spans.push({
        id: member.id,
        name: member.name,
        kind: member.kind,
        typeId: type.id,
        isMember: true,
        location: member.location,
      });
    }
  }

  return spans;
}

export function findType(
  analysis: CodeAnalysis,
  id: string | null,
): CodeType | null {
  if (!id) {
    return null;
  }

  return analysis.types.find((type) => type.id === id) ?? null;
}

/** Returns the type owning the id, whether the id names a type or a member. */
export function findOwnerType(
  analysis: CodeAnalysis,
  id: string | null,
): CodeType | null {
  if (!id) {
    return null;
  }

  for (const type of analysis.types) {
    if (type.id === id) {
      return type;
    }

    if (type.members.some((member) => member.id === id)) {
      return type;
    }
  }

  return null;
}

export function findMember(
  analysis: CodeAnalysis,
  id: string | null,
): CodeMember | null {
  if (!id) {
    return null;
  }

  for (const type of analysis.types) {
    const member = type.members.find((candidate) => candidate.id === id);

    if (member) {
      return member;
    }
  }

  return null;
}

export function locationOf(
  analysis: CodeAnalysis,
  id: string | null,
): CodeLocation | null {
  if (!id) {
    return null;
  }

  const type = findType(analysis, id);

  if (type) {
    return type.location;
  }

  return findMember(analysis, id)?.location ?? null;
}

/** The smallest span containing a caret, so a method wins over its class. */
export function spanAtPosition(
  spans: NodeSpan[],
  line: number,
  column: number,
): NodeSpan | null {
  let best: NodeSpan | null = null;
  let bestSize = Number.POSITIVE_INFINITY;

  for (const span of spans) {
    if (!containsPosition(span.location, line, column)) {
      continue;
    }

    const size = spanSize(span.location);

    if (size < bestSize) {
      best = span;
      bestSize = size;
    }
  }

  return best;
}

export function containsPosition(
  location: CodeLocation,
  line: number,
  column: number,
): boolean {
  if (line < location.startLine || line > location.endLine) {
    return false;
  }

  // Only the first and last lines are bounded by columns.
  if (line === location.startLine && column < location.startColumn) {
    return false;
  }

  if (line === location.endLine && column > location.endColumn) {
    return false;
  }

  return true;
}

function spanSize(location: CodeLocation): number {
  return (
    (location.endLine - location.startLine) * 10_000 +
    (location.endColumn - location.startColumn)
  );
}

export function formatLocation(location: CodeLocation): string {
  return location.startLine === location.endLine
    ? `line ${location.startLine}`
    : `lines ${location.startLine}–${location.endLine}`;
}

