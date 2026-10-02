import { useEffect, useState } from "react";

import type { Capabilities } from "../types/analysis";
import { getCapabilities } from "../services/aiApi";

/**
 * What the server can do, read once at startup. Null means the check itself
 * failed, which callers must not confuse with a server reporting no provider.
 */
export function useCapabilities(): Capabilities | null {
  const [capabilities, setCapabilities] = useState<Capabilities | null>(null);

  useEffect(() => {
    let cancelled = false;

    getCapabilities()
      .then((next) => {
        if (!cancelled) {
          setCapabilities(next);
        }
      })
      .catch(() => {
        // Leave it null; the panel reports the failure when the user asks.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return capabilities;
}
