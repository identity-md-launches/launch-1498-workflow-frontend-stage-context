import { createPepeChainBridge } from "./onchain-bridge";
import type { BridgeRequest } from "./chain";
// Register before React mounts: an opaque iframe host may send its only init at load.
export const hostSession = { ready: false, preview: false, paused: false };
const listeners = new Set<(event: "init" | "pause" | "resume") => void>();
let standalone: ((request: BridgeRequest) => Promise<unknown>) | undefined;
const emit = (event: "init" | "pause" | "resume") =>
  listeners.forEach((listener) => listener(event));
export const startupBridge = createPepeChainBridge({
  standalone: (request) => {
    if (!standalone) throw Error("Deployment is loading.");
    return standalone(request);
  },
  onInit: ({ preview }) => {
    hostSession.ready = true;
    hostSession.preview = preview;
    emit("init");
  },
  onPause: () => {
    hostSession.paused = true;
    emit("pause");
  },
  onResume: () => {
    hostSession.paused = false;
    emit("resume");
  },
});
export function bindBridge(
  adapter: (request: BridgeRequest) => Promise<unknown>,
  listener: (event: "init" | "pause" | "resume") => void,
) {
  standalone = adapter;
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    standalone = undefined;
  };
}
