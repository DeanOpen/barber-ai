"use client";

import {
  ArrowLeftOutlined,
  ArrowRightOutlined,
  CheckCircleFilled,
  CloseCircleFilled,
  DownloadOutlined,
  HistoryOutlined,
  LoadingOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
  SafetyOutlined,
  ScissorOutlined,
  SearchOutlined,
  SettingOutlined,
  UserOutlined,
  WarningFilled,
} from "@ant-design/icons";
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Image,
  Input,
  Progress,
  Row,
  Space,
  Steps,
  Tag,
  Typography,
} from "antd";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import FaceCapture from "./components/FaceCapture";
import PhotoCard from "./components/PhotoCard";
import ShowcaseHistory from "./components/ShowcaseHistory";
import ShowcaseSetup, {
  readByokConfig,
  writeByokConfig,
  clearByokConfig,
} from "./components/ShowcaseSetup";
import Slideshow from "./components/Slideshow";
import { PUBLIC_DEFAULTS } from "@/lib/defaults";
import { IS_SHOWCASE } from "@/lib/showcase";
import {
  buildInitialItems,
  runClientJob,
  type ClientByokConfig,
  type ClientItem,
} from "@/lib/client-generate";
import {
  entrySignature,
  readShowcaseHistory,
  upsertShowcaseHistory,
  type ShowcaseHistoryEntry,
} from "@/lib/showcase-history";

type Gender = "man" | "woman" | "kid";
type Hairstyle = { name: string; description: string; imageUrl?: string; section?: string };
type ItemStatus = "pending" | "running" | "done" | "failed";
type ItemKind = "single" | "grid";
type JobItem = {
  name: string;
  description: string;
  status: ItemStatus;
  b64?: string | null;
  error?: string;
  kind?: ItemKind;
  gridStyles?: { name: string; description: string }[];
};
type GenerationMode = "individual" | "grid";
type JobShape = {
  id: string;
  gender: Gender;
  mode?: GenerationMode;
  picks?: { name: string; description: string }[];
  items: JobItem[];
  done: boolean;
};
type SseEvent =
  | { type: "snapshot"; job: JobShape }
  | { type: "item"; index: number; item: JobItem }
  | { type: "done"; job: JobShape }
  | { type: "ping" };
type ConnState = "idle" | "connecting" | "live" | "reconnecting" | "lost";

type Status = {
  configured: boolean;
  mode: GenerationMode;
  imageCount: number;
  categoryImages: Record<Gender, string>;
  prompts: Record<Gender, Hairstyle[]>;
};

type Customer = {
  id: string;
  name: string;
  gender: Gender | null;
  selected: string[];
  file: File | null;
  preview: string | null;
  job: JobShape | null;
  step: number;
  submitting: boolean;
  connection: ConnState;
};

type StoredCustomer = { id: string; name: string; jobId: string };

const MAX_PICKS_INDIVIDUAL = 6;
const MAX_PICKS_GRID = 12;
const MAX_DETAILS = 4;
// Wall-clock estimate per image. The provider call is opaque - we can't poll
// real progress, so we drive a determinate bar from this number and flip the
// label once we cross it instead of letting the bar pin at 100%.
const EXPECTED_RENDER_MS = 260_000;
const STEP_LABELS = ["Who", "Styles", "Face", "Lookbook"];
const CUSTOMERS_KEY = "barber.customers.v2";

// In PUBLIC_SHOWCASE mode there's no /api/status round trip - we hydrate from
// the same defaults the server would have surfaced and decide "configured" by
// looking at the BYOK key the user has stored locally.
const SHOWCASE_BASE_STATUS: Status = {
  configured: false,
  mode: "grid",
  imageCount: PUBLIC_DEFAULTS.imageCount,
  categoryImages: PUBLIC_DEFAULTS.categoryImages,
  prompts: PUBLIC_DEFAULTS.prompts,
};

