"use client";

import {
  DeleteOutlined,
  EyeOutlined,
  HistoryOutlined,
  LockOutlined,
  LogoutOutlined,
  PlusOutlined,
  ReloadOutlined,
  SaveOutlined,
} from "@ant-design/icons";
import {
  Alert,
  App,
  AutoComplete,
  Avatar,
  Button,
  Card,
  Col,
  Empty,
  Form,
  Image,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Row,
  Select,
  Skeleton,
  Slider,
  Space,
  Switch,
  Tabs,
  Tag,
  Typography,
} from "antd";
import Link from "next/link";
import { useEffect, useState } from "react";
import { HOST_PRESETS, MODEL_PRESETS } from "@/lib/model-presets";
import { IS_SHOWCASE } from "@/lib/showcase";

type Gender = "man" | "woman" | "kid";
type Hairstyle = { name: string; description: string; imageUrl?: string; section?: string };
type GenerationMode = "individual" | "grid";
type WatermarkPosition =
  | "bottom-right"
  | "bottom-left"
  | "top-right"
  | "top-left"
  | "bottom-center";
type Watermark = {
  enabled: boolean;
  text: string;
  position: WatermarkPosition;
  opacity: number;
  size: number;
  color: string;
};
type Settings = {
  apiKey: string;
  baseURL: string;
  model: string;
  mode: GenerationMode;
  imageCount: number;
  size: "1024x1024" | "1024x1536" | "1536x1024" | "auto";
  quality: "low" | "medium" | "high" | "auto";
  watermark: Watermark;
  adminPassword: string;
  prompts: Record<Gender, Hairstyle[]>;
  categoryImages: Record<Gender, string>;
};

const WATERMARK_DEFAULTS: Watermark = {
  enabled: true,
  text: "@deanopen",
  position: "bottom-right",
  opacity: 0.7,
  size: 0.035,
  color: "#ffffff",
};

type PromptField = "promptsMan" | "promptsWoman" | "promptsKid";

type FormShape = Omit<Settings, "prompts"> & Record<PromptField, Hairstyle[]>;

const PROMPT_GROUPS: { field: PromptField; label: string }[] = [
  { field: "promptsMan", label: "Hairstyles - Men" },
  { field: "promptsWoman", label: "Hairstyles - Women" },
  { field: "promptsKid", label: "Hairstyles - Kids" },
];

// API-key tab values cached in the browser so the operator never has to
// re-type them after a settings.json wipe or a fresh tablet setup.
const BYOK_CACHE_KEY = "barber.admin.byok.v1";

type ByokCache = Pick<
  Settings,
  "apiKey" | "baseURL" | "model" | "mode" | "imageCount" | "size" | "quality"
>;

function readByokCache(): Partial<ByokCache> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(BYOK_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ByokCache>;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function writeByokCache(values: ByokCache): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(BYOK_CACHE_KEY, JSON.stringify(values));
  } catch {
    // localStorage may be disabled / full - ignore.
  }
}

// Overlay any cached API-key tab values on top of what came from the server.
// The cache wins so the operator sees their last-typed key/host/model even
// if data/settings.json was wiped.
function mergeByokCache(s: Settings): Settings {
  const cache = readByokCache();
  if (!cache) return s;
  return {
    ...s,
    apiKey: typeof cache.apiKey === "string" && cache.apiKey ? cache.apiKey : s.apiKey,
    baseURL: typeof cache.baseURL === "string" ? cache.baseURL : s.baseURL,
    model: typeof cache.model === "string" && cache.model ? cache.model : s.model,
    mode: cache.mode === "grid" || cache.mode === "individual" ? cache.mode : s.mode,
    imageCount:
      typeof cache.imageCount === "number" && cache.imageCount > 0
        ? cache.imageCount
        : s.imageCount,
    size: cache.size ?? s.size,
    quality: cache.quality ?? s.quality,
  };
}

const { Title, Paragraph, Text } = Typography;

