import type { BridgeRequest } from "./chain";
export function createPepeChainBridge(options: {
  standalone: (request: BridgeRequest) => Promise<unknown>;
  onPause?: () => void;
  onResume?: () => void;
  onInit?: (options: { preview: boolean }) => void;
}): {
  embedded: boolean;
  request: (request: BridgeRequest) => Promise<unknown>;
  destroy: () => void;
};
