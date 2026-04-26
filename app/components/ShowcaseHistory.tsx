"use client";

import {
  ArrowLeftOutlined,
  ClearOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EyeOutlined,
  HistoryOutlined,
  PlayCircleOutlined,
} from "@ant-design/icons";
import {
  App,
  Button,
  Card,
  Col,
  Empty,
  Image,
  Modal,
  Popconfirm,
  Row,
  Space,
  Tag,
  Typography,
} from "antd";
import { useMemo, useState } from "react";
import {
  clearShowcaseHistory,
  removeShowcaseHistoryEntry,
  type ShowcaseHistoryEntry,
} from "@/lib/showcase-history";
import Slideshow from "./Slideshow";

const { Paragraph, Text, Title } = Typography;

type Props = {
  open: boolean;
  onClose: () => void;
  entries: ShowcaseHistoryEntry[];
  onChange: (next: ShowcaseHistoryEntry[]) => void;
};

function formatTimestamp(ts: number): string {
  if (!ts) return "-";
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return new Date(ts).toISOString();
  }
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function ShowcaseHistory({ open, onClose, entries, onChange }: Props) {
  const { message } = App.useApp();
  const [openId, setOpenId] = useState<string | null>(null);
  const [slideshowFor, setSlideshowFor] = useState<string | null>(null);

  const opened = useMemo(
    () => entries.find((e) => e.id === openId) ?? null,
    [entries, openId],
  );
  const slideshowEntry = useMemo(
    () => entries.find((e) => e.id === slideshowFor) ?? null,
    [entries, slideshowFor],
  );

  const slides =
    slideshowEntry?.items
      .filter((it) => it.status === "done" && it.b64)
      .map((it) => ({ name: it.name, description: it.description, b64: it.b64! })) ??
    [];

  function close() {
    setOpenId(null);
    setSlideshowFor(null);
    onClose();
  }

  function removeEntry(id: string) {
    const next = removeShowcaseHistoryEntry(id);
    onChange(next);
    if (openId === id) setOpenId(null);
    message.success("Removed from this browser");
  }

  function clearAll() {
    clearShowcaseHistory();
    onChange([]);
    setOpenId(null);
    message.success("Cleared history");
  }

  return (
    <>
      <Modal
        open={open}
        onCancel={close}
        footer={null}
        width={1080}
        destroyOnHidden
        title={
          <Space>
            {opened && (
              <Button
                type="text"
                size="small"
                icon={<ArrowLeftOutlined />}
                onClick={() => setOpenId(null)}
              >
                Back
              </Button>
            )}
            <HistoryOutlined />
            {opened
              ? `${opened.customerName} · ${opened.gender} · ${formatTimestamp(opened.createdAt)}`
              : "Generated history (this browser only)"}
          </Space>
        }
      >
        {opened ? (
          <EntryDetail
            entry={opened}
            onPresent={() => setSlideshowFor(opened.id)}
            onDelete={() => removeEntry(opened.id)}
          />
        ) : (
          <HistoryList
            entries={entries}
            onOpen={(id) => setOpenId(id)}
            onDelete={removeEntry}
            onClear={clearAll}
            onPresent={(id) => setSlideshowFor(id)}
          />
        )}
      </Modal>

      {slideshowEntry && slides.length > 0 && (
        <Slideshow
          slides={slides}
          startIndex={0}
          onClose={() => setSlideshowFor(null)}
        />
      )}
    </>
  );
}