export default function AdminPage() {
  const { message } = App.useApp();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [initial, setInitial] = useState<FormShape | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (IS_SHOWCASE) {
      setAuthed(false);
      return;
    }
    fetch("/api/admin/settings")
      .then(async (r) => {
        if (!r.ok) {
          setAuthed(false);
          return;
        }
        const data: Settings = await r.json();
        setInitial(toForm(mergeByokCache(data)));
        setAuthed(true);
      })
      .catch(() => setAuthed(false));
  }, []);

  if (IS_SHOWCASE) {
    return (
      <div style={{ maxWidth: 520, margin: "0 auto" }}>
        <Card>
          <Typography.Title level={3} style={{ marginTop: 0 }}>
            Admin disabled
          </Typography.Title>
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            message="This is a public bring-your-own-key demo."
            description="There is no shop owner, no shared API key, and no server-side admin. Everything runs in your browser, and your key is stored only in your local storage."
          />
          <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
            Head back to the home page to paste your own OpenAI-compatible
            key and try the preview station.
          </Typography.Paragraph>
          <Link href="/">
            <Button type="primary">Go to the demo</Button>
          </Link>
        </Card>
      </div>
    );
  }

  async function login(values: { password: string }) {
    setLoginLoading(true);
    try {
      const r = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!r.ok) {
        message.error("Wrong password");
        return;
      }
      const s: Settings = await fetch("/api/admin/settings").then((x) => x.json());
      setInitial(toForm(mergeByokCache(s)));
      setAuthed(true);
      message.success("Welcome");
    } finally {
      setLoginLoading(false);
    }
  }

  async function logout() {
    await fetch("/api/admin/login", { method: "DELETE" });
    setInitial(null);
    setAuthed(false);
  }

  async function save(values: FormShape) {
    setSaving(true);
    try {
      const payload = fromForm(values);
      const r = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save");
      }
      writeByokCache({
        apiKey: payload.apiKey,
        baseURL: payload.baseURL,
        model: payload.model,
        mode: payload.mode,
        imageCount: payload.imageCount,
        size: payload.size,
        quality: payload.quality,
      });
      message.success("Settings saved");
    } catch (err) {
      message.error(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  if (authed === null) {
    return (
      <Card>
        <Skeleton active paragraph={{ rows: 6 }} />
      </Card>
    );
  }

  if (!authed) {
    return (
      <div style={{ maxWidth: 380, margin: "0 auto" }}>
        <Card>
          <Title level={3} style={{ marginTop: 0 }}>
            Shop admin
          </Title>
          <Paragraph type="secondary">
            Sign in to manage the shop&apos;s OpenAI key, hairstyle prompts, and look-and-feel
            images.
          </Paragraph>
          <Form<{ password: string }>
            layout="vertical"
            onFinish={login}
            requiredMark={false}
          >
            <Form.Item
              name="password"
              label="Password"
              rules={[{ required: true, message: "Enter the admin password" }]}
            >
              <Input.Password
                prefix={<LockOutlined />}
                placeholder="Admin password"
                size="large"
              />
            </Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              size="large"
              block
              loading={loginLoading}
            >
              Sign in
            </Button>
          </Form>
          <Paragraph type="secondary" style={{ marginTop: 16, fontSize: 12 }}>
            First-run default password is <Text code>change-me</Text>. Change it after signing
            in.
          </Paragraph>
        </Card>
      </div>
    );
  }

  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <Row align="middle" justify="space-between">
        <Col>
          <Title level={2} style={{ margin: 0 }}>
            Shop admin
          </Title>
          <Paragraph type="secondary" style={{ margin: 0 }}>
            Set up your studio key, brand images, and the looks your shop offers. Previews stay
            offline until a key is set.
          </Paragraph>
        </Col>
        <Col>
          <Button icon={<LogoutOutlined />} onClick={logout}>
            Sign out
          </Button>
        </Col>
      </Row>

      <Form<FormShape>
        key={initial ? "settings-loaded" : "settings-empty"}
        layout="vertical"
        onFinish={save}
        requiredMark={false}
        initialValues={initial ?? undefined}
        onValuesChange={(_, all) => {
          // Persist API-key tab values on every keystroke so a reload or a
          // fresh tablet always brings them back without a server round-trip.
          writeByokCache({
            apiKey: all.apiKey ?? "",
            baseURL: all.baseURL ?? "",
            model: all.model ?? "",
            mode: all.mode === "grid" ? "grid" : "individual",
            imageCount: Number(all.imageCount) || 4,
            size: all.size,
            quality: all.quality,
          });
        }}
      >
        <Tabs
          defaultActiveKey="byok"
          items={[
            {
              key: "byok",
              label: "API key",
              children: (
                <Card>
                  <Form.Item
                    name="apiKey"
                    label="Studio key"
                    extra="Your OpenAI or OpenRouter API key. Stored on the server in data/settings.json. Until this is set, the preview station stays offline."
                    rules={[{ required: true, message: "A studio key is required" }]}
                  >
                    <Input.Password placeholder="sk-..." autoComplete="new-password" />
                  </Form.Item>
                  <Form.Item
                    name="baseURL"
                    label="API host (optional)"
                    extra="Pick a preset host or type any OpenAI-compatible base URL. Leave empty to use OpenAI directly."
                  >
                    <AutoComplete
                      placeholder="https://api.openai.com/v1"
                      options={HOST_PRESETS}
                      filterOption={(input, option) => {
                        const value = (option as { value?: string } | undefined)?.value;
                        return typeof value === "string"
                          ? value.toLowerCase().includes(input.toLowerCase())
                          : false;
                      }}
                      allowClear
                    />
                  </Form.Item>
                  <Form.Item
                    name="model"
                    label="Model"
                    extra="Pick a preset or type any model id. OpenAI models work directly; OpenRouter ids (provider/model) require the base URL above."
                    rules={[{ required: true, message: "Model is required" }]}
                  >
                    <AutoComplete
                      placeholder="openai/gpt-5-image"
                      options={MODEL_PRESETS}
                      filterOption={(input, option) => {
                        const value = (option as { value?: string } | undefined)?.value;
                        return typeof value === "string"
                          ? value.toLowerCase().includes(input.toLowerCase())
                          : false;
                      }}
                      allowClear
                    />
                  </Form.Item>
                  <Form.Item
                    name="mode"
                    label="Generation mode"
                    extra="Individual: one API call per hairstyle (high fidelity, higher cost). Grid: one API call returns a single labeled lookbook of all picks (cheaper); the customer can then pick 1–2 favorites for full-resolution detail renders."
                  >
                    <Select
                      options={[
                        { value: "individual", label: "Individual - one image per style" },
                        { value: "grid", label: "Grid - single composite lookbook (saves cost)" },
                      ]}
                    />
                  </Form.Item>
                  <Row gutter={16}>
                    <Col xs={24} md={8}>
                      <Form.Item name="imageCount" label="Default look count">
                        <InputNumber min={1} max={12} style={{ width: "100%" }} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={8}>
                      <Form.Item name="size" label="Size">
                        <Select
                          options={[
                            { value: "auto", label: "auto" },
                            { value: "1024x1024", label: "1024 × 1024" },
                            { value: "1024x1536", label: "1024 × 1536 (portrait)" },
                            { value: "1536x1024", label: "1536 × 1024 (landscape)" },
                          ]}
                        />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={8}>
                      <Form.Item name="quality" label="Quality">
                        <Select
                          options={[
                            { value: "auto", label: "auto" },
                            { value: "low", label: "low" },
                            { value: "medium", label: "medium" },
                            { value: "high", label: "high" },
                          ]}
                        />
                      </Form.Item>
                    </Col>
                  </Row>
                </Card>
              ),
            },
            {
              key: "watermark",
              label: "Watermark",
              children: (
                <Card>
                  <Paragraph type="secondary" style={{ marginTop: 0 }}>
                    A small text mark stamped onto every generated image (server-side).
                    Customers can&apos;t remove it without re-editing the photo.
                  </Paragraph>
                  <Row gutter={16}>
                    <Col xs={24} md={6}>
                      <Form.Item
                        name={["watermark", "enabled"]}
                        label="Enabled"
                        valuePropName="checked"
                      >
                        <Switch />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={10}>
                      <Form.Item
                        name={["watermark", "text"]}
                        label="Text"
                        extra="Shown verbatim on every image. Default: @deanopen"
                      >
                        <Input placeholder="@yourshop" />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={8}>
                      <Form.Item name={["watermark", "position"]} label="Position">
                        <Select
                          options={[
                            { value: "bottom-right", label: "Bottom right" },
                            { value: "bottom-left", label: "Bottom left" },
                            { value: "bottom-center", label: "Bottom center" },
                            { value: "top-right", label: "Top right" },
                            { value: "top-left", label: "Top left" },
                          ]}
                        />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Row gutter={16}>
                    <Col xs={24} md={8}>
                      <Form.Item
                        name={["watermark", "size"]}
                        label="Size (% of image width)"
                        extra="0.02 = tiny · 0.04 = small · 0.08 = bold"
                      >
                        <Slider min={0.015} max={0.1} step={0.005} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={8}>
                      <Form.Item name={["watermark", "opacity"]} label="Opacity">
                        <Slider min={0.1} max={1} step={0.05} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={8}>
                      <Form.Item
                        name={["watermark", "color"]}
                        label="Color"
                        extra="Any CSS color (e.g. #ffffff, #ff8a00, white)"
                      >
                        <Input placeholder="#ffffff" />
                      </Form.Item>
                    </Col>
                  </Row>
                </Card>
              ),
            },
            {
              key: "categories",
              label: "Categories",
              children: (
                <Card>
                  <Paragraph type="secondary">
                    Cover images shown on the home page for Men / Women / Kids. Use any public
                    image URL - the shop&apos;s own photos look best.
                  </Paragraph>
                  <Row gutter={16}>
                    {(["man", "woman", "kid"] as Gender[]).map((g) => (
                      <Col xs={24} md={8} key={g}>
                        <Form.Item
                          shouldUpdate
                          label={g.charAt(0).toUpperCase() + g.slice(1)}
                          style={{ marginBottom: 12 }}
                        >
                          {(form) => {
                            const url = form.getFieldValue([
                              "categoryImages",
                              g,
                            ]) as string | undefined;
                            return (
                              <Avatar
                                shape="square"
                                size={120}
                                src={url}
                                style={{ borderRadius: 12, background: "#1a1a1f" }}
                              >
                                {g[0].toUpperCase()}
                              </Avatar>
                            );
                          }}
                        </Form.Item>
                        <Form.Item name={["categoryImages", g]} label="Image URL">
                          <Input placeholder="https://..." />
                        </Form.Item>
                      </Col>
                    ))}
                  </Row>
                </Card>
              ),
            },
            {
              key: "prompts",
              label: "Hairstyle prompts",
              children: (
                <Space direction="vertical" size="large" style={{ width: "100%" }}>
                  {PROMPT_GROUPS.map(({ field, label }) => (
                    <Card key={field} title={label}>
                      <Paragraph type="secondary" style={{ marginTop: 0 }}>
                        Each row is one hairstyle. The station picks the requested number at
                        random for each preview.
                      </Paragraph>
                      <Form.List name={field}>
                        {(fields, { add, remove }) => (
                          <Space direction="vertical" size="small" style={{ width: "100%" }}>
                            {fields.map((f) => (
                              <Row key={f.key} gutter={12} align="top" wrap={false}>
                                <Col flex="0 0 76px">
                                  <Form.Item shouldUpdate style={{ marginBottom: 8 }}>
                                    {(form) => {
                                      const url = form.getFieldValue([
                                        field,
                                        f.name,
                                        "imageUrl",
                                      ]) as string | undefined;
                                      return (
                                        <Avatar
                                          shape="square"
                                          size={64}
                                          src={url}
                                          style={{
                                            borderRadius: 8,
                                            background: "#1a1a1f",
                                          }}
                                        >
                                          ✂︎
                                        </Avatar>
                                      );
                                    }}
                                  </Form.Item>
                                </Col>
                                <Col flex="0 0 200px">
                                  <Form.Item
                                    name={[f.name, "name"]}
                                    rules={[{ required: true, message: "Name required" }]}
                                    style={{ marginBottom: 8 }}
                                  >
                                    <Input placeholder="e.g. Korean Two-Block" />
                                  </Form.Item>
                                  <Form.Item
                                    name={[f.name, "section"]}
                                    style={{ marginBottom: 8 }}
                                  >
                                    <Input placeholder="Section (e.g. Modern Barbershop)" />
                                  </Form.Item>
                                  <Form.Item
                                    name={[f.name, "imageUrl"]}
                                    style={{ marginBottom: 8 }}
                                  >
                                    <Input placeholder="Reference image URL (optional)" />
                                  </Form.Item>
                                </Col>
                                <Col flex="auto">
                                  <Form.Item
                                    name={[f.name, "description"]}
                                    rules={[{ required: true, message: "Description required" }]}
                                    style={{ marginBottom: 8 }}
                                  >
                                    <Input.TextArea
                                      placeholder="Visual description sent to the model"
                                      autoSize={{ minRows: 2, maxRows: 4 }}
                                    />
                                  </Form.Item>
                                </Col>
                                <Col flex="0 0 auto">
                                  <Button
                                    danger
                                    type="text"
                                    icon={<DeleteOutlined />}
                                    onClick={() => remove(f.name)}
                                  />
                                </Col>
                              </Row>
                            ))}
                            <Button
                              type="dashed"
                              icon={<PlusOutlined />}
                              onClick={() =>
                                add({ name: "", description: "", section: "", imageUrl: "" })
                              }
                              block
                            >
                              Add hairstyle
                            </Button>
                          </Space>
                        )}
                      </Form.List>
                    </Card>
                  ))}
                </Space>
              ),
            },
            {
              key: "admin",
              label: "Password",
              children: (
                <Card>
                  <Form.Item
                    name="adminPassword"
                    label="Admin password"
                    extra="Used to access this page. Change it from the default."
                    rules={[{ required: true, message: "Password cannot be empty" }]}
                  >
                    <Input.Password autoComplete="new-password" />
                  </Form.Item>
                </Card>
              ),
            },
            {
              key: "history",
              label: "History",
              children: <HistoryPanel />,
            },
          ]}
        />

        <Form.Item style={{ marginTop: 24 }}>
          <Button
            type="primary"
            htmlType="submit"
            size="large"
            icon={<SaveOutlined />}
            loading={saving}
          >
            Save settings
          </Button>
        </Form.Item>
      </Form>
    </Space>
  );
}

