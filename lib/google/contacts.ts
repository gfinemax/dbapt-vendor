import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";
const GOOGLE_PEOPLE_URL = "https://people.googleapis.com/v1";
const CONTACT_FIELDS = "names,emailAddresses,phoneNumbers,organizations,biographies,metadata";

export const GOOGLE_CONTACTS_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/contacts",
] as const;

type GoogleContactsConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  encryptionKey: Buffer;
};

export type EncryptedGoogleToken = {
  ciphertext: string;
  iv: string;
  tag: string;
};

export type GoogleContactPayload = {
  name: string;
  phone: string | null;
  email: string | null;
  title: string | null;
  duty: string | null;
  vendorName: string;
  vendorCategory: string | null;
};

type GooglePerson = {
  resourceName?: string;
  etag?: string;
  metadata?: { sources?: Array<Record<string, unknown>> };
};

export class GoogleContactsApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "GoogleContactsApiError";
  }
}

function readEncryptionKey(value: string | undefined) {
  if (!value) return null;
  const key = Buffer.from(value.trim(), "base64");
  return key.length === 32 ? key : null;
}

function readRequiredEnv(value: string | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export function getGoogleContactsConfig(): GoogleContactsConfig | null {
  const clientId = readRequiredEnv(process.env.GOOGLE_CONTACTS_CLIENT_ID);
  const clientSecret = readRequiredEnv(process.env.GOOGLE_CONTACTS_CLIENT_SECRET);
  const redirectUri = readRequiredEnv(process.env.GOOGLE_CONTACTS_REDIRECT_URI);
  const encryptionKey = readEncryptionKey(process.env.GOOGLE_CONTACTS_TOKEN_ENCRYPTION_KEY);

  if (!clientId || !clientSecret || !redirectUri || !encryptionKey) return null;
  return { clientId, clientSecret, redirectUri, encryptionKey };
}

export function getGoogleContactsMissingConfig() {
  const missing: string[] = [];
  if (!readRequiredEnv(process.env.GOOGLE_CONTACTS_CLIENT_ID)) missing.push("GOOGLE_CONTACTS_CLIENT_ID");
  if (!readRequiredEnv(process.env.GOOGLE_CONTACTS_CLIENT_SECRET)) missing.push("GOOGLE_CONTACTS_CLIENT_SECRET");
  if (!readRequiredEnv(process.env.GOOGLE_CONTACTS_REDIRECT_URI)) missing.push("GOOGLE_CONTACTS_REDIRECT_URI");
  if (!readEncryptionKey(process.env.GOOGLE_CONTACTS_TOKEN_ENCRYPTION_KEY)) {
    missing.push("GOOGLE_CONTACTS_TOKEN_ENCRYPTION_KEY");
  }
  return missing;
}

export function createGoogleAuthorizationUrl(state: string) {
  const config = getGoogleContactsConfig();
  if (!config) throw new Error("Google 연락처 환경 설정이 완료되지 않았어.");

  const url = new URL(GOOGLE_AUTH_URL);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("scope", GOOGLE_CONTACTS_SCOPES.join(" "));
  url.searchParams.set("state", state);
  return url;
}

export function encryptGoogleRefreshToken(refreshToken: string): EncryptedGoogleToken {
  const config = getGoogleContactsConfig();
  if (!config) throw new Error("Google 연락처 환경 설정이 완료되지 않았어.");

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", config.encryptionKey, iv);
  const ciphertext = Buffer.concat([cipher.update(refreshToken, "utf8"), cipher.final()]);
  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
  };
}