function newLocalJobId(): string {
  return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

const { Title, Paragraph, Text } = Typography;

const GENDERS: { id: Gender; label: string; subtitle: string; emoji: string }[] = [
  { id: "man", label: "Men", subtitle: "Cuts, fades, beards", emoji: "💈" },
  { id: "woman", label: "Women", subtitle: "Length, layers, color", emoji: "💁‍♀️" },
  { id: "kid", label: "Kids", subtitle: "Quick, fun, friendly", emoji: "🧒" },
];

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizeSearchText(value: string): string {
  return value.trim().toLowerCase();
}

function newCustomerId() {
  return `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function makeCustomer(name: string, id: string = newCustomerId()): Customer {
  return {
    id,
    name,
    gender: null,
    selected: [],
    file: null,
    preview: null,
    job: null,
    step: 0,
    submitting: false,
    connection: "idle",
  };
}

function nextCustomerName(customers: Customer[]): string {
  const used = new Set(customers.map((c) => c.name));
  for (let i = 1; i <= 999; i++) {
    const candidate = `Customer ${i}`;
    if (!used.has(candidate)) return candidate;
  }
  return `Customer ${customers.length + 1}`;
}

export default function Home() {
  const { message } = App.useApp();
  const [status, setStatus] = useState<Status | null>(
    IS_SHOWCASE ? SHOWCASE_BASE_STATUS : null,
  );

  // PUBLIC_SHOWCASE: client-only BYOK state. The server never sees the key.
  const [byokConfig, setByokConfig] = useState<ClientByokConfig | null>(null);
  const [setupOpen, setSetupOpen] = useState(false);
  const byokConfigRef = useRef<ClientByokConfig | null>(null);
  byokConfigRef.current = byokConfig;
  const clientAbortsRef = useRef<Map<string, AbortController>>(new Map());

  // PUBLIC_SHOWCASE: localStorage-backed history of past previews. Saved
  // alongside the input data URL so visitors can revisit, present, and
  // re-download without re-running generation.
  const [history, setHistory] = useState<ShowcaseHistoryEntry[]>([]);
  const historyRef = useRef<ShowcaseHistoryEntry[]>(history);
  historyRef.current = history;
  const [historyOpen, setHistoryOpen] = useState(false);
  // Snapshot of the input data URL captured at submit-time, keyed by job id.
  // Customer state can be wiped (Start over, removed tab) but the history
  // entry must keep the photo it was generated against.
  const jobInputUrlRef = useRef<Map<string, string>>(new Map());
  // Last-saved item signature per job id - lets us skip redundant writes when
  // React re-renders without any meaningful job change.
  const savedSignatureRef = useRef<Map<string, string>>(new Map());

  // Use a deterministic id for the first customer so SSR and client first
  // render match - Date.now()/Math.random() in render would break hydration.
  const initialCustomerRef = useRef<Customer>(makeCustomer("Customer 1", "customer-1"));
  const [customers, setCustomers] = useState<Customer[]>(() => [initialCustomerRef.current]);
  const [activeId, setActiveId] = useState<string>(() => initialCustomerRef.current.id);

  const [slideOpen, setSlideOpen] = useState(false);
  const [slideStart, setSlideStart] = useState(0);

  const customersRef = useRef<Customer[]>(customers);
  customersRef.current = customers;

  const streamsRef = useRef<
    Map<
      string,
      { es: EventSource; timer: ReturnType<typeof setTimeout> | null; attempts: number }
    >
  >(new Map());

  const activeCustomer = useMemo(
    () => customers.find((c) => c.id === activeId) ?? customers[0],
    [customers, activeId],
  );

  useEffect(() => {
    if (IS_SHOWCASE) {
      const cfg = readByokConfig();
      setByokConfig(cfg);
      setStatus({
        ...SHOWCASE_BASE_STATUS,
        mode: cfg.mode,
        configured: Boolean(cfg.apiKey),
      });
      setHistory(readShowcaseHistory());
      return;
    }
    fetch("/api/status")
      .then((r) => r.json())
      .then((d: Status) => setStatus(d))
      .catch(() => setStatus({ configured: false } as Status));
  }, []);

  const patchCustomer = useCallback(
    (id: string, patch: Partial<Customer> | ((c: Customer) => Partial<Customer>)) => {
      setCustomers((prev) =>
        prev.map((c) => {
          if (c.id !== id) return c;
          const p = typeof patch === "function" ? patch(c) : patch;
          return { ...c, ...p };
        }),
      );
    },
    [],
  );

  const patchJob = useCallback((id: string, mutator: (job: JobShape) => JobShape) => {
    setCustomers((prev) =>
      prev.map((c) => {
        if (c.id !== id || !c.job) return c;
        return { ...c, job: mutator(c.job) };
      }),
    );
  }, []);

  const closeStream = useCallback((customerId: string) => {
    const s = streamsRef.current.get(customerId);
    if (!s) return;
    s.es.close();
    if (s.timer) clearTimeout(s.timer);
    streamsRef.current.delete(customerId);
  }, []);

  const openStream = useCallback(
    (customerId: string, jobId: string) => {
      closeStream(customerId);
      patchCustomer(customerId, (c) => ({
        connection: c.connection === "lost" ? "reconnecting" : "connecting",
      }));

      const es = new EventSource(`/api/generate/${jobId}/stream`);
      const entry = {
        es,
        timer: null as null | ReturnType<typeof setTimeout>,
        attempts: 0,
      };
      streamsRef.current.set(customerId, entry);

      es.onopen = () => {
        entry.attempts = 0;
        patchCustomer(customerId, { connection: "live" });
      };

      es.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data) as SseEvent;
          if (data.type === "ping") return;
          if (data.type === "snapshot") {
            patchCustomer(customerId, { job: data.job, step: 3 });
            return;
          }
          if (data.type === "item") {
            patchJob(customerId, (job) => {
              const items = job.items.slice();
              items[data.index] = data.item;
              return { ...job, items };
            });
            return;
          }
          if (data.type === "done") {
            patchCustomer(customerId, { job: data.job, connection: "idle" });
          }
        } catch {
          // ignore malformed payloads
        }
      };

      es.onerror = () => {
        es.close();
        streamsRef.current.delete(customerId);
        const c = customersRef.current.find((c) => c.id === customerId);
        const j = c?.job;
        const stillWorking =
          !j || j.items.some((i) => i.status === "pending" || i.status === "running");
        if (!stillWorking) {
          patchCustomer(customerId, { connection: "idle" });
          return;
        }
        const attempt = entry.attempts + 1;
        entry.attempts = attempt;
        patchCustomer(customerId, {
          connection: attempt > 6 ? "lost" : "reconnecting",
        });
        const delayMs = Math.min(15_000, 500 * Math.pow(2, attempt));
        entry.timer = setTimeout(() => {
          const stillHere = customersRef.current.some(
            (c) => c.id === customerId && c.job?.id === jobId,
          );
          if (stillHere) openStream(customerId, jobId);
        }, delayMs);
        streamsRef.current.set(customerId, entry);
      };
    },
    [closeStream, patchCustomer, patchJob],
  );

  // Hydrate from localStorage on mount.
  useEffect(() => {
    if (typeof window === "undefined") return;
    // PUBLIC_SHOWCASE has no server jobs - nothing to resume across reloads.
    if (IS_SHOWCASE) return;
    const raw = window.localStorage.getItem(CUSTOMERS_KEY);
    if (!raw) return;
    let stored: StoredCustomer[] = [];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) stored = parsed;
    } catch {
      return;
    }
    if (stored.length === 0) return;
    let cancelled = false;
    (async () => {
      const valid: { stored: StoredCustomer; customer: Customer }[] = [];
      for (const s of stored) {
        if (!s.jobId) continue;
        try {
          const probe = await fetch(`/api/generate/${s.jobId}/stream`, {
            method: "HEAD",
          });
          if (probe.status === 404) continue;
        } catch {
          // try anyway
        }
        valid.push({
          stored: s,
          customer: {
            id: s.id,
            name: s.name,
            gender: null,
            selected: [],
            file: null,
            preview: null,
            job: null,
            step: 3,
            submitting: false,
            connection: "idle",
          },
        });
      }
      if (cancelled || valid.length === 0) return;
      setCustomers(valid.map((v) => v.customer));
      setActiveId(valid[0].customer.id);
      // Fire streams once state is committed.
      queueMicrotask(() => {
        valid.forEach(({ stored, customer }) => {
          openStream(customer.id, stored.jobId);
        });
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [openStream]);

  // Persist active jobs to localStorage.
  useEffect(() => {
    if (typeof window === "undefined") return;
    // Showcase has no server jobIds, so there's nothing to persist (and we
    // never want to leave references that 404 against the server).
    if (IS_SHOWCASE) return;
    const compact: StoredCustomer[] = customers
      .filter((c) => c.job?.id)
      .map((c) => ({ id: c.id, name: c.name, jobId: c.job!.id }));
    if (compact.length === 0) {
      window.localStorage.removeItem(CUSTOMERS_KEY);
    } else {
      window.localStorage.setItem(CUSTOMERS_KEY, JSON.stringify(compact));
    }
  }, [customers]);

  // Cleanup all streams on unmount.
  useEffect(
    () => () => {
      streamsRef.current.forEach((s) => {
        s.es.close();
        if (s.timer) clearTimeout(s.timer);
      });
      streamsRef.current.clear();
    },
    [],
  );

  // PUBLIC_SHOWCASE: upsert finished jobs into localStorage history. Triggers
  // on the initial completion AND on any retry that mutates an item, so the
  // history reflects the latest state of every preview. Reads `history` via
  // ref to avoid re-running when our own setHistory call lands.
  useEffect(() => {
    if (!IS_SHOWCASE) return;
    let nextHistory: ShowcaseHistoryEntry[] | null = null;
    for (const c of customers) {
      const job = c.job;
      if (!job?.done) continue;
      const existing = historyRef.current.find((h) => h.id === job.id);
      const entry: ShowcaseHistoryEntry = {
        id: job.id,
        createdAt: existing?.createdAt ?? Date.now(),
        updatedAt: Date.now(),
        customerName: c.name,
        gender: job.gender,
        mode: job.mode === "grid" ? "grid" : "individual",
        inputDataUrl: jobInputUrlRef.current.get(job.id) ?? existing?.inputDataUrl ?? null,
        picksCount: job.picks?.length ?? job.items.length,
        items: job.items.map((it) => ({
          name: it.name,
          description: it.description,
          status: it.status,
          kind: it.kind ?? "single",
          b64: it.status === "done" ? (it.b64 ?? null) : null,
          error: it.error,
        })),
      };
      const sig = entrySignature(entry);
      if (savedSignatureRef.current.get(job.id) === sig) continue;
      savedSignatureRef.current.set(job.id, sig);
      nextHistory = upsertShowcaseHistory(entry);
    }
    if (nextHistory) setHistory(nextHistory);
  }, [customers]);

  const styleOptions: Hairstyle[] = useMemo(() => {
    if (!activeCustomer?.gender || !status?.prompts) return [];
    return status.prompts[activeCustomer.gender] ?? [];
  }, [activeCustomer?.gender, status?.prompts]);

  function addCustomer() {
    setCustomers((prev) => {
      const fresh = makeCustomer(nextCustomerName(prev));
      setActiveId(fresh.id);
      return [...prev, fresh];
    });
  }

  function abortClientJobsFor(customerId: string) {
    if (!IS_SHOWCASE) return;
    for (const [key, ctrl] of clientAbortsRef.current.entries()) {
      if (key === customerId || key.startsWith(`${customerId}:`)) {
        ctrl.abort();
        clientAbortsRef.current.delete(key);
      }
    }
  }

  function removeCustomer(id: string) {
    closeStream(id);
    abortClientJobsFor(id);
    const idx = customers.findIndex((c) => c.id === id);
    const remaining = customers.filter((c) => c.id !== id);
    if (remaining.length === 0) {
      const fresh = makeCustomer("Customer 1");
      setCustomers([fresh]);
      setActiveId(fresh.id);
      return;
    }
    setCustomers(remaining);
    if (id === activeId) {
      const nextActive = remaining[Math.max(0, idx - 1)] ?? remaining[0];
      setActiveId(nextActive.id);
    }
  }

  function startOver(id: string) {
    closeStream(id);
    abortClientJobsFor(id);
    patchCustomer(id, {
      gender: null,
      selected: [],
      file: null,
      preview: null,
      job: null,
      step: 0,
      submitting: false,
      connection: "idle",
    });
  }

  const maxPicks =
    status?.mode === "grid" ? MAX_PICKS_GRID : MAX_PICKS_INDIVIDUAL;

  function toggleStyle(c: Customer, name: string) {
    if (c.selected.includes(name)) {
      patchCustomer(c.id, { selected: c.selected.filter((n) => n !== name) });
      return;
    }
    if (c.selected.length >= maxPicks) {
      message.info(`You can pick up to ${maxPicks} looks`);
      return;
    }
    patchCustomer(c.id, { selected: [...c.selected, name] });
  }

  // Updates a single item inside an active client-side job. Used by both the
  // initial showcase generation and the showcase retry flow.
  const patchClientItem = useCallback(
    (customerId: string, jobId: string, index: number, patch: Partial<ClientItem>) => {
      setCustomers((prev) =>
        prev.map((c) => {
          if (c.id !== customerId || !c.job || c.job.id !== jobId) return c;
          const items = c.job.items.slice();
          items[index] = { ...items[index], ...(patch as JobItem) };
          const allSettled = items.every(
            (i) => i.status === "done" || i.status === "failed",
          );
          return { ...c, job: { ...c.job, items, done: allSettled } };
        }),
      );
    },
    [],
  );

  async function generateShowcase(c: Customer) {
    const cfg = byokConfigRef.current;
    if (!cfg || !cfg.apiKey) {
      setSetupOpen(true);
      message.info("Add your API key first - it stays in your browser.");
      return;
    }
    if (!c.file || !c.gender) return;
    const picks = c.selected
      .map((name) => status?.prompts[c.gender as Gender]?.find((p) => p.name === name))
      .filter((x): x is Hairstyle => Boolean(x));
    if (picks.length === 0) {
      message.warning("Pick at least one hairstyle");
      return;
    }
    const jobId = newLocalJobId();
    const mode = cfg.mode === "grid" ? "grid" : "individual";
    const initialItems = buildInitialItems(picks, mode) as unknown as JobItem[];
    // Snapshot the input image once - the customer's preview can be cleared
    // while history needs to keep the photo this job ran against.
    if (c.preview) jobInputUrlRef.current.set(jobId, c.preview);
    patchCustomer(c.id, {
      submitting: true,
      job: {
        id: jobId,
        gender: c.gender,
        mode,
        picks: picks.map((p) => ({ name: p.name, description: p.description })),
        items: initialItems,
        done: false,
      },
      step: 3,
      connection: "live",
    });

    const controller = new AbortController();
    clientAbortsRef.current.set(c.id, controller);
    try {
      await runClientJob({
        config: { ...cfg, mode },
        gender: c.gender,
        picks,
        image: c.file,
        signal: controller.signal,
        onItem: (index, patch) => patchClientItem(c.id, jobId, index, patch),
      });
    } catch (err) {
      message.error(err instanceof Error ? err.message : String(err));
    } finally {
      clientAbortsRef.current.delete(c.id);
      patchCustomer(c.id, { submitting: false, connection: "idle" });
    }
  }

  async function generate(c: Customer) {
    if (!c.file || !c.gender) {
      message.warning("Pick a chair, styles, and add a photo first");
      return;
    }
    if (c.selected.length === 0) {
      message.warning("Pick at least one hairstyle");
      return;
    }
    if (IS_SHOWCASE) {
      await generateShowcase(c);
      return;
    }
    patchCustomer(c.id, { submitting: true });
    try {
      const fd = new FormData();
      fd.append("image", c.file);
      fd.append("gender", c.gender);
      c.selected.forEach((name) => fd.append("styles", name));
      const r = await fetch("/api/generate", { method: "POST", body: fd });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Generation failed");
      const jobId: string = data.jobId;
      patchCustomer(c.id, {
        job: {
          id: jobId,
          gender: c.gender,
          items: (data.items as JobItem[]) ?? [],
          done: false,
        },
        step: 3,
      });
      openStream(c.id, jobId);
    } catch (err) {
      message.error(err instanceof Error ? err.message : String(err));
    } finally {
      patchCustomer(c.id, { submitting: false });
    }
  }

  async function requestDetail(c: Customer, name: string) {
    if (IS_SHOWCASE) {
      message.info(
        "Detail renders aren't available in the public demo - re-run with this style picked.",
      );
      return;
    }
    if (!c.job) return;
    const detailCount = c.job.items.filter((i) => i.kind !== "grid").length;
    if (detailCount >= MAX_DETAILS) {
      message.info(`You can render up to ${MAX_DETAILS} detail looks per session`);
      return;
    }
    if (c.job.items.some((i) => i.kind !== "grid" && i.name === name)) {
      message.info("Already on the lookbook");
      return;
    }
    if (c.connection === "idle") openStream(c.id, c.job.id);
    try {
      const r = await fetch(`/api/generate/${c.job.id}/detail`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        throw new Error(data.error || "Detail render failed");
      }
    } catch (err) {
      message.error(err instanceof Error ? err.message : String(err));
    }
  }

  async function retry(c: Customer, name: string) {
    if (!c.job) return;
    if (IS_SHOWCASE) {
      const cfg = byokConfigRef.current;
      if (!cfg || !cfg.apiKey) {
        setSetupOpen(true);
        return;
      }
      if (!c.file || !c.gender) {
        message.error("Original photo is no longer available - start over.");
        return;
      }
      const idx = c.job.items.findIndex((i) => i.name === name);
      if (idx < 0) return;
      const target = c.job.items[idx];
      const jobId = c.job.id;
      patchClientItem(c.id, jobId, idx, {
        status: "running",
        error: undefined,
        b64: null,
      });
      const controller = new AbortController();
      clientAbortsRef.current.set(`${c.id}:${name}`, controller);
      try {
        await runClientJob({
          config: { ...cfg, mode: "individual" },
          gender: c.gender,
          picks: [{ name: target.name, description: target.description }],
          image: c.file,
          signal: controller.signal,
          onItem: (_, patch) => patchClientItem(c.id, jobId, idx, patch),
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        patchClientItem(c.id, jobId, idx, { status: "failed", error: msg, b64: null });
      } finally {
        clientAbortsRef.current.delete(`${c.id}:${name}`);
      }
      return;
    }
    patchJob(c.id, (job) => {
      const idx = job.items.findIndex((i) => i.name === name);
      if (idx < 0) return job;
      const items = job.items.slice();
      items[idx] = { ...items[idx], status: "running", error: undefined };
      return { ...job, items };
    });
    try {
      if (c.connection === "idle") openStream(c.id, c.job.id);
      const r = await fetch(`/api/generate/${c.job.id}/retry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        throw new Error(data.error || "Retry failed");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      message.error(msg);
      patchJob(c.id, (job) => {
        const idx = job.items.findIndex((i) => i.name === name);
        if (idx < 0) return job;
        const items = job.items.slice();
        items[idx] = { ...items[idx], status: "failed", error: msg };
        return { ...job, items };
      });
    }
  }

  function goBack(c: Customer) {
    if (c.step === 0) return;
    patchCustomer(c.id, { step: c.step - 1 });
  }

  function goNext(c: Customer) {
    if (c.step === 0) {
      if (!c.gender) {
        message.warning("Pick who's sitting in the chair");
        return;
      }
      patchCustomer(c.id, { step: 1 });
      return;
    }
    if (c.step === 1) {
      if (c.selected.length === 0) {
        message.warning("Pick at least one hairstyle");
        return;
      }
      patchCustomer(c.id, { step: 2 });
      return;
    }
    if (c.step === 2) {
      generate(c);
      return;
    }
  }

  function jumpToStep(c: Customer, target: number) {
    if (target === c.step) return;
    if (target === 1 && !c.gender) return;
    if (target === 2 && (!c.gender || c.selected.length === 0)) return;
    if (target === 3 && !c.job) return; // lookbook needs a job
    patchCustomer(c.id, { step: target });
  }

  const ac = activeCustomer;
  const items = ac?.job?.items ?? [];
  const total = items.length;
  const doneCount = items.filter((i) => i.status === "done").length;
  const failedCount = items.filter((i) => i.status === "failed").length;
  const inFlightCount = items.filter(
    (i) => i.status === "pending" || i.status === "running",
  ).length;
  const everythingSettled = total > 0 && inFlightCount === 0;

  const slides = items
    .filter((i) => i.status === "done" && i.b64)
    .map((i) => ({ name: i.name, description: i.description, b64: i.b64! }));

  return (
    <Space direction="vertical" size={24} style={{ width: "100%" }}>
      {/* Always render — previously this unmounted on first engagement,
          which jumped everything below up and read as a flick on mobile. */}
      <div className="kiosk-intro">
        <span className="kiosk-intro-label">Today at the chair</span>
        <span className="kiosk-intro-text">
          Pick a chair, choose a few looks, take a photo. Your stylist talks
          you through the rest.
        </span>
      </div>

      {IS_SHOWCASE && status?.configured === false && (
        <Alert
          type="info"
          showIcon
          icon={<SafetyOutlined />}
          message="Bring your own key to try the demo"
          description={
            <span>
              This is a public demo. Paste your OpenAI-compatible API key - it&apos;s stored
              only in this browser and sent <strong>directly</strong> to the provider you pick.
              Generation never goes through this site&apos;s server.
            </span>
          }
          action={
            <Space direction="vertical">
              <Button
                type="primary"
                icon={<SettingOutlined />}
                onClick={() => setSetupOpen(true)}
              >
                Add your API key
              </Button>
              {history.length > 0 && (
                <Button
                  icon={<HistoryOutlined />}
                  onClick={() => {
                    setHistory(readShowcaseHistory());
                    setHistoryOpen(true);
                  }}
                >
                  View past previews ({history.length})
                </Button>
              )}
            </Space>
          }
        />
      )}

      {IS_SHOWCASE && status?.configured && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: -8 }}>
          <Space size="small">
            <Tag icon={<SafetyOutlined />} color="success">
              Key in this browser only
            </Tag>
            <Button
              size="small"
              icon={<HistoryOutlined />}
              onClick={() => {
                setHistory(readShowcaseHistory());
                setHistoryOpen(true);
              }}
            >
              History
              {history.length > 0 ? ` (${history.length})` : ""}
            </Button>
            <Button
              size="small"
              icon={<SettingOutlined />}
              onClick={() => setSetupOpen(true)}
            >
              BYOK settings
            </Button>
            <Button
              size="small"
              danger
              type="text"
              onClick={() => {
                clearByokConfig();
                const fresh = readByokConfig();
                setByokConfig(fresh);
                setStatus((s) => (s ? { ...s, configured: false } : s));
                message.success("Cleared key from this browser");
              }}
            >
              Forget key
            </Button>
          </Space>
        </div>
      )}

      {!IS_SHOWCASE && status?.configured === false && (
        <Alert
          type="warning"
          showIcon
          message="Preview station offline"
          description={
            <span>
              The shop owner needs to finish setup in{" "}
              <a href="/admin">Shop admin</a> before previews can run.
            </span>
          }
        />
      )}

      {/* Custom tab strip — AntD's editable-card Tabs runs measurement JS on
          every layout change and visibly twitched on mobile when the active
          customer's badge width changed. Plain buttons stay still. */}
      <div className="customer-bar">
        <div className="customer-bar-row">
          {customers.map((c) => {
            const isActive = c.id === activeId;
            return (
              <div
                key={c.id}
                className={`customer-tab ${isActive ? "is-active" : ""}`}
              >
                <button
                  type="button"
                  className="customer-tab-main"
                  onClick={() => setActiveId(c.id)}
                  aria-pressed={isActive}
                >
                  <CustomerTabLabel customer={c} />
                </button>
                {customers.length > 1 && (
                  <button
                    type="button"
                    className="customer-tab-close"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeCustomer(c.id);
                    }}
                    aria-label={`Remove ${c.name}`}
                  >
                    ×
                  </button>
                )}
              </div>
            );
          })}
          <button
            type="button"
            className="customer-tab-add"
            onClick={addCustomer}
          >
            <PlusOutlined />
            <span>New customer</span>
          </button>
        </div>
      </div>

      {ac && (
        <div className="wizard-shell" key={ac.id}>
          <Steps
            current={ac.step}
            onChange={(target) => jumpToStep(ac, target)}
            items={STEP_LABELS.map((title, idx) => ({
              title,
              disabled:
                (idx === 1 && !ac.gender) ||
                (idx === 2 && (!ac.gender || ac.selected.length === 0)) ||
                (idx === 3 && !ac.job),
            }))}
          />

          <div className="wizard-pane">
            {ac.step === 0 && (
              <StepWho
                customer={ac}
                status={status}
                onPickGender={(g) => patchCustomer(ac.id, { gender: g, selected: [] })}
              />
            )}
            {ac.step === 1 && (
              <StepStyles
                customer={ac}
                styleOptions={styleOptions}
                maxPicks={maxPicks}
                mode={status?.mode ?? "individual"}
                onToggle={(name) => toggleStyle(ac, name)}
              />
            )}
            {ac.step === 2 && (
              <StepFace
                customer={ac}
                onChange={(file, preview) => patchCustomer(ac.id, { file, preview })}
              />
            )}
            {ac.step === 3 && ac.job && (
              <StepLookbook
                customer={ac}
                doneCount={doneCount}
                total={total}
                failedCount={failedCount}
                everythingSettled={everythingSettled}
                onRetry={(name) => retry(ac, name)}
                onDetail={(name) => requestDetail(ac, name)}
                onPresent={(idx) => {
                  setSlideStart(idx);
                  setSlideOpen(true);
                }}
                onReconnect={() => ac.job && openStream(ac.id, ac.job.id)}
              />
            )}
          </div>

          <div className="wizard-nav">
            <div>
              {ac.step > 0 && (
                <Button
                  size="large"
                  icon={<ArrowLeftOutlined />}
                  onClick={() => goBack(ac)}
                  disabled={ac.submitting}
                >
                  Back
                </Button>
              )}
            </div>
            <Space wrap>
              {(ac.gender || ac.selected.length > 0 || ac.file || ac.job) && (
                <Button
                  size="large"
                  onClick={() => startOver(ac.id)}
                  disabled={ac.submitting}
                >
                  Start over
                </Button>
              )}
              {ac.step < 3 && (
                <Button
                  type="primary"
                  size="large"
                  icon={
                    ac.step === 2 && !ac.job ? (
                      <ScissorOutlined />
                    ) : (
                      <ArrowRightOutlined />
                    )
                  }
                  loading={ac.submitting}
                  disabled={
                    status?.configured === false ||
                    (ac.step === 0 && !ac.gender) ||
                    (ac.step === 1 && ac.selected.length === 0) ||
                    (ac.step === 2 && !ac.file && !ac.job)
                  }
                  onClick={() => {
                    if (ac.step === 2 && ac.job) {
                      patchCustomer(ac.id, { step: 3 });
                      return;
                    }
                    goNext(ac);
                  }}
                >
                  {ac.step === 0 && "Next: pick styles"}
                  {ac.step === 1 && "Next: take photo"}
                  {ac.step === 2 &&
                    (ac.job
                      ? "Back to lookbook"
                      : ac.submitting
                        ? "Starting…"
                        : "Show me the cuts")}
                </Button>
              )}
              {ac.step === 3 && slides.length > 0 && (
                <Button
                  type="primary"
                  size="large"
                  icon={<PlayCircleOutlined />}
                  onClick={() => {
                    setSlideStart(0);
                    setSlideOpen(true);
                  }}
                >
                  Present to customer
                </Button>
              )}
            </Space>
          </div>
        </div>
      )}

      {slideOpen && slides.length > 0 && (
        <Slideshow
          slides={slides}
          startIndex={slideStart}
          onClose={() => setSlideOpen(false)}
        />
      )}

      {IS_SHOWCASE && byokConfig && (
        <ShowcaseSetup
          open={setupOpen}
          onClose={() => setSetupOpen(false)}
          initial={byokConfig}
          onSave={(cfg) => {
            writeByokConfig(cfg);
            setByokConfig(cfg);
            setStatus((s) =>
              s
                ? { ...s, mode: cfg.mode, configured: Boolean(cfg.apiKey) }
                : s,
            );
            message.success("Saved in this browser");
          }}
        />
      )}

      {IS_SHOWCASE && (
        <ShowcaseHistory
          open={historyOpen}
          onClose={() => setHistoryOpen(false)}
          entries={history}
          onChange={setHistory}
        />
      )}
    </Space>
  );
}

