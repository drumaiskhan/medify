import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { api } from "../lib/client";
import { applyPlanSettings } from "../data/plans";
const defaults = {
  siteName: "MEDIFY",
  tagline: "Your space to learn medicine.",
  logoUrl: "/assets/aistudio/logo_d0f8a6a4.png",
  accent: "#147273",
  announcement: "",
  booksEnabled: true,
  registrationOpen: true,
  readerTheme: "light",
  supportEmail: "",
  contactLocation: "",
  contactPhone: "",
  contactWhatsApp: "",
  contactWebsite: "",
  mcqAppUrl: "",
  founderName: "",
  footerDescription: "",
  footerCopyright: "",
  planPrices: { quarterly: 1000, "half-yearly": 2000, annual: 3500 } as Record<string,number>,
  planDetails: {} as Record<string, {name: string; billingText: string; features: string[]; recommended: boolean}>,
};
const SiteContext = createContext(defaults);
export function SiteProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState(defaults);
  useEffect(() => {
    api("/site-settings")
      .then((s) => {
        applyPlanSettings(s.planPrices, s.planDetails);
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