export function decryptGoogleRefreshToken(token: EncryptedGoogleToken) {
  const config = getGoogleContactsConfig();
  if (!config) throw new Error("Google 연락처 환경 설정이 완료되지 않았어.");

  const decipher = createDecipheriv(
    "aes-256-gcm",
    config.encryptionKey,
    Buffer.from(token.iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(token.tag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(token.ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

async function parseGoogleResponse<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const googleMessage =
      typeof body === "object" && body && "error" in body
        ? (body.error as { message?: unknown })?.message
        : undefined;
    throw new GoogleContactsApiError(
      typeof googleMessage === "string" ? googleMessage : "Google API 요청에 실패했어.",
      response.status,
    );
  }
  return body as T;
}

export async function exchangeGoogleAuthorizationCode(code: string) {
  const config = getGoogleContactsConfig();
  if (!config) throw new Error("Google 연락처 환경 설정이 완료되지 않았어.");

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: "authorization_code",
    }),
    cache: "no-store",
  });
  return parseGoogleResponse<{
    access_token: string;
    refresh_token?: string;
    scope?: string;
  }>(response);
}

export async function getGoogleAccountEmail(accessToken: string) {
  const response = await fetch(GOOGLE_USERINFO_URL, {
    headers: { authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  const user = await parseGoogleResponse<{ email?: string }>(response);
  if (!user.email) throw new Error("연결한 Google 계정 이메일을 확인하지 못했어.");
  return user.email;
}

export async function refreshGoogleAccessToken(refreshToken: string) {
  const config = getGoogleContactsConfig();
  if (!config) throw new Error("Google 연락처 환경 설정이 완료되지 않았어.");

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: "refresh_token",
    }),
    cache: "no-store",
  });
  const token = await parseGoogleResponse<{ access_token: string }>(response);
  return token.access_token;
}

function buildGooglePerson(contact: GoogleContactPayload) {
  const biography = [
    contact.duty ? `담당 업무: ${contact.duty}` : null,
    contact.vendorCategory ? `업체 분야: ${contact.vendorCategory}` : null,
    "DB-Vendor에서 동기화됨",
  ].filter(Boolean).join("\n");

  return {
    names: [{ unstructuredName: contact.name }],
    phoneNumbers: contact.phone ? [{ value: contact.phone, type: "work" }] : [],
    emailAddresses: contact.email ? [{ value: contact.email, type: "work" }] : [],
    organizations: [
      {
        name: contact.vendorName,
        title: contact.title ?? undefined,
        department: contact.duty ?? undefined,
        type: "work",
      },
    ],
    biographies: [{ value: biography, contentType: "TEXT_PLAIN" }],
  };
}

async function googlePeopleRequest<T>(
  accessToken: string,
  url: string,
  init?: RequestInit,
) {
  const response = await fetch(url, {
    ...init,
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
      ...init?.headers,
    },
    cache: "no-store",
  });
  return parseGoogleResponse<T>(response);
}

export async function syncGoogleContact(params: {
  accessToken: string;
  contact: GoogleContactPayload;
  resourceName?: string | null;
}) {
  const person = buildGooglePerson(params.contact);

  if (params.resourceName) {
    try {
      const latest = await googlePeopleRequest<GooglePerson>(
        params.accessToken,
        `${GOOGLE_PEOPLE_URL}/${params.resourceName}?personFields=metadata`,
      );
      const updated = await googlePeopleRequest<GooglePerson>(
        params.accessToken,
        `${GOOGLE_PEOPLE_URL}/${params.resourceName}:updateContact?updatePersonFields=names,emailAddresses,phoneNumbers,organizations,biographies&personFields=${CONTACT_FIELDS}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            ...person,
            resourceName: params.resourceName,
            etag: latest.etag,
            metadata: latest.metadata,
          }),
        },
      );
      if (!updated.resourceName) throw new Error("Google 연락처 식별자를 받지 못했어.");
      return { resourceName: updated.resourceName, etag: updated.etag ?? null };
    } catch (error) {
      if (!(error instanceof GoogleContactsApiError) || error.status !== 404) throw error;
    }
  }

  const created = await googlePeopleRequest<GooglePerson>(
    params.accessToken,
    `${GOOGLE_PEOPLE_URL}/people:createContact?personFields=${CONTACT_FIELDS}`,
    { method: "POST", body: JSON.stringify(person) },
  );
  if (!created.resourceName) throw new Error("Google 연락처 식별자를 받지 못했어.");
  return { resourceName: created.resourceName, etag: created.etag ?? null };
}