function CustomerTabLabel({ customer }: { customer: Customer }) {
  const total = customer.job?.items.length ?? 0;
  const done = customer.job?.items.filter((i) => i.status === "done").length ?? 0;
  const failed = customer.job?.items.filter((i) => i.status === "failed").length ?? 0;
  const inFlight = total - done - failed;

  let badgeText: string | null = null;
  let badgeTone: "info" | "warn" | "ok" | "neutral" = "neutral";
  if (total > 0) {
    if (inFlight > 0) {
      badgeText = `${done}/${total}`;
      badgeTone = "info";
    } else if (failed > 0) {
      badgeText = `${done}/${total}`;
      badgeTone = "warn";
    } else {
      badgeText = "Ready";
      badgeTone = "ok";
    }
  } else if (customer.gender || customer.selected.length > 0 || customer.file) {
    badgeText = `Step ${Math.min(customer.step + 1, 3)}/3`;
    badgeTone = "neutral";
  }

  return (
    <span className="customer-tab-label">
      <UserOutlined />
      <span>{customer.name}</span>
      {/* Plain span instead of <Tag> — AntD Tag injects CSS-in-JS on first
          mount, which caused a reflow flick on the kiosk when the badge
          appeared right after gender selection. */}
      <span
        className={`customer-tab-badge tone-${badgeTone}`}
        data-empty={badgeText ? "false" : "true"}
        aria-hidden={!badgeText}
      >
        {badgeText ?? ""}
      </span>
    </span>
  );
}