function toForm(s: Settings): FormShape {
  return {
    apiKey: s.apiKey,
    baseURL: s.baseURL,
    model: s.model,
    mode: s.mode ?? "individual",
    imageCount: s.imageCount,
    size: s.size,
    quality: s.quality,
    watermark: { ...WATERMARK_DEFAULTS, ...(s.watermark ?? {}) },
    adminPassword: s.adminPassword,
    categoryImages: s.categoryImages,
    promptsMan: s.prompts.man,
    promptsWoman: s.prompts.woman,
    promptsKid: s.prompts.kid,
  };
}

function fromForm(v: FormShape): Settings {
  const clean = (rows: Hairstyle[] | undefined): Hairstyle[] =>
    (rows ?? [])
      .map((r) => {
        const name = (r?.name ?? "").trim();
        const description = (r?.description ?? "").trim();
        const imageUrl = (r?.imageUrl ?? "").trim();
        const section = (r?.section ?? "").trim();
        const out: Hairstyle = { name, description };
        if (imageUrl) out.imageUrl = imageUrl;
        if (section) out.section = section;
        return out;
      })
      .filter((r) => r.name && r.description);
  const wm = v.watermark ?? WATERMARK_DEFAULTS;
  return {
    apiKey: v.apiKey ?? "",
    baseURL: v.baseURL ?? "",
    model: v.model,
    mode: v.mode === "grid" ? "grid" : "individual",
    imageCount: Number(v.imageCount) || 4,
    size: v.size,
    quality: v.quality,
    watermark: {
      enabled: Boolean(wm.enabled),
      text: (wm.text ?? "").trim() || WATERMARK_DEFAULTS.text,
      position: wm.position ?? WATERMARK_DEFAULTS.position,
      opacity:
        typeof wm.opacity === "number" && wm.opacity >= 0 && wm.opacity <= 1
          ? wm.opacity
          : WATERMARK_DEFAULTS.opacity,
      size:
        typeof wm.size === "number" && wm.size > 0 && wm.size <= 0.2
          ? wm.size
          : WATERMARK_DEFAULTS.size,
      color: (wm.color ?? "").trim() || WATERMARK_DEFAULTS.color,
    },
    adminPassword: v.adminPassword,
    categoryImages: v.categoryImages,
    prompts: {
      man: clean(v.promptsMan),
      woman: clean(v.promptsWoman),
      kid: clean(v.promptsKid),
    },
  };
}

