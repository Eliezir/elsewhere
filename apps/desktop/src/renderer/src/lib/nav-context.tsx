import { createContext, useContext } from "react";
import type { NavId } from "./nav";

const NavContext = createContext<(id: NavId) => void>(() => undefined);

export const NavProvider = NavContext.Provider;

export function useNavigate(): (id: NavId) => void {
  return useContext(NavContext);
}