function StepWho({
  customer,
  status,
  onPickGender,
}: {
  customer: Customer;
  status: Status | null;
  onPickGender: (g: Gender) => void;
}) {
  return (
    <section>
      <Title level={3} style={{ margin: "0 0 4px" }}>
        Who&apos;s in the chair?
      </Title>
      <Paragraph type="secondary" style={{ marginTop: 0 }}>
        Pick one to load the matching style menu.
      </Paragraph>
      <Row gutter={[12, 12]}>
        {GENDERS.map((g) => (
          <Col xs={12} sm={8} key={g.id}>
            <PhotoCard
              imageUrl={status?.categoryImages?.[g.id]}
              fallbackEmoji={g.emoji}
              title={g.label}
              subtitle={g.subtitle}
              selected={customer.gender === g.id}
              onSelect={() => onPickGender(g.id)}
            />
          </Col>
        ))}
      </Row>
    </section>
  );
}

function StepStyles({
  customer,
  styleOptions,
  maxPicks,
  mode,
  onToggle,
}: {
  customer: Customer;
  styleOptions: Hairstyle[];
  maxPicks: number;
  mode: GenerationMode;
  onToggle: (name: string) => void;
}) {
  const [brokenStyleImages, setBrokenStyleImages] = useState<Record<string, true>>({});
  const [styleSearch, setStyleSearch] = useState("");

  if (styleOptions.length === 0) {
    return (
      <section>
        <Title level={3} style={{ margin: "0 0 4px" }}>
          Pick the looks
        </Title>
        <Alert
          type="info"
          showIcon
          message="No hairstyles configured"
          description="Ask the shop owner to add some in Shop admin."
        />
      </section>
    );
  }

  const searchText = normalizeSearchText(styleSearch);
  const filteredStyles = searchText
    ? styleOptions.filter((s) =>
        [s.name, s.description, s.section ?? ""].some((value) =>
          normalizeSearchText(value).includes(searchText),
        ),
      )
    : styleOptions;

  const groups = new Map<string, Hairstyle[]>();
  for (const s of filteredStyles) {
    const key = s.section?.trim() || "Other";
    const list = groups.get(key) ?? [];
    list.push(s);
    groups.set(key, list);
  }

  return (
    <section>
      <Title level={3} style={{ margin: "0 0 4px" }}>
        Pick the looks
      </Title>
      <Paragraph type="secondary" style={{ marginTop: 0 }}>
        {mode === "grid"
          ? `Up to ${maxPicks}. They render on one lookbook; pick a favorite later for full detail.`
          : `Up to ${maxPicks}. Each tick gets its own preview.`}{" "}
        <Tag color="gold" style={{ marginLeft: 4 }}>
          {customer.selected.length} selected
        </Tag>
      </Paragraph>
      <div className="style-search">
        <Input
          size="large"
          allowClear
          prefix={<SearchOutlined />}
          placeholder="Search styles"
          aria-label="Search hairstyles"
          value={styleSearch}
          onChange={(e) => setStyleSearch(e.target.value)}
        />
        <Text type="secondary" className="style-search-count">
          {filteredStyles.length}/{styleOptions.length} styles
        </Text>
      </div>
      <Space direction="vertical" size="large" style={{ width: "100%" }}>
        {filteredStyles.length === 0 ? (
          <div className="style-search-empty">
            <Text>No hairstyle matches &quot;{styleSearch.trim()}&quot;.</Text>
            <Button size="small" onClick={() => setStyleSearch("")}>
              Clear search
            </Button>
          </div>
        ) : (
          Array.from(groups.entries()).map(([section, items]) => (
            <div key={section}>
              <Title
                level={5}
                style={{
                  margin: "0 0 10px",
                  textTransform: "uppercase",
                  letterSpacing: 1,
                  color: "rgba(255,255,255,0.55)",
                  fontWeight: 600,
                  fontSize: 12,
                }}
              >
                {section}
              </Title>
              <Row gutter={[12, 12]}>
                {items.map((s) => {
                  const isOn = customer.selected.includes(s.name);
                  const initial = s.name.charAt(0).toUpperCase();
                  const styleImageKey = `${customer.gender ?? "unknown"}:${s.name}`;
                  const showStyleImage = Boolean(s.imageUrl) && !brokenStyleImages[styleImageKey];
                  return (
                    <Col xs={12} sm={8} md={6} key={s.name}>
                      <button
                        type="button"
                        onClick={() => onToggle(s.name)}
                        aria-pressed={isOn}
                        className={`style-card ${isOn ? "is-selected" : ""}`}
                      >
                        <div className="style-card-media">
                          {showStyleImage ? (
                            <>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={s.imageUrl}
                                alt={s.name}
                                loading="lazy"
                                onError={() =>
                                  setBrokenStyleImages((prev) =>
                                    prev[styleImageKey]
                                      ? prev
                                      : { ...prev, [styleImageKey]: true },
                                  )
                                }
                              />
                            </>
                          ) : (
                            <div className="style-card-placeholder" aria-hidden>
                              <span className="style-card-placeholder-icon">
                                <ScissorOutlined />
                              </span>
                              <span className="style-card-placeholder-letter">{initial}</span>
                            </div>
                          )}
                          <div className="style-card-shade" />
                          <span
                            className={`style-card-check ${isOn ? "is-on" : ""}`}
                            aria-hidden
                          >
                            {isOn ? <CheckCircleFilled /> : null}
                          </span>
                        </div>
                        <div className="style-card-body">
                          <div className="style-card-title">{s.name}</div>
                          <div className="style-card-desc">{s.description}</div>
                        </div>
                      </button>
                    </Col>
                  );
                })}
              </Row>
            </div>
          ))
        )}
      </Space>
    </section>
  );
}