function HistoryList({
  entries,
  onOpen,
  onDelete,
  onClear,
  onPresent,
}: {
  entries: ShowcaseHistoryEntry[];
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
  onPresent: (id: string) => void;
}) {
  return (
    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
      <Paragraph type="secondary" style={{ margin: 0 }}>
        Past previews you generated on this device. Photos and results live only
        in this browser&apos;s <Text code>localStorage</Text> - clearing site data
        wipes them, and they never reach our server.
      </Paragraph>
      {entries.length > 0 && (
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Popconfirm
            title="Clear all history?"
            description="Every saved preview on this device will be removed."
            okText="Clear"
            okButtonProps={{ danger: true }}
            onConfirm={onClear}
          >
            <Button danger icon={<ClearOutlined />} size="small">
              Clear all
            </Button>
          </Popconfirm>
        </div>
      )}
      {entries.length === 0 ? (
        <Empty description="No history yet - finished previews will appear here" />
      ) : (
        <Row gutter={[12, 12]}>
          {entries.map((e) => {
            const finishedCount = e.items.filter((i) => i.status === "done").length;
            const failedCount = e.items.filter((i) => i.status === "failed").length;
            const previewItem =
              e.items.find((i) => i.status === "done" && i.b64) ?? null;
            const cover = previewItem?.b64 ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`data:image/png;base64,${previewItem.b64}`}
                alt={previewItem.name}
                style={{
                  width: "100%",
                  aspectRatio: "1 / 1",
                  objectFit: previewItem.kind === "grid" ? "contain" : "cover",
                  background: "#0f0f12",
                }}
              />
            ) : e.inputDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={e.inputDataUrl}
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
                no preview
              </div>
            );
            return (
              <Col xs={24} sm={12} md={8} lg={6} key={e.id}>
                <Card
                  hoverable
                  size="small"
                  styles={{ body: { padding: 10 } }}
                  cover={cover}
                  onClick={() => onOpen(e.id)}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <Text strong style={{ fontSize: 13 }}>
                      {e.customerName}
                    </Text>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <Tag color="blue" style={{ marginRight: 0 }}>
                        {e.gender}
                      </Tag>
                      <Tag style={{ marginRight: 0 }}>{e.mode}</Tag>
                      {failedCount > 0 ? (
                        <Tag color="error" style={{ marginRight: 0 }}>
                          {finishedCount}/{e.items.length} · {failedCount} failed
                        </Tag>
                      ) : (
                        <Tag color="success" style={{ marginRight: 0 }}>
                          {finishedCount}/{e.items.length}
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
                          onOpen(e.id);
                        }}
                      >
                        Open
                      </Button>
                      {finishedCount > 0 && (
                        <Button
                          size="small"
                          icon={<PlayCircleOutlined />}
                          onClick={(ev) => {
                            ev.stopPropagation();
                            onPresent(e.id);
                          }}
                        >
                          Present
                        </Button>
                      )}
                      <Popconfirm
                        title="Delete this entry?"
                        description="The customer photo and all generated previews will be removed from this browser."
                        okText="Delete"
                        okButtonProps={{ danger: true }}
                        onConfirm={(ev) => {
                          ev?.stopPropagation();
                          onDelete(e.id);
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
            );
          })}
        </Row>
      )}
    </Space>
  );
}

function EntryDetail({
  entry,
  onPresent,
  onDelete,
}: {
  entry: ShowcaseHistoryEntry;
  onPresent: () => void;
  onDelete: () => void;
}) {
  const finishedCount = entry.items.filter((i) => i.status === "done").length;
  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        {finishedCount > 0 && (
          <Button type="primary" icon={<PlayCircleOutlined />} onClick={onPresent}>
            Present
          </Button>
        )}
        <Popconfirm
          title="Delete this entry?"
          description="The customer photo and all generated previews will be removed from this browser."
          okText="Delete"
          okButtonProps={{ danger: true }}
          onConfirm={onDelete}
        >
          <Button danger icon={<DeleteOutlined />}>
            Delete
          </Button>
        </Popconfirm>
      </div>
      <div>
        <Title level={5} style={{ marginTop: 0 }}>
          Customer photo
        </Title>
        {entry.inputDataUrl ? (
          <Image
            src={entry.inputDataUrl}
            alt="input"
            style={{
              maxWidth: 360,
              width: "100%",
              borderRadius: 12,
              background: "#0f0f12",
            }}
          />
        ) : (
          <Empty description="Input photo no longer available" />
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
              {entry.items.map((it, idx) => (
                <Col xs={12} md={8} key={`${it.name}-${idx}`}>
                  <Card
                    size="small"
                    styles={{ body: { padding: 10 } }}
                    cover={
                      it.b64 ? (
                        <Image
                          src={`data:image/png;base64,${it.b64}`}
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
                          {it.error || it.status}
                        </div>
                      )
                    }
                    actions={
                      it.b64
                        ? [
                            <a
                              key="dl"
                              href={`data:image/png;base64,${it.b64}`}
                              download={`${slugify(it.name) || "look"}.png`}
                            >
                              <DownloadOutlined /> Save
                            </a>,
                          ]
                        : undefined
                    }
                  >
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <Text strong style={{ fontSize: 13 }}>
                        {it.name}
                      </Text>
                      <Text style={{ fontSize: 11, color: "rgba(255,255,255,0.55)" }}>
                        {it.description}
                      </Text>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {it.kind === "grid" && (
                          <Tag style={{ marginRight: 0 }}>grid</Tag>
                        )}
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
