import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { api } from "../lib/client";
const defaults = {
  siteName: "MEDIFY",
  tagline: "Your space to learn medicine.",
  accent: "#137c72",
  announcement: "",
  booksEnabled: true,
  registrationOpen: true,
  readerTheme: "light",
  supportEmail: "",
};
const SiteContext = createContext(defaults);
export function SiteProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState(defaults);
  useEffect(() => {
    api("/site-settings")
      .then((s) => {
        setSettings(s);
        document.documentElement.style.setProperty("--brand", s.accent);
        document.title = s.siteName + " — Your study space";
      })
      .catch(() => {});
  }, []);
  return (
    <SiteContext.Provider value={settings}>{children}</SiteContext.Provider>
  );
}
export const useSite = () => useContext(SiteContext);
