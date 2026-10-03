import { useCallback, useEffect, useRef, useState } from "react";

import { ApiError } from "../services/aiApi";
import { synthesize } from "../services/speechApi";

export type NarrationState = "idle" | "loading" | "speaking";

interface Narration {
  state: NarrationState;
  error: string;
  toggle: (text: string) => void;
  stop: () => void;
}

/**
 * Reads an explanation aloud, preferring the server's voice and dropping back to
 * the browser's when the server has no speech provider.
 */
export function useNarration(
  analysisId: string,
  speechConfigured: boolean,
): Narration {
  const [state, setState] = useState<NarrationState>("idle");
  const [error, setError] = useState("");

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);

  /** Stops playback and releases whatever the last utterance allocated. */
  const release = useCallback(() => {
    window.speechSynthesis?.cancel();

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
  }, []);

  // A new analysis is different code, so whatever was being read is now wrong.
  useEffect(() => {
    release();
    setState("idle");
    setError("");
  }, [analysisId, release]);

  useEffect(() => release, [release]);

  const speakLocally = useCallback((text: string) => {
    const synthesis = window.speechSynthesis;

    if (!synthesis) {
      setState("idle");
      setError("This browser cannot synthesize speech.");
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);

    utterance.onend = () => setState("idle");
    utterance.onerror = () => setState("idle");

    setState("speaking");
    synthesis.speak(utterance);
  }, []);

  const start = useCallback(
    async (text: string) => {
      if (!speechConfigured) {
        speakLocally(text);
        return;
      }

      setState("loading");
      setError("");

      try {
        const audio = await synthesize(analysisId, text);
        const url = URL.createObjectURL(audio);
        const element = new Audio(url);

        urlRef.current = url;
        audioRef.current = element;

        element.onended = () => {
          release();
          setState("idle");
        };

        element.onerror = () => {
          release();
          setState("idle");
          setError("The audio could not be played.");
        };

        await element.play();
        setState("speaking");
      } catch (cause) {
        // No provider, or the provider refused: the browser can still read it.
        if (cause instanceof ApiError && cause.status >= 502) {
          release();
          speakLocally(text);
          return;
        }

        release();
        setState("idle");
        setError(
          cause instanceof ApiError && cause.status === 429
            ? "Too many requests. The server allows 20 AI calls a minute — try again shortly."
            : cause instanceof Error
              ? cause.message
              : "Narration failed.",
        );
      }
    },
    [analysisId, release, speakLocally, speechConfigured],
  );

  const stop = useCallback(() => {
    release();
    setState("idle");
  }, [release]);

  const toggle = useCallback(
    (text: string) => {
      if (state !== "idle") {
        stop();
        return;
      }

      void start(text);
    },
    [start, state, stop],
  );

  return { state, error, toggle, stop };
}
