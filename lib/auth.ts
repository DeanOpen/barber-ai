import { cookies } from "next/headers";
import crypto from "node:crypto";
import { getSettings } from "./settings";

const COOKIE = "barber_admin";

function tokenFor(password: string): string {
  return crypto.createHash("sha256").update("barber:" + password).digest("hex");
}

export async function isAdmin(): Promise<boolean> {
  const jar = await cookies();
  const value = jar.get(COOKIE)?.value;
  if (!value) return false;
  const s = await getSettings();
  return value === tokenFor(s.adminPassword);
}

export async function login(password: string): Promise<boolean> {
  const s = await getSettings();
  if (password !== s.adminPassword) return false;
  const jar = await cookies();
  jar.set(COOKIE, tokenFor(s.adminPassword), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return true;
}

export async function logout(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}
