"use client";

import { LockOutlined, SafetyOutlined } from "@ant-design/icons";
import {
  Alert,
  AutoComplete,
  Button,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Switch,
  Typography,
} from "antd";
import { useEffect } from "react";
import type { ClientByokConfig } from "@/lib/client-generate";
import { HOST_PRESETS, MODEL_PRESETS } from "@/lib/model-presets";

const { Paragraph, Text } = Typography;

export const SHOWCASE_BYOK_KEY = "barber.showcase.byok.v1";

export const SHOWCASE_DEFAULT_CONFIG: ClientByokConfig = {
  apiKey: "",
  // OpenRouter is the recommended default - broader model coverage, friendlier
  // CORS for browser BYOK.
  baseURL: "https://openrouter.ai/api/v1",
  model: "openai/gpt-5.4-image-2",
  size: "1024x1024",
  quality: "high",
  // Default to grid: a single composite image is much cheaper for the visitor
  // and feels closer to "one click → see everything".
  mode: "grid",
  watermark: {
    enabled: false,
    text: "@yourname",
    position: "bottom-right",
    opacity: 0.7,
    size: 0.035,
    color: "#ffffff",
  },
};

export function readByokConfig(): ClientByokConfig {
  if (typeof window === "undefined") return SHOWCASE_DEFAULT_CONFIG;
  try {
    const raw = window.localStorage.getItem(SHOWCASE_BYOK_KEY);
    if (!raw) return SHOWCASE_DEFAULT_CONFIG;
    const parsed = JSON.parse(raw) as Partial<ClientByokConfig>;
    return mergeConfig(parsed);
  } catch {
    return SHOWCASE_DEFAULT_CONFIG;
  }
}

export function writeByokConfig(cfg: ClientByokConfig): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SHOWCASE_BYOK_KEY, JSON.stringify(cfg));
  } catch {
    // localStorage may be disabled / full - ignore.
  }
}

export function clearByokConfig(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(SHOWCASE_BYOK_KEY);
  } catch {
    // ignore
  }
}

function mergeConfig(p: Partial<ClientByokConfig>): ClientByokConfig {
  const wm = (p.watermark ?? {}) as Partial<ClientByokConfig["watermark"]>;
  return {
    apiKey: typeof p.apiKey === "string" ? p.apiKey : "",
    baseURL: typeof p.baseURL === "string" ? p.baseURL : "",
    model: typeof p.model === "string" && p.model ? p.model : SHOWCASE_DEFAULT_CONFIG.model,
    size:
      p.size === "auto" || p.size === "1024x1024" ||
      p.size === "1024x1536" || p.size === "1536x1024"
        ? p.size
        : SHOWCASE_DEFAULT_CONFIG.size,
    quality:
      p.quality === "auto" || p.quality === "low" ||
      p.quality === "medium" || p.quality === "high"
        ? p.quality
        : SHOWCASE_DEFAULT_CONFIG.quality,
    mode: p.mode === "individual" ? "individual" : "grid",
    watermark: {
      enabled: typeof wm.enabled === "boolean" ? wm.enabled : false,
      text: typeof wm.text === "string" && wm.text.trim() ? wm.text : SHOWCASE_DEFAULT_CONFIG.watermark.text,
      position:
        wm.position === "bottom-left" || wm.position === "top-right" ||
        wm.position === "top-left" || wm.position === "bottom-center" ||
        wm.position === "bottom-right"
          ? wm.position
          : SHOWCASE_DEFAULT_CONFIG.watermark.position,
      opacity:
        typeof wm.opacity === "number" && wm.opacity >= 0 && wm.opacity <= 1
          ? wm.opacity
          : SHOWCASE_DEFAULT_CONFIG.watermark.opacity,
      size:
        typeof wm.size === "number" && wm.size > 0 && wm.size <= 0.2
          ? wm.size
          : SHOWCASE_DEFAULT_CONFIG.watermark.size,
      color:
        typeof wm.color === "string" && wm.color.trim()
          ? wm.color
          : SHOWCASE_DEFAULT_CONFIG.watermark.color,
    },
  };
}

type Props = {
  open: boolean;
  onClose: () => void;
  initial: ClientByokConfig;
  onSave: (cfg: ClientByokConfig) => void;
};

