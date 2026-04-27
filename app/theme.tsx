"use client";

import "@ant-design/v5-patch-for-react-19";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { App as AntdApp, ConfigProvider, theme } from "antd";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type Mode = "light" | "dark";
type Choice = Mode | "system";

type ThemeCtx = {
  choice: Choice;
  resolved: Mode;
  setChoice: (m: Choice) => void;
};

const Ctx = createContext<ThemeCtx | null>(null);
const STORAGE_KEY = "barber-theme";

export function useThemeMode(): ThemeCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useThemeMode must be used inside ThemeProvider");
  return v;
}

function readStoredChoice(): Choice {
  if (typeof window === "undefined") return "system";
  const v = window.localStorage.getItem(STORAGE_KEY);
  return v === "light" || v === "dark" || v === "system" ? v : "system";
}

function systemPrefers(): Mode {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyDocumentTheme(resolved: Mode) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = resolved;
  document.documentElement.style.colorScheme = resolved;
}

const PALETTE = {
  dark: {
    bgBase: "#0f1418",
    bgContainer: "#161c22",
    bgElevated: "#1c242c",
    border: "#2a3540",
  },
  light: {
    bgBase: "#f2efe8",
    bgContainer: "#ffffff",
    bgElevated: "#fbf9f3",
    border: "#d9d3c6",
  },
} as const;

const COBALT = "#2f7fbf";
const COBALT_LIGHT = "#1f5f95";

export default function ThemeProvider({ children }: { children: ReactNode }) {
  const [choice, setChoiceState] = useState<Choice>("system");
  const [resolved, setResolved] = useState<Mode>("dark");

  useEffect(() => {
    const stored = readStoredChoice();
    setChoiceState(stored);
    const next: Mode = stored === "system" ? systemPrefers() : stored;
    setResolved(next);
    applyDocumentTheme(next);

    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystem = () => {
      if (readStoredChoice() !== "system") return;
      const r = systemPrefers();
      setResolved(r);
      applyDocumentTheme(r);
    };
    mql.addEventListener?.("change", onSystem);
    return () => mql.removeEventListener?.("change", onSystem);
  }, []);

  const setChoice = (m: Choice) => {
    setChoiceState(m);
    if (m === "system") window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, m);
    const r: Mode = m === "system" ? systemPrefers() : m;
    setResolved(r);
    applyDocumentTheme(r);
  };

  const ctx = useMemo<ThemeCtx>(
    () => ({ choice, resolved, setChoice }),
    [choice, resolved],
  );

  const palette = PALETTE[resolved];
  const primary = resolved === "dark" ? COBALT : COBALT_LIGHT;

  return (
    <AntdRegistry>
      <ConfigProvider
        theme={{
          algorithm:
            resolved === "dark" ? theme.darkAlgorithm : theme.defaultAlgorithm,
          token: {
            colorPrimary: primary,
            colorInfo: primary,
            colorBgBase: palette.bgBase,
            colorBgContainer: palette.bgContainer,
            colorBgElevated: palette.bgElevated,
            colorBorder: palette.border,
            borderRadius: 10,
            fontFamily:
              'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial',
          },
        }}
      >
        <Ctx.Provider value={ctx}>
          <AntdApp>{children}</AntdApp>
        </Ctx.Provider>
      </ConfigProvider>
    </AntdRegistry>
  );
}