function StepFace({
  customer,
  onChange,
}: {
  customer: Customer;
  onChange: (file: File | null, preview: string | null) => void;
}) {
  return (
    <section>
      <Title level={3} style={{ margin: "0 0 4px" }}>
        Photo of the client
      </Title>
      <Paragraph type="secondary" style={{ marginTop: 0 }}>
        Camera or upload. Face on, even lighting.
      </Paragraph>
      <Card>
        <Row gutter={[24, 24]} align="middle">
          <Col xs={24} md={14}>
            <FaceCapture
              value={customer.file}
              preview={customer.preview}
              onChange={(f, p) => onChange(f, p)}
            />
          </Col>
          <Col xs={24} md={10}>
            <Space direction="vertical" size="large" style={{ width: "100%" }}>
              <div>
                <Text strong>Ready to sketch</Text>
                <Paragraph type="secondary" style={{ marginTop: 4, marginBottom: 0 }}>
                  Generating {customer.selected.length}{" "}
                  {customer.selected.length === 1 ? "look" : "looks"} for{" "}
                  <strong>{customer.name}</strong>.
                </Paragraph>
              </div>
              <Paragraph type="secondary" style={{ margin: 0, fontSize: 12 }}>
                Tap <em>Show me the cuts</em> below to start. You can switch to another
                customer while this one renders.
              </Paragraph>
            </Space>
          </Col>
        </Row>
      </Card>
    </section>
  );
}

