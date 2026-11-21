import { useContext } from "react";
import { NetworkStatusContext } from "../context/NetworkStatusContextValue";

export default function useNetworkStatus() {
  const context = useContext(NetworkStatusContext);
  if (!context) throw new Error("useNetworkStatus must be used inside NetworkStatusProvider");
  return context;
}
