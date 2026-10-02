import type { CodeAnalysis, CodeMember, CodeType } from "../types/analysis";
import { findMember, findType, formatLocation } from "../lib/model";

interface TypeDetailsProps {
  analysis: CodeAnalysis;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string) => void;
}

/** Only callables take a parameter list; a field is just its type and name. */
function memberSignature(member: CodeMember) {
  const head = member.returnType ? `${member.returnType} ` : "";

  return member.kind === "Method" || member.kind === "Constructor"
    ? `${head}${member.name}(${member.parameters.join(", ")})`
    : `${head}${member.name}`;
}

function TypeDetails({
  analysis,
  selectedNodeId,
  onSelectNode,
}: TypeDetailsProps) {
  const selectedType = findType(analysis, selectedNodeId);
  const owner = selectedType ?? null;
  const selectedMember = owner ? null : findMember(analysis, selectedNodeId);

  const type: CodeType | null =
    owner ??
    (selectedMember
      ? (analysis.types.find((candidate) =>
          candidate.members.some((member) => member.id === selectedMember.id),
        ) ?? null)
      : null);

  if (!type) {
    return null;
  }

  const modifiers = [
    type.accessibility,
    type.isStatic ? "static" : "",
    type.isAbstract ? "abstract" : "",
  ].filter(Boolean);

  return (
    <section style={{ paddingBottom: "4px" }}>
      <header
        style={{
          padding: "2px 4px 12px",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div
          style={{
            fontSize: "15px",
            fontWeight: 600,
            color: "var(--text-strong)",
            wordBreak: "break-word",
          }}
        >
          {type.name}
        </div>

        <div
          style={{
            marginTop: "5px",
            display: "flex",
            flexWrap: "wrap",
            gap: "6px",
            fontSize: "11px",
          }}
        >
          <span style={{ color: "var(--accent)", fontWeight: 600 }}>
            {modifiers.join(" ")} {type.kind.toLowerCase()}
          </span>

          <span style={{ color: "var(--text-muted)" }}>
            {formatLocation(type.location)}
          </span>
        </div>

        {type.namespace && (
          <div
            style={{
              marginTop: "5px",
              fontSize: "11px",
              color: "var(--text-faint)",
              fontFamily: "var(--font-mono)",
            }}
          >
            {type.namespace}
          </div>
        )}
      </header>

      {type.baseTypes.length > 0 && (
        <div
          style={{
            padding: "10px 4px",
            borderBottom: "1px solid var(--border)",
            fontSize: "11px",
            color: "var(--text-muted)",
          }}
        >
          <span style={{ color: "var(--text-muted)" }}>implements </span>
          <span style={{ fontFamily: "var(--font-mono)" }}>
            {type.baseTypes.join(", ")}
          </span>
        </div>
      )}

      <div style={{ paddingTop: "8px" }}>
        {type.members.length === 0 ? (
          <div
            style={{
              padding: "12px 4px",
              color: "var(--text-faint)",
              fontSize: "12px",
            }}
          >
            No members.
          </div>
        ) : (
          type.members.map((member) => {
            const isSelected = member.id === selectedNodeId;

            return (
              <button
                key={member.id}
                type="button"
                className="cls-row"
                data-selected={isSelected}
                onClick={() => onSelectNode(member.id)}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "8px 10px",
                  borderRadius: "var(--radius-sm)",
                  cursor: "pointer",
                  color: "inherit",
                  font: "inherit",
                }}
              >
                <div
                  style={{
                    fontSize: "12px",
                    color: isSelected ? "var(--text-strong)" : "var(--text)",
                    fontFamily: "var(--font-mono)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {memberSignature(member)}
                </div>

                <div
                  style={{
                    marginTop: "3px",
                    display: "flex",
                    gap: "8px",
                    fontSize: "10px",
                    color: "var(--text-faint)",
                  }}
                >
                  {member.accessibility && <span>{member.accessibility}</span>}
                  {member.isStatic && <span>static</span>}
                  <span style={{ color: "var(--accent)" }}>
                    {member.kind.toLowerCase()}
                  </span>
                  <span>line {member.location.startLine}</span>
                </div>
              </button>
            );
          })
        )}
      </div>
    </section>
  );
}

export default TypeDetails;
