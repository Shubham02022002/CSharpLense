interface CodeEditorProps {
    code: string;
    onChange: (code: string) => void;
}

function CodeEditor({ code, onChange }: CodeEditorProps) {
    return (
        <section
            style={{
                borderRight: "1px solid #252936",
                display: "flex",
                flexDirection: "column",
            }}
        >
            <div
                style={{
                    padding: "14px 20px",
                    borderBottom: "1px solid #252936",
                    color: "#9ca3af",
                    fontSize: "13px",
                }}
            >
                C# Code
            </div>

            <textarea
                value={code}
                onChange={(event) => onChange(event.target.value)}
                spellCheck={false}
                style={{
                    flex: 1,
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "20px",
                    resize: "none",
                    border: "none",
                    outline: "none",
                    background: "#151821",
                    color: "#e5e7eb",
                    fontFamily: "monospace",
                    fontSize: "14px",
                    lineHeight: 1.7,
                }}
            />
        </section>
    );
}

export default CodeEditor;