export default function ShowcaseSetup({ open, onClose, initial, onSave }: Props) {
  const [form] = Form.useForm<ClientByokConfig>();

  useEffect(() => {
    if (open) form.setFieldsValue(initial);
  }, [open, initial, form]);

  const handleFinish = (values: ClientByokConfig) => {
    const merged = mergeConfig({ ...initial, ...values, watermark: { ...initial.watermark, ...(values.watermark || {}) } });
    onSave(merged);
    onClose();
  };

  return (
    <Modal
      title={
        <Space>
          <SafetyOutlined />
          Bring-your-own-key setup
        </Space>
      }
      open={open}
      onCancel={onClose}
      footer={null}
      width={640}
      destroyOnHidden
    >
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="Everything stays on this device"
        description={
          <span>
            Your API key is saved only in this browser&apos;s <Text code>localStorage</Text>{" "}
            and is sent <strong>directly</strong> to the provider you pick - it never goes to
            this site&apos;s server. Use a low-spend or scoped key when possible.
          </span>
        }
      />
      <Form<ClientByokConfig>
        form={form}
        layout="vertical"
        initialValues={initial}
        onFinish={handleFinish}
        requiredMark={false}
      >
        <Form.Item
          name="apiKey"
          label="API key"
          extra="An OpenAI or OpenAI-compatible key. Stored only in your browser."
          rules={[{ required: true, message: "An API key is required" }]}
        >
          <Input.Password
            prefix={<LockOutlined />}
            placeholder="sk-..."
            autoComplete="new-password"
            spellCheck={false}
          />
        </Form.Item>
        <Form.Item
          name="baseURL"
          label="API host (optional)"
          extra="Leave empty to use OpenAI directly. Set the host explicitly for OpenRouter, Together, etc."
        >
          <AutoComplete
            placeholder="https://openrouter.ai/api/v1"
            options={HOST_PRESETS}
            allowClear
            // Always surface every preset regardless of what's typed - the
            // user explicitly asked for "show all on click", not substring
            // filtering.
            filterOption={false}
          />
        </Form.Item>
        <Form.Item
          name="model"
          label="Model"
          extra="Pick a preset or type any image-generation model id."
          rules={[{ required: true, message: "Model is required" }]}
        >
          <AutoComplete
            placeholder="openai/gpt-5.4-image-2"
            options={MODEL_PRESETS}
            allowClear
            // Always show every preset; don't hide entries that don't match
            // what the user is currently typing.
            filterOption={false}
          />
        </Form.Item>
        <Space size="large" style={{ width: "100%" }} wrap>
          <Form.Item
            name="mode"
            label="Generation mode"
            style={{ minWidth: 260 }}
            extra="Grid: 1 API call → all picks on one composite image (cheap). Individual: 1 call per style (sharper, costs more)."
          >
            <Select
              options={[
                { value: "grid", label: "Grid - single composite (recommended)" },
                { value: "individual", label: "Individual - one image per style" },
              ]}
            />
          </Form.Item>
          <Form.Item name="size" label="Size" style={{ minWidth: 180 }}>
            <Select
              options={[
                { value: "auto", label: "auto" },
                { value: "1024x1024", label: "1024 × 1024" },
                { value: "1024x1536", label: "1024 × 1536 (portrait)" },
                { value: "1536x1024", label: "1536 × 1024 (landscape)" },
              ]}
            />
          </Form.Item>
          <Form.Item name="quality" label="Quality" style={{ minWidth: 160 }}>
            <Select
              options={[
                { value: "auto", label: "auto" },
                { value: "low", label: "low" },
                { value: "medium", label: "medium" },
                { value: "high", label: "high" },
              ]}
            />
          </Form.Item>
        </Space>

        <Paragraph type="secondary" style={{ marginTop: 6, marginBottom: 8 }}>
          <strong>Watermark</strong> - optional text stamped over each result by your browser.
        </Paragraph>
        <Space size="middle" wrap>
          <Form.Item
            name={["watermark", "enabled"]}
            label="Enabled"
            valuePropName="checked"
            style={{ minWidth: 120 }}
          >
            <Switch />
          </Form.Item>
          <Form.Item name={["watermark", "text"]} label="Text" style={{ minWidth: 220 }}>
            <Input placeholder="@yourname" />
          </Form.Item>
          <Form.Item name={["watermark", "position"]} label="Position" style={{ minWidth: 180 }}>
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
        </Space>

        <Paragraph type="secondary" style={{ fontSize: 12, marginTop: 6 }}>
          OpenAI blocks direct browser calls, so this app sends OpenAI requests through
          its same-origin generation proxy. Other compatible hosts may still call
          directly from the browser.
        </Paragraph>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="primary" htmlType="submit">
            Save in this browser
          </Button>
        </div>
      </Form>
    </Modal>
  );
}
