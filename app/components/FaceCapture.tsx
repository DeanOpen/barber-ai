"use client";

import {
  CameraOutlined,
  CloseOutlined,
  InboxOutlined,
  ReloadOutlined,
  RetweetOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import { App, Button, Modal, Segmented, Space, Upload } from "antd";
import { useEffect, useRef, useState } from "react";

type Mode = "camera" | "upload";

type Props = {
  value: File | null;
  preview: string | null;
  onChange: (file: File | null, preview: string | null) => void;
};

export default function FaceCapture({ value, preview, onChange }: Props) {
  const { message } = App.useApp();
  const [mode, setMode] = useState<Mode>("camera");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [ready, setReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    return () => {
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [stream]);

  async function openCamera(nextFacing: "user" | "environment" = facing) {
    try {
      stream?.getTracks().forEach((t) => t.stop());
      const s = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: nextFacing,
          width: { ideal: 1280 },
          height: { ideal: 1280 },
        },
        audio: false,
      });
      setStream(s);
      setFacing(nextFacing);
      setCameraOpen(true);
      setReady(false);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          videoRef.current.onloadedmetadata = () => setReady(true);
        }
      });
    } catch (err) {
      message.error(
        err instanceof Error
          ? `Couldn't open the camera: ${err.message}`
          : "Couldn't open the camera. You can upload a photo instead.",
      );
      setMode("upload");
    }
  }

  function closeCamera() {
    stream?.getTracks().forEach((t) => t.stop());
    setStream(null);
    setCameraOpen(false);
    setReady(false);
  }

  async function flip() {
    await openCamera(facing === "user" ? "environment" : "user");
  }

  function snap() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const w = video.videoWidth;
    const h = video.videoHeight;
    const side = Math.min(w, h);
    const sx = (w - side) / 2;
    const sy = (h - side) / 2;
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    if (facing === "user") {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, sx, sy, side, side, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          message.error("Capture failed");
          return;
        }
        const file = new File([blob], `capture-${Date.now()}.png`, { type: "image/png" });
        const reader = new FileReader();
        reader.onload = () => {
          onChange(file, reader.result as string);
          closeCamera();
        };
        reader.readAsDataURL(file);
      },
      "image/png",
      0.95,
    );
  }

  function clear() {
    onChange(null, null);
  }

  if (preview) {
    return (
      <div className="capture-preview">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={preview} alt="captured face" />
        <div className="capture-preview-overlay">
          <Space>
            <Button icon={<ReloadOutlined />} onClick={clear}>
              Retake
            </Button>
          </Space>
        </div>
      </div>
    );
  }

  return (
    <div className="capture-root">
      <Segmented<Mode>
        block
        value={mode}
        onChange={(v) => setMode(v as Mode)}
        options={[
          { value: "camera", label: "Use camera", icon: <CameraOutlined /> },
          { value: "upload", label: "Upload photo", icon: <UploadOutlined /> },
        ]}
      />

      <div style={{ marginTop: 16 }}>
        {mode === "camera" ? (
          <Button
            type="primary"
            size="large"
            icon={<CameraOutlined />}
            onClick={() => openCamera("user")}
            block
          >
            Open camera
          </Button>
        ) : (
          <Upload.Dragger
            multiple={false}
            maxCount={1}
            showUploadList={false}
            accept="image/png,image/jpeg,image/webp"
            beforeUpload={(f) => {
              const reader = new FileReader();
              reader.onload = () => onChange(f, reader.result as string);
              reader.readAsDataURL(f);
              return false;
            }}
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">Click or drag a photo here</p>
            <p className="ant-upload-hint">A clear, front-facing photo works best.</p>
          </Upload.Dragger>
        )}
      </div>

      <Modal
        open={cameraOpen}
        onCancel={closeCamera}
        footer={null}
        centered
        destroyOnHidden
        closable={false}
        width={560}
        styles={{
          body: { padding: 0, background: "#000", borderRadius: 12, overflow: "hidden" },
        }}
      >
        <div className="camera-stage">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className={facing === "user" ? "mirror" : ""}
          />
          <div className="face-guide" />
          {!ready && <div className="camera-loading">Opening camera…</div>}
          <button className="camera-close" onClick={closeCamera} aria-label="Close">
            <CloseOutlined />
          </button>
          <div className="camera-actions">
            <Button shape="circle" size="large" icon={<RetweetOutlined />} onClick={flip} />
            <Button
              type="primary"
              shape="round"
              size="large"
              icon={<CameraOutlined />}
              onClick={snap}
              disabled={!ready}
            >
              Capture
            </Button>
            <span style={{ width: 40 }} />
          </div>
        </div>
        <canvas ref={canvasRef} style={{ display: "none" }} />
      </Modal>
    </div>
  );
}