function StepLookbook({
  customer,
  doneCount,
  total,
  failedCount,
  everythingSettled,
  onRetry,
  onDetail,
  onPresent,
  onReconnect,
}: {
  customer: Customer;
  doneCount: number;
  total: number;
  failedCount: number;
  everythingSettled: boolean;
  onRetry: (name: string) => void;
  onDetail: (name: string) => void;
  onPresent: (slideIndex: number) => void;
  onReconnect: () => void;
}) {
  const items = customer.job?.items ?? [];
  const doneOrdered = items.filter((it) => it.status === "done" && it.b64);
  const gridItem = items.find((it) => it.kind === "grid");
  const detailItems = items.filter((it) => it.kind !== "grid");
  const detailNames = new Set(detailItems.map((it) => it.name));
  const detailInFlight = detailItems.filter(
    (it) => it.status === "pending" || it.status === "running",
  ).length;
  const detailDone = detailItems.filter((it) => it.status === "done").length;
  const detailLimitReached = detailItems.length >= MAX_DETAILS;
  const picks = customer.job?.picks ?? [];

  return (
    <section>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          margin: "0 0 4px",
        }}
      >
        <Title level={3} style={{ margin: 0 }}>
          Lookbook - {customer.name}
        </Title>
      </div>
      <Paragraph type="secondary" style={{ marginTop: 0 }}>
        {gridItem
          ? gridItem.status === "done"
            ? `Lookbook ready${detailDone > 0 ? ` · ${detailDone} detail render${detailDone === 1 ? "" : "s"}` : ""}${detailInFlight > 0 ? ` · ${detailInFlight} rendering` : ""}. Pick a favorite below for a full-resolution close-up.`
            : gridItem.status === "failed"
              ? "Grid render failed - tap retry to try again."
              : "Sketching all your looks on a single lookbook…"
          : everythingSettled
            ? failedCount > 0
              ? `${doneCount} ready, ${failedCount} failed - tap retry on any card to try again.`
              : "All looks are ready. Tap any card to enlarge or save."
            : `${doneCount} of ${total} ready - looks appear here as they finish.`}{" "}
        <ConnectionTag state={customer.connection} />
      </Paragraph>

      {gridItem && (
        <div style={{ marginBottom: 18 }}>
          <Image.PreviewGroup>
            <LookbookCard
              item={gridItem}
              index={0}
              wide
              onRetry={() => onRetry(gridItem.name)}
              onPresent={() => {
                const slideIndex = doneOrdered.findIndex(
                  (it) => it.name === gridItem.name,
                );
                onPresent(Math.max(0, slideIndex));
              }}
            />
          </Image.PreviewGroup>
        </div>
      )}

      {gridItem && picks.length > 0 && (
        <Card
          size="small"
          style={{ marginBottom: 18 }}
          title={
            <span>
              Pick a favorite for a full-detail render{" "}
              <Tag style={{ marginLeft: 6 }}>
                {detailItems.length}/{MAX_DETAILS} used
              </Tag>
            </span>
          }
        >
          <Paragraph type="secondary" style={{ marginTop: 0 }}>
            One API call already covered every style above. Tap a name to spend
            another credit on a high-resolution close-up of that style.
          </Paragraph>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {picks.map((p) => {
              const already = detailNames.has(p.name);
              const disabled =
                already ||
                detailLimitReached ||
                gridItem.status !== "done";
              return (
                <Button
                  key={p.name}
                  type={already ? "default" : "primary"}
                  ghost={!already}
                  size="middle"
                  disabled={disabled}
                  onClick={() => onDetail(p.name)}
                  icon={already ? <CheckCircleFilled /> : <ScissorOutlined />}
                >
                  {p.name}
                  {already ? " · added" : ""}
                </Button>
              );
            })}
          </div>
        </Card>
      )}

      {detailItems.length > 0 && (
        <Row gutter={[16, 16]}>
          <Image.PreviewGroup>
            {detailItems.map((r, i) => {
              const slideIndex = doneOrdered.findIndex((it) => it.name === r.name);
              return (
                <Col xs={12} md={8} key={`${r.name}-${i}`}>
                  <LookbookCard
                    item={r}
                    index={i}
                    onRetry={() => onRetry(r.name)}
                    onPresent={() => onPresent(Math.max(0, slideIndex))}
                  />
                </Col>
              );
            })}
          </Image.PreviewGroup>
        </Row>
      )}

      {!gridItem && (
        <Row gutter={[16, 16]}>
          <Image.PreviewGroup>
            {items.map((r, i) => {
              const slideIndex = doneOrdered.findIndex((it) => it.name === r.name);
              return (
                <Col xs={12} md={8} key={`${r.name}-${i}`}>
                  <LookbookCard
                    item={r}
                    index={i}
                    onRetry={() => onRetry(r.name)}
                    onPresent={() => onPresent(Math.max(0, slideIndex))}
                  />
                </Col>
              );
            })}
          </Image.PreviewGroup>
        </Row>
      )}

      {customer.connection === "lost" && (
        <Alert
          type="error"
          showIcon
          style={{ marginTop: 16 }}
          message="Lost connection to the kiosk"
          description="We're still trying to reconnect. Finished looks are kept on the server - reload this page if it stays stuck."
          action={
            <Button size="small" onClick={onReconnect}>
              Reconnect now
            </Button>
          }
        />
      )}
    </section>
  );
}

