import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";
const GOOGLE_PEOPLE_URL = "https://people.googleapis.com/v1";
const CONTACT_FIELDS = "names,emailAddresses,phoneNumbers,organizations,metadata";

export const GOOGLE_CONTACTS_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/contacts.readonly",
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

type GoogleFieldMetadata = {
  primary?: boolean;
};

type GooglePerson = {
  resourceName?: string;
  etag?: string;
  metadata?: { deleted?: boolean };
  names?: Array<{
    displayName?: string;
    unstructuredName?: string;
    metadata?: GoogleFieldMetadata;
  }>;
  emailAddresses?: Array<{ value?: string; metadata?: GoogleFieldMetadata }>;
  phoneNumbers?: Array<{
    value?: string;
    canonicalForm?: string;
    metadata?: GoogleFieldMetadata;
  }>;
  organizations?: Array<{
    name?: string;
    title?: string;
    department?: string;
    current?: boolean;
    metadata?: GoogleFieldMetadata;
  }>;
};

export type GoogleContactSummary = {
  resourceName: string;
  etag: string | null;
  name: string;
  phone: string | null;
  email: string | null;
  organization: string | null;
  title: string | null;
  department: string | null;
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
  url.searchParams.set("include_granted_scopes", "false");
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

async function googlePeopleRequest<T>(
  accessToken: string,
  url: string,
) {
  const response = await fetch(url, {
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });
  return parseGoogleResponse<T>(response);
}

function primaryValue<T extends { metadata?: GoogleFieldMetadata }>(values: T[] | undefined) {
  return values?.find((value) => value.metadata?.primary) ?? values?.[0];
}

export function normalizeGoogleContact(person: GooglePerson): GoogleContactSummary | null {
  if (!person.resourceName || person.metadata?.deleted) return null;
  const name = primaryValue(person.names);
  const email = primaryValue(person.emailAddresses);
  const phone = primaryValue(person.phoneNumbers);
  const organization =
    person.organizations?.find((value) => value.current && value.metadata?.primary) ??
    person.organizations?.find((value) => value.current) ??
    primaryValue(person.organizations);

  return {
    resourceName: person.resourceName,
    etag: person.etag ?? null,
    name: name?.displayName?.trim() || name?.unstructuredName?.trim() || "",
    phone: phone?.canonicalForm?.trim() || phone?.value?.trim() || null,
    email: email?.value?.trim() || null,
    organization: organization?.name?.trim() || null,
    title: organization?.title?.trim() || null,
    department: organization?.department?.trim() || null,
  };
}

export async function listGoogleContacts(accessToken: string) {
  const contacts: GoogleContactSummary[] = [];
  let pageToken: string | undefined;

  do {
    const url = new URL(`${GOOGLE_PEOPLE_URL}/people/me/connections`);
    url.searchParams.set("personFields", CONTACT_FIELDS);
    url.searchParams.set("pageSize", "1000");
    url.searchParams.set("sortOrder", "LAST_NAME_ASCENDING");
    url.searchParams.append("sources", "READ_SOURCE_TYPE_CONTACT");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const page = await googlePeopleRequest<{
      connections?: GooglePerson[];
      nextPageToken?: string;
    }>(accessToken, url.toString());
    contacts.push(
      ...(page.connections ?? []).flatMap((person) => {
        const contact = normalizeGoogleContact(person);
        return contact ? [contact] : [];
      }),
    );
    pageToken = page.nextPageToken;
  } while (pageToken);

  return contacts;
}

export async function getGoogleContact(accessToken: string, resourceName: string) {
  const url = new URL(`${GOOGLE_PEOPLE_URL}/${resourceName}`);
  url.searchParams.set("personFields", CONTACT_FIELDS);
  url.searchParams.append("sources", "READ_SOURCE_TYPE_CONTACT");
  const person = await googlePeopleRequest<GooglePerson>(accessToken, url.toString());
  const contact = normalizeGoogleContact(person);
  if (!contact) throw new Error("Google 연락처를 찾지 못했어.");
  return contact;
}