type HistoryItem = {
  index: number;
  name: string;
  description: string;
  status: "pending" | "running" | "done" | "failed";
  kind?: "single" | "grid";
  hasImage: boolean;
};

type HistoryEntry = {
  id: string;
  createdAt: number;
  updatedAt: number;
  gender: Gender;
  mode: GenerationMode;
  done: boolean;
  picksCount: number;
  hasInput: boolean;
  inputMime: string | null;
  totalCount: number;
  doneCount: number;
  failedCount: number;
  items: HistoryItem[];
};

function formatTimestamp(ts: number): string {
  if (!ts) return "-";
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return new Date(ts).toISOString();
  }
}

function HistoryPanel() {
  const { message } = App.useApp();
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/history");
      if (!r.ok) throw new Error("Failed to load history");
      const data = (await r.json()) as { entries: HistoryEntry[] };
      setEntries(data.entries);
    } catch (err) {
      message.error(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const removeEntry = async (id: string) => {
    try {
      const r = await fetch(`/api/admin/history/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error("Delete failed");
      setEntries((prev) => (prev ?? []).filter((e) => e.id !== id));
      message.success("Deleted");
    } catch (err) {
      message.error(err instanceof Error ? err.message : String(err));
    }
  };

  const opened = entries?.find((e) => e.id === openId) ?? null;

  return (
    <Card>
      <Row align="middle" justify="space-between" style={{ marginBottom: 12 }}>
        <Col>
          <Title level={4} style={{ margin: 0 }}>
            <HistoryOutlined /> Generated history
          </Title>
          <Paragraph type="secondary" style={{ margin: "4px 0 0", fontSize: 13 }}>
            Every customer photo and the previews we made for it are kept on the server for
            ~30 days. Open a card to inspect inputs and outputs, or delete entries you no
            longer need.
          </Paragraph>
        </Col>
        <Col>
          <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>
            Refresh
          </Button>
        </Col>
      </Row>

      {loading && entries === null ? (
        <Skeleton active paragraph={{ rows: 4 }} />
      ) : !entries || entries.length === 0 ? (
        <Empty description="No history yet" />
      ) : (
        <Row gutter={[12, 12]}>
          {entries.map((e) => (
            <Col xs={24} sm={12} md={8} lg={6} key={e.id}>
              <Card
                hoverable
                size="small"
                styles={{ body: { padding: 10 } }}
                cover={
                  e.hasInput ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/api/admin/history/${e.id}/input`}
                      alt="input"
                      style={{
                        width: "100%",
                        aspectRatio: "1 / 1",
                        objectFit: "cover",
                        background: "#0f0f12",
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        aspectRatio: "1 / 1",
                        background: "#0f0f12",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "rgba(255,255,255,0.4)",
                        fontSize: 12,
                      }}
                    >
                      no input
                    </div>
                  )
                }
                onClick={() => setOpenId(e.id)}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <Tag color="blue" style={{ marginRight: 0 }}>
                      {e.gender}
                    </Tag>
                    <Tag style={{ marginRight: 0 }}>{e.mode}</Tag>
                    {e.failedCount > 0 ? (
                      <Tag color="error" style={{ marginRight: 0 }}>
                        {e.doneCount}/{e.totalCount} · {e.failedCount} failed
                      </Tag>
                    ) : (
                      <Tag color="success" style={{ marginRight: 0 }}>
                        {e.doneCount}/{e.totalCount}
                      </Tag>
                    )}
                  </div>
                  <Text style={{ fontSize: 11, color: "rgba(255,255,255,0.55)" }}>
                    {formatTimestamp(e.createdAt)}
                  </Text>
                  <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                    <Button
                      size="small"
                      icon={<EyeOutlined />}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        setOpenId(e.id);
                      }}
                    >
                      Open
                    </Button>
                    <Popconfirm
                      title="Delete this entry?"
                      description="The customer photo and all generated previews will be removed."
                      okText="Delete"
                      okButtonProps={{ danger: true }}
                      onConfirm={(ev) => {
                        ev?.stopPropagation();
                        removeEntry(e.id);
                      }}
                      onCancel={(ev) => ev?.stopPropagation()}
                    >
                      <Button
                        size="small"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={(ev) => ev.stopPropagation()}
                      />
                    </Popconfirm>
                  </div>
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      )}

      <Modal
        open={Boolean(opened)}
        title={
          opened
            ? `${opened.gender} · ${opened.mode} · ${formatTimestamp(opened.createdAt)}`
            : ""
        }
        onCancel={() => setOpenId(null)}
        footer={null}
        width={960}
      >
        {opened && <HistoryDetail entry={opened} />}
      </Modal>
    </Card>
  );
}

