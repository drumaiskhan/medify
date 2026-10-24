import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { api } from "../lib/client";
import { applyPlanPrices } from "../data/plans";
const defaults = {
  siteName: "MEDIFY",
  tagline: "Your space to learn medicine.",
  logoUrl: "/assets/aistudio/logo_d0f8a6a4.png",
  accent: "#137c72",
  announcement: "",
  booksEnabled: true,
  registrationOpen: true,
  readerTheme: "light",
  supportEmail: "",
  contactLocation: "",
  founderName: "",
  footerDescription: "",
  footerCopyright: "",
  planPrices: { quarterly: 1000, "half-yearly": 2000, annual: 3500 } as Record<string,number>,
};
const SiteContext = createContext(defaults);
export function SiteProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState(defaults);
  useEffect(() => {
    api("/site-settings")
      .then((s) => {
        applyPlanPrices(s.planPrices);
        setSettings({ ...defaults, ...s });
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
