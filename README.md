# CSharpLens

Reads C# source with Roslyn and maps its types, members, relationships and
diagnostics into an interactive graph you can navigate alongside the code.

## The idea

Roslyn is the single source of truth for structure. Every type, member,
relationship and diagnostic you see is read out of the compiler's own syntax
and semantic model — never inferred by a model, never guessed.

The AI layer sits on top and only interprets. When you ask a question, the
analysis is handed to the model as grounded facts, and the nodes and concepts
it highlights are matched back against that analysis deterministically. If no
provider is configured, the same endpoint answers from a Roslyn-only heuristic
instead, so the app is fully usable with no API keys at all.

## Repository layout

```
src/
  CSharpLens.Domain        Domain model: CodeAnalysis, CodeType, CodeMember,
                           CodeRelationship, CodeDiagnostic, CodeLocation
  CSharpLens.Analysis      RoslynCSharpAnalyzer — source in, CodeAnalysis out
  CSharpLens.AI            Explanation services (Anthropic + heuristic fallback)
  CSharpLens.Voice         Speech synthesis (ElevenLabs + null fallback)
  CSharpLens.Api           ASP.NET Core minimal API
  CSharpLens.Cli           Console dump of an analysis, for quick checks
frontend/                  React + TypeScript single-page app
samples/                   C# files to try
```

`Api` is the only composition root; it pulls in `AI`, `Analysis` and `Voice`,
and the first two read the model from `Domain`. Nothing points back upward.

## Prerequisites

- .NET SDK 10
- Node.js 20+ (developed against 24)

## Running locally

**API** — listens on `http://localhost:5142`:

```bash
dotnet run --project src/CSharpLens.Api
```

**Frontend** — starts on `http://localhost:5173` and proxies to the API above:

```bash
cd frontend
npm install
npm run dev
```

Then open the app and press **Analyze** — the editor starts with a bundled
sample already loaded.

**CLI** — no server needed, useful for checking what the analyzer produces:

```bash
dotnet run --project src/CSharpLens.Cli -- samples/Book.cs
```

## Configuration

Everything is optional. With no configuration the app runs on Roslyn-only
explanations and browser speech synthesis.

| Variable | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | Enables LLM explanations. Without it, structural ones are used. |
| `ANTHROPIC_BASE_URL` | Point the SDK at a compatible endpoint instead of Anthropic. |
| `ANTHROPIC_MODEL` | Defaults to `claude-opus-5`. |
| `ANTHROPIC_EFFORT` | `low` (default), `medium`, `high`, `max`. |
| `ELEVENLABS_API_KEY` | Enables server-side narration. Without it, the browser speaks. |
| `ELEVENLABS_VOICE_ID` | Defaults to a stock voice. |
| `ELEVENLABS_MODEL_ID` | Defaults to `eleven_turbo_v2_5`. |
| `CORS_ORIGINS` | Comma-separated allowed browser origins. Required in production. |

Keys are read from the environment or `dotnet user-secrets` — never from
`appsettings.json`, and never committed. During development any `localhost`
origin is accepted so Vite's automatic port fallback doesn't break CORS;
production allows only what `CORS_ORIGINS` lists.

Frontend: `VITE_API_URL` sets the API base. Vite inlines it **at build time**,
so changing it requires a rebuild, not just a restart. Unset, it falls back to
`http://localhost:5142`.

## API

| Method | Route | Body | Notes |
|---|---|---|---|
| `GET` | `/api/capabilities` | — | Reports which providers are configured. |
| `POST` | `/api/analyze` | `{ sourceCode }` | Returns the full `CodeAnalysis`. |
| `POST` | `/api/questions` | `{ analysis, question }` | Free-form question about the code. |
| `POST` | `/api/explain` | `{ analysis, nodeId }` | Explains one type or member. |
| `POST` | `/api/speak` | `{ text }` | Returns `audio/mpeg`. |

Enums serialize by name, not by ordinal.

**The API keeps no state.** `/api/questions` and `/api/explain` take the whole
analysis in the request body rather than a stored id — see *Design decisions*
below for why. Node ids are ordinary GUIDs generated per analysis, so they are
only meaningful next to the analysis that produced them.

**Limits.** Source is capped at 200,000 characters, questions at 2,000, and
request bodies at 4 MB. API endpoints share a rate limit of 20 calls per minute
per client IP, returning `429` when exceeded.

**Errors.** `400` for invalid input, `429` when rate limited, `502` when a
provider fails, `503` when a provider is unavailable or unconfigured. The
frontend treats `503` from `/api/speak` as a signal to fall back to browser
speech.

## Frontend

React 19 + TypeScript, built with Vite. Roslyn is not involved here — the UI
renders whatever `/api/analyze` returns.

- **Editor** — Monaco, with the C# buffer as the input to analysis.
- **Graph** — two views of the same model. A 2D relationship graph on
  `@xyflow/react`, and a 3D one on `three` via `@react-three/fiber`. Selecting a
  node highlights its relationships, opens type details, and scrolls the editor
  to its declaration.
- **Diagnostics** — Roslyn's own diagnostics. Selecting one scrolls the editor
  to the offending line.
- **Explain** — the question box and per-node explanations, with optional
  narration.

Hover emphasis in both graph views is deliberately damped by a short grace
period (`useStableHover`). Without it, crossing the board means repeatedly
passing over empty space, and the whole scene flashes between emphasised and
not, which reads as blinking.

There is no frontend test suite; UI changes are verified by running the app.

## Deployment

The frontend is static and goes to any static host (Vercel). The API needs a
container host that can run .NET (Render). Both are required — the frontend
cannot analyze anything on its own.

```
Dockerfile        multi-stage build, API only
.dockerignore
render.yaml       Render blueprint (region/name must match your service)
```

Order matters, because each side needs the other's URL:

1. Deploy the API. Note its URL.
2. Deploy the frontend with `VITE_API_URL` set to that URL.
3. Set `CORS_ORIGINS` on the API to the frontend's URL and restart it.

Two things to expect:

- **`VITE_API_URL` is baked in at build time.** Setting it after the first
  build does nothing until you redeploy the frontend.
- **Free-tier hosts spin down after inactivity**, so the first request after a
  pause takes ~30s to wake the API.

## Design decisions

**The API is stateless.** It originally kept analyses in an in-memory cache and
looked them up by id. That doesn't survive a host that recycles the process —
and free tiers spin down, so the cache was gone precisely when the next request
arrived. Endpoints now take the analysis they need in the request body.

Answering from the source instead was considered and rejected: every id is
assigned with `Guid.NewGuid()` at construction, so re-analyzing the same source
yields different ids, and a node reference from the client would never resolve.
The analysis is also not the source — it is the derived model, and the model is
what the questions are about.

**Structure is never model-generated.** The AI produces prose and names; the
focus nodes and concepts are matched back against the analysis and dropped if
they don't correspond to something real. This keeps the graph honest even when
the model is wrong.

**Providers degrade rather than fail.** Missing keys select a working local
implementation at startup, so the app is fully functional with no vendor
accounts. `/api/capabilities` tells the frontend which mode it's in.

## Known limitations

- An unknown `nodeId` is answered rather than rejected — the explainer falls
  back instead of returning `404`, so a bad selection gets a confident answer
  about something else.
- The 3D graph frames the camera without members, so expanding a type orbits
  its members in from outside the initial view.
- Roslyn compilation is memory-hungry; very large sources are tight on a
  512 MB host.