function HistoryDetail({ entry }: { entry: HistoryEntry }) {
  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <div>
        <Title level={5} style={{ marginTop: 0 }}>
          Customer photo
        </Title>
        {entry.hasInput ? (
          <Image
            src={`/api/admin/history/${entry.id}/input`}
            alt="input"
            style={{
              maxWidth: 360,
              width: "100%",
              borderRadius: 12,
              background: "#0f0f12",
            }}
          />
        ) : (
          <Empty description="Input photo missing" />
        )}
      </div>
      <div>
        <Title level={5} style={{ margin: "0 0 8px" }}>
          Generated previews
        </Title>
        {entry.items.length === 0 ? (
          <Empty description="No items" />
        ) : (
          <Image.PreviewGroup>
            <Row gutter={[12, 12]}>
              {entry.items.map((it) => (
                <Col xs={12} md={8} key={`${it.index}-${it.name}`}>
                  <Card
                    size="small"
                    styles={{ body: { padding: 10 } }}
                    cover={
                      it.hasImage ? (
                        <Image
                          src={`/api/admin/history/${entry.id}/items/${it.index}`}
                          alt={it.name}
                          style={{
                            width: "100%",
                            aspectRatio: it.kind === "grid" ? "3 / 2" : "1 / 1",
                            objectFit: it.kind === "grid" ? "contain" : "cover",
                            background: "#0f0f12",
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            aspectRatio: "1 / 1",
                            background: "#0f0f12",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "rgba(255,255,255,0.45)",
                            fontSize: 12,
                            padding: 8,
                            textAlign: "center",
                          }}
                        >
                          {it.status === "failed" ? "failed" : it.status}
                        </div>
                      )
                    }
                  >
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <Text strong style={{ fontSize: 13 }}>
                        {it.name}
                      </Text>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {it.kind === "grid" && <Tag style={{ marginRight: 0 }}>grid</Tag>}
                        <Tag
                          color={
                            it.status === "done"
                              ? "success"
                              : it.status === "failed"
                                ? "error"
                                : "processing"
                          }
                          style={{ marginRight: 0 }}
                        >
                          {it.status}
                        </Tag>
                      </div>
                    </div>
                  </Card>
                </Col>
              ))}
            </Row>
          </Image.PreviewGroup>
        )}
      </div>
    </Space>
  );
}