function ConnectionTag({ state }: { state: ConnState }) {
  if (state === "idle" || state === "live") return null;
  if (state === "connecting") return <Tag color="processing">Connecting…</Tag>;
  if (state === "reconnecting") return <Tag color="warning">Reconnecting…</Tag>;
  return <Tag color="error">Offline</Tag>;
}

function LookbookCard({
  item,
  index,
  wide,
  onRetry,
  onPresent,
}: {
  item: JobItem;
  index: number;
  wide?: boolean;
  onRetry: () => void;
  onPresent: () => void;
}) {
  const aspect = wide ? "3 / 2" : "1 / 1";

  // Anchor a start timestamp the moment this card observes "running" and tick
  // every second so the determinate Progress bar advances. Reset on any
  // non-running status so retries restart the estimate cleanly.
  const startedAtRef = useRef<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (item.status === "running") {
      if (startedAtRef.current === null) {
        startedAtRef.current = Date.now();
        setNow(Date.now());
      }
      const id = setInterval(() => setNow(Date.now()), 1000);
      return () => clearInterval(id);
    }
    startedAtRef.current = null;
  }, [item.status]);

  const elapsedMs =
    item.status === "running" && startedAtRef.current !== null
      ? Math.max(0, now - startedAtRef.current)
      : 0;
  const overTime = elapsedMs > EXPECTED_RENDER_MS;
  // Cap below 100 so we never imply completion before the image actually lands.
  const percent = Math.min(95, Math.round((elapsedMs / EXPECTED_RENDER_MS) * 100));

  const cover = (() => {
    if (item.status === "done" && item.b64) {
      return (
        <Image
          src={`data:image/png;base64,${item.b64}`}
          alt={item.name}
          style={{ aspectRatio: aspect, objectFit: wide ? "contain" : "cover", background: "#0f0f12" }}
        />
      );
    }
    if (item.status === "failed") {
      return (
        <div
          style={{
            aspectRatio: aspect,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            color: "#f87171",
            background: "#0f0f12",
            padding: 16,
            textAlign: "center",
          }}
        >
          <WarningFilled style={{ fontSize: 28 }} />
          <Text style={{ color: "#f87171", fontSize: 13 }}>
            {item.error || "This look failed"}
          </Text>
        </div>
      );
    }
    const isPending = item.status === "pending";
    const label = isPending
      ? "Queued…"
      : overTime
        ? "A little longer expected"
        : "Sketching…";
    return (
      <div
        style={{
          aspectRatio: aspect,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          background: "#0f0f12",
          color: "rgba(255,255,255,0.6)",
          padding: 16,
        }}
      >
        <LoadingOutlined style={{ fontSize: 28, color: "#f5b400" }} spin />
        <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 12 }}>{label}</Text>
        {!isPending && (
          <div style={{ width: "min(220px, 80%)" }}>
            <Progress
              percent={overTime ? 99 : percent}
              status="active"
              showInfo={false}
              strokeColor={overTime ? "#fa8c16" : "#f5b400"}
              trailColor="rgba(255,255,255,0.12)"
              size="small"
            />
          </div>
        )}
      </div>
    );
  })();

  const cardActions: React.ReactNode[] | undefined =
    item.status === "done" && item.b64
      ? [
          <a
            key="dl"
            href={`data:image/png;base64,${item.b64}`}
            download={`${slugify(item.name) || `look-${index + 1}`}.png`}
            onClick={(e) => e.stopPropagation()}
          >
            <DownloadOutlined /> Save
          </a>,
          <button
            key="present"
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onPresent();
            }}
            style={{
              background: "none",
              border: 0,
              color: "inherit",
              cursor: "pointer",
              font: "inherit",
            }}
          >
            <PlayCircleOutlined /> Present
          </button>,
        ]
      : item.status === "failed"
        ? [
            <Button
              key="retry"
              type="link"
              icon={<ReloadOutlined />}
              onClick={onRetry}
              style={{ padding: 0 }}
            >
              Retry
            </Button>,
          ]
        : undefined;

  return (
    <Card
      className="lookbook-card"
      styles={{ body: { padding: 14 } }}
      cover={cover}
      actions={cardActions}
    >
      <Card.Meta
        avatar={<StatusIcon status={item.status} />}
        title={item.name}
        description={
          <span style={{ fontSize: 12, color: "var(--muted)" }}>{item.description}</span>
        }
      />
    </Card>
  );
}

function StatusIcon({ status }: { status: ItemStatus }) {
  if (status === "done")
    return <CheckCircleFilled style={{ color: "#52c41a", fontSize: 18 }} />;
  if (status === "failed")
    return <CloseCircleFilled style={{ color: "#f5222d", fontSize: 18 }} />;
  return <LoadingOutlined style={{ color: "#f5b400", fontSize: 18 }} spin />;
}

