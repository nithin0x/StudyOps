import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import express from "express";

import { createSeedAppData, removeLegacySeedContent } from "./defaultData.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.join(__dirname, "data");
const dataFile = path.join(dataDir, "store.json");
const clientDistDir = path.resolve(__dirname, "../dist");

const PORT = Number.parseInt(process.env.PORT ?? "3001", 10);
const SESSION_COOKIE = "certflow_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;
const SESSION_TOUCH_INTERVAL_MS = 1000 * 60 * 5;
const MAX_BODY_SIZE = "100kb";
const AUTH_RATE = { windowMs: 15 * 60 * 1000, max: 20 };
const WRITE_RATE = { windowMs: 60 * 1000, max: 120 };
const STATE_CHANGING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const CSRF_HEADER = "x-csrf-token";
const NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 .'-]{1,58}[A-Za-z0-9.]$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ID_PATTERN = /^[A-Za-z0-9_-]{4,64}$/;
const PLATFORM_PATTERN = /^[a-z0-9-]{2,24}$/;
const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;
const ISO_DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
const ITEM_LIMIT = 50;
const TASK_LIMIT = 30;
const LOG_LIMIT = 120;
const VALID_DIFFICULTIES = new Set(["easy", "medium", "hard", "insane"]);
const VALID_LAB_STATUS = new Set(["todo", "inprogress", "pwned", "stuck"]);
const VALID_WRITEUP_STATUS = new Set(["none", "draft", "done", "published"]);
const VALID_VIEWS = new Set(["dashboard", "study", "labs", "calendar", "activity"]);
const TIMER_MIN_LIMIT = 1;
const TIMER_MAX_LIMIT = 120;
const TRUST_PROXY = process.env.TRUST_PROXY === "true" || process.env.TRUST_PROXY === "1";
const TRUSTED_ORIGINS = new Set(
  (process.env.TRUSTED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
);

const rateBuckets = new Map();

function logPersistError(context, error) {
  console.error(`[store] ${context}`, error);
}

function persistStoreAsync(context) {
  persistStore().catch((error) => {
    logPersistError(context, error);
  });
}

function createEmptyStore() {
  return {
    users: [],
    sessions: [],
    appDataByUserId: {},
  };
}

async function ensureStoreFile() {
  await fs.mkdir(dataDir, { recursive: true, mode: 0o700 });

  try {
    await fs.access(dataFile);
    await fs.chmod(dataFile, 0o600).catch(() => {});
  } catch {
    await fs.writeFile(dataFile, JSON.stringify(createEmptyStore(), null, 2), { mode: 0o600 });
  }
}

async function loadStore() {
  await ensureStoreFile();
  const raw = await fs.readFile(dataFile, "utf8");
  const parsed = JSON.parse(raw);
  return {
    users: Array.isArray(parsed.users) ? parsed.users : [],
    sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
    appDataByUserId:
      parsed.appDataByUserId && typeof parsed.appDataByUserId === "object"
        ? parsed.appDataByUserId
        : {},
  };
}

let store = await loadStore();
let writeQueue = Promise.resolve();

function persistStore() {
  const nextPayload = JSON.stringify(store, null, 2);
  writeQueue = writeQueue.then(async () => {
    await fs.writeFile(dataFile, nextPayload, { mode: 0o600 });
    await fs.chmod(dataFile, 0o600).catch(() => {});
  });
  return writeQueue;
}

function migrateLegacySeedContent() {
  let changed = false;

  for (const user of store.users) {
    const existingAppData = store.appDataByUserId[user.id];

    if (!existingAppData) {
      continue;
    }

    const migratedAppData = removeLegacySeedContent(existingAppData, user.name);

    if (migratedAppData !== existingAppData) {
      store.appDataByUserId[user.id] = migratedAppData;
      changed = true;
    }
  }

  return changed;
}

function nowIso() {
  return new Date().toISOString();
}

function createId(prefix) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function sanitizeText(value, maxLength, fieldName, options = {}) {
  const {
    allowEmpty = true,
    pattern = null,
    normalize = true,
  } = options;

  if (typeof value !== "string") {
    throw createHttpError(400, `${fieldName} must be a string.`);
  }

  const result = normalize ? value.trim() : value;

  if (!allowEmpty && result.length === 0) {
    throw createHttpError(400, `${fieldName} is required.`);
  }

  if (result.length > maxLength) {
    throw createHttpError(400, `${fieldName} is too long.`);
  }

  if (pattern && result.length > 0 && !pattern.test(result)) {
    throw createHttpError(400, `${fieldName} has an invalid format.`);
  }

  return result;
}

function sanitizeDate(value, fieldName) {
  if (value === "" || value == null) {
    return "";
  }

  if (typeof value !== "string" || !DATE_PATTERN.test(value)) {
    throw createHttpError(400, `${fieldName} must use YYYY-MM-DD.`);
  }

  return value;
}

function sanitizeIsoDateTime(value, fieldName) {
  if (value === "" || value == null) {
    return "";
  }

  if (typeof value !== "string" || !ISO_DATE_TIME_PATTERN.test(value)) {
    throw createHttpError(400, `${fieldName} must be an ISO date-time string.`);
  }

  return value;
}

function sanitizeBoolean(value) {
  return value === true;
}

function sanitizeInteger(value, fieldName, min, max) {
  if (!Number.isInteger(value)) {
    throw createHttpError(400, `${fieldName} must be an integer.`);
  }

  if (value < min || value > max) {
    throw createHttpError(400, `${fieldName} is out of range.`);
  }

  return value;
}

function sanitizeId(value, fieldName, prefix) {
  if (typeof value === "string" && ID_PATTERN.test(value)) {
    return value;
  }

  return createId(prefix ?? fieldName.toLowerCase());
}

function sanitizeUrl(value, fieldName) {
  if (value === "" || value == null) {
    return "";
  }

  const raw = sanitizeText(value, 300, fieldName, { allowEmpty: true });

  try {
    const parsed = new URL(raw);

    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new Error("invalid protocol");
    }

    return parsed.toString();
  } catch {
    throw createHttpError(400, `${fieldName} must be a valid http(s) URL.`);
  }
}

function sanitizeTask(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw createHttpError(400, "Tasks must be objects.");
  }

  return {
    id: sanitizeId(input.id, "task", "task"),
    title: sanitizeText(input.title ?? "", 90, "Task title", { allowEmpty: false }),
    done: sanitizeBoolean(input.done),
  };
}

function sanitizeCourse(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw createHttpError(400, "Courses must be objects.");
  }

  const tasks = Array.isArray(input.tasks) ? input.tasks.slice(0, TASK_LIMIT).map(sanitizeTask) : [];

  return {
    id: sanitizeId(input.id, "course", "course"),
    title: sanitizeText(input.title ?? "", 80, "Course title", { allowEmpty: false }),
    provider: sanitizeText(input.provider ?? "", 60, "Course provider", { allowEmpty: false }),
    startDate: sanitizeDate(input.startDate ?? "", "Course start date"),
    targetDate: sanitizeDate(input.targetDate ?? "", "Course target date"),
    sessions: sanitizeInteger(input.sessions ?? 0, "Course sessions", 0, 5000),
    notes: sanitizeText(input.notes ?? "", 400, "Course notes"),
    tasks,
  };
}

function sanitizeCert(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw createHttpError(400, "Certifications must be objects.");
  }

  const tasks = Array.isArray(input.tasks) ? input.tasks.slice(0, TASK_LIMIT).map(sanitizeTask) : [];

  return {
    id: sanitizeId(input.id, "cert", "cert"),
    title: sanitizeText(input.title ?? "", 80, "Certification title", { allowEmpty: false }),
    vendor: sanitizeText(input.vendor ?? "", 60, "Certification vendor", { allowEmpty: false }),
    studyStart: sanitizeDate(input.studyStart ?? "", "Certification study start"),
    examDate: sanitizeDate(input.examDate ?? "", "Certification exam date"),
    sessions: sanitizeInteger(input.sessions ?? 0, "Certification sessions", 0, 5000),
    passed: sanitizeBoolean(input.passed),
    notes: sanitizeText(input.notes ?? "", 400, "Certification notes"),
    tasks,
  };
}

function sanitizePlatform(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw createHttpError(400, "Platforms must be objects.");
  }

  const key = sanitizeText(input.key ?? "", 24, "Platform key", {
    allowEmpty: false,
    pattern: PLATFORM_PATTERN,
  }).toLowerCase();

  const accent = sanitizeText(input.accent ?? "", 7, "Platform accent", {
    allowEmpty: false,
    pattern: HEX_COLOR_PATTERN,
    normalize: false,
  });

  return {
    key,
    name: sanitizeText(input.name ?? "", 40, "Platform name", { allowEmpty: false }),
    accent,
  };
}

function sanitizeLab(input, platformKeys) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw createHttpError(400, "Labs must be objects.");
  }

  const platformKey = sanitizeText(input.platformKey ?? "", 24, "Lab platform", {
    allowEmpty: false,
    pattern: PLATFORM_PATTERN,
  }).toLowerCase();

  if (!platformKeys.has(platformKey)) {
    throw createHttpError(400, "Lab platform is not recognized.");
  }

  const difficulty = sanitizeText(input.difficulty ?? "", 8, "Lab difficulty", {
    allowEmpty: false,
  }).toLowerCase();
  const status = sanitizeText(input.status ?? "", 16, "Lab status", {
    allowEmpty: false,
  }).toLowerCase();
  const writeupStatus = sanitizeText(input.writeupStatus ?? "", 16, "Writeup status", {
    allowEmpty: false,
  }).toLowerCase();

  if (!VALID_DIFFICULTIES.has(difficulty)) {
    throw createHttpError(400, "Lab difficulty is invalid.");
  }

  if (!VALID_LAB_STATUS.has(status)) {
    throw createHttpError(400, "Lab status is invalid.");
  }

  if (!VALID_WRITEUP_STATUS.has(writeupStatus)) {
    throw createHttpError(400, "Writeup status is invalid.");
  }

  return {
    id: sanitizeId(input.id, "lab", "lab"),
    platformKey,
    name: sanitizeText(input.name ?? "", 80, "Lab name", { allowEmpty: false }),
    difficulty,
    status,
    writeupStatus,
    os: sanitizeText(input.os ?? "", 24, "Lab OS"),
    notes: sanitizeText(input.notes ?? "", 500, "Lab notes"),
    writeupUrl: sanitizeUrl(input.writeupUrl ?? "", "Writeup URL"),
    completedAt: sanitizeDate(input.completedAt ?? "", "Completion date"),
  };
}

function sanitizeActivity(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw createHttpError(400, "Activity entries must be objects.");
  }

  return {
    id: sanitizeId(input.id, "activity", "activity"),
    type: sanitizeText(input.type ?? "note", 24, "Activity type", { allowEmpty: false }).toLowerCase(),
    label: sanitizeText(input.label ?? "", 80, "Activity label", { allowEmpty: false }),
    detail: sanitizeText(input.detail ?? "", 160, "Activity detail"),
    occurredAt: sanitizeIsoDateTime(input.occurredAt ?? nowIso(), "Activity timestamp") || nowIso(),
  };
}

function sanitizeAppData(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw createHttpError(400, "App data payload is invalid.");
  }

  const preferencesInput =
    payload.preferences && typeof payload.preferences === "object" && !Array.isArray(payload.preferences)
      ? payload.preferences
      : {};
  const statsInput =
    payload.stats && typeof payload.stats === "object" && !Array.isArray(payload.stats) ? payload.stats : {};
  const studyInput =
    payload.study && typeof payload.study === "object" && !Array.isArray(payload.study) ? payload.study : {};
  const labsInput =
    payload.labs && typeof payload.labs === "object" && !Array.isArray(payload.labs) ? payload.labs : {};

  const platforms = Array.isArray(labsInput.platforms) ? labsInput.platforms.slice(0, 12).map(sanitizePlatform) : [];
  const uniquePlatforms = new Map(platforms.map((platform) => [platform.key, platform]));

  if (uniquePlatforms.size !== platforms.length) {
    throw createHttpError(400, "Platform keys must be unique.");
  }

  const platformKeys = new Set(uniquePlatforms.keys());
  const entries = Array.isArray(labsInput.entries)
    ? labsInput.entries.slice(0, ITEM_LIMIT).map((entry) => sanitizeLab(entry, platformKeys))
    : [];

  return {
    preferences: {
      activeView: VALID_VIEWS.has(preferencesInput.activeView) ? preferencesInput.activeView : "dashboard",
      selectedLabPlatform: platformKeys.has(preferencesInput.selectedLabPlatform)
        ? preferencesInput.selectedLabPlatform
        : platforms[0]?.key ?? "",
      focusItemId: sanitizeText(preferencesInput.focusItemId ?? "", 64, "Focus item id", {
        pattern: /^[A-Za-z0-9_-]*$/,
      }),
      timerDurations: {
        work: sanitizeInteger(
          preferencesInput?.timerDurations?.work ?? 25,
          "Work timer minutes",
          TIMER_MIN_LIMIT,
          TIMER_MAX_LIMIT,
        ),
        short: sanitizeInteger(
          preferencesInput?.timerDurations?.short ?? 5,
          "Short timer minutes",
          TIMER_MIN_LIMIT,
          TIMER_MAX_LIMIT,
        ),
        long: sanitizeInteger(
          preferencesInput?.timerDurations?.long ?? 15,
          "Long timer minutes",
          TIMER_MIN_LIMIT,
          TIMER_MAX_LIMIT,
        ),
      },
    },
    stats: {
      completedPomodoros: sanitizeInteger(statsInput.completedPomodoros ?? 0, "Completed pomodoros", 0, 50000),
    },
    study: {
      courses: Array.isArray(studyInput.courses)
        ? studyInput.courses.slice(0, ITEM_LIMIT).map(sanitizeCourse)
        : [],
      certs: Array.isArray(studyInput.certs)
        ? studyInput.certs.slice(0, ITEM_LIMIT).map(sanitizeCert)
        : [],
    },
    labs: {
      platforms: Array.from(uniquePlatforms.values()),
      entries,
    },
    activity: Array.isArray(payload.activity)
      ? payload.activity.slice(0, LOG_LIMIT).map(sanitizeActivity)
      : [],
  };
}

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const derived = await scrypt(password, salt);
  return `${salt.toString("hex")}:${derived.toString("hex")}`;
}

async function verifyPassword(password, storedValue) {
  if (typeof storedValue !== "string" || !storedValue.includes(":")) {
    return false;
  }

  const [saltHex, hashHex] = storedValue.split(":");
  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");
  const actual = await scrypt(password, salt, expected.length);

  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

function scrypt(password, salt, keyLength = 64) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, keyLength, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(derivedKey);
    });
  });
}

function parseCookies(cookieHeader) {
  if (!cookieHeader) {
    return {};
  }

  return cookieHeader.split(";").reduce((cookies, chunk) => {
    const [rawName, ...rawValue] = chunk.split("=");
    const name = rawName?.trim();

    if (!name) {
      return cookies;
    }

    try {
      cookies[name] = decodeURIComponent(rawValue.join("=").trim());
    } catch {
      cookies[name] = rawValue.join("=").trim();
    }

    return cookies;
  }, {});
}

function createCsrfToken() {
  return crypto.randomBytes(32).toString("base64url");
}

function timingSafeEqualText(left, right) {
  if (typeof left !== "string" || typeof right !== "string") {
    return false;
  }

  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function cleanupExpiredSessions() {
  const currentTime = Date.now();
  const beforeCount = store.sessions.length;
  store.sessions = store.sessions.filter((session) => new Date(session.expiresAt).getTime() > currentTime);

  if (store.sessions.length !== beforeCount) {
    persistStoreAsync("Failed to persist expired session cleanup.");
  }
}

function shouldTouchSession(session) {
  const lastSeenAt = Date.parse(session?.lastSeenAt ?? "");

  if (!Number.isFinite(lastSeenAt)) {
    return true;
  }

  return Date.now() - lastSeenAt >= SESSION_TOUCH_INTERVAL_MS;
}

function setSessionCookie(response, token) {
  response.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_TTL_MS,
    path: "/",
  });
}

function clearSessionCookie(response) {
  response.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}

function stripUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
  };
}

function getClientFingerprint(request) {
  return request.ip || request.socket.remoteAddress || "unknown";
}

function rateLimit(scope, config) {
  return (request, response, next) => {
    const currentTime = Date.now();
    const key = `${scope}:${getClientFingerprint(request)}`;
    const bucket = rateBuckets.get(key) ?? { count: 0, resetAt: currentTime + config.windowMs };

    if (bucket.resetAt <= currentTime) {
      bucket.count = 0;
      bucket.resetAt = currentTime + config.windowMs;
    }

    bucket.count += 1;
    rateBuckets.set(key, bucket);

    if (bucket.count > config.max) {
      response.setHeader("Retry-After", Math.ceil((bucket.resetAt - currentTime) / 1000));
      response.status(429).json({ message: "Too many requests. Please slow down." });
      return;
    }

    next();
  };
}

function securityHeaders(request, response, next) {
  response.setHeader("Content-Security-Policy", "default-src 'self'; base-uri 'self'; connect-src 'self'; font-src 'self' data:; form-action 'self'; frame-ancestors 'none'; img-src 'self' data:; object-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'");
  response.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  response.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  response.setHeader("Permissions-Policy", "camera=(), geolocation=(), microphone=()");
  response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "DENY");

  if (process.env.NODE_ENV === "production") {
    response.setHeader("Strict-Transport-Security", "max-age=15552000; includeSubDomains");
  }

  next();
}

function noStoreApiResponses(request, response, next) {
  response.setHeader("Cache-Control", "no-store, private");
  next();
}

function getRequestOrigin(request) {
  const originHeader = request.get("origin");

  if (originHeader) {
    return originHeader;
  }

  const refererHeader = request.get("referer");

  if (!refererHeader) {
    return "";
  }

  try {
    return new URL(refererHeader).origin;
  } catch {
    return "";
  }
}

function getTrustedOrigins(request) {
  const origins = new Set(TRUSTED_ORIGINS);
  const host = request.get("host");

  if (host) {
    origins.add(`${request.protocol}://${host}`);
  }

  if (process.env.NODE_ENV !== "production") {
    origins.add("http://127.0.0.1:5173");
    origins.add("http://localhost:5173");
    origins.add("http://127.0.0.1:4173");
    origins.add("http://localhost:4173");
  }

  return origins;
}

function requireTrustedOrigin(request, _response, next) {
  if (!STATE_CHANGING_METHODS.has(request.method)) {
    next();
    return;
  }

  const requestOrigin = getRequestOrigin(request);

  if (!requestOrigin) {
    next(createHttpError(403, "Requests must include a trusted origin."));
    return;
  }

  if (!getTrustedOrigins(request).has(requestOrigin)) {
    next(createHttpError(403, "Request origin is not allowed."));
    return;
  }

  next();
}

function ensureSessionCsrfToken(session) {
  if (typeof session?.csrfToken === "string" && session.csrfToken.length >= 32) {
    return session.csrfToken;
  }

  const csrfToken = createCsrfToken();

  if (session) {
    session.csrfToken = csrfToken;
    persistStoreAsync("Failed to persist generated CSRF token.");
  }

  return csrfToken;
}

function requireCsrf(request, _response, next) {
  if (!STATE_CHANGING_METHODS.has(request.method) || !request.session) {
    next();
    return;
  }

  const providedToken = request.get(CSRF_HEADER) ?? "";
  const expectedToken = ensureSessionCsrfToken(request.session);

  if (!timingSafeEqualText(providedToken, expectedToken)) {
    next(createHttpError(403, "Request validation failed."));
    return;
  }

  next();
}

async function createSession(userId) {
  const token = crypto.randomBytes(32).toString("base64url");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const csrfToken = createCsrfToken();
  const session = {
    id: createId("session"),
    userId,
    tokenHash,
    csrfToken,
    createdAt: nowIso(),
    lastSeenAt: nowIso(),
    expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
  };

  store.sessions = store.sessions.filter((existing) => existing.userId !== userId || existing.tokenHash !== tokenHash);
  store.sessions.push(session);
  await persistStore();

  return { token, csrfToken };
}

async function attachUser(request, _response, next) {
  cleanupExpiredSessions();

  const cookies = parseCookies(request.headers.cookie);
  const rawToken = cookies[SESSION_COOKIE];

  if (!rawToken) {
    request.user = null;
    request.session = null;
    next();
    return;
  }

  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  const session = store.sessions.find((candidate) => candidate.tokenHash === tokenHash);

  if (!session) {
    request.user = null;
    request.session = null;
    next();
    return;
  }

  const user = store.users.find((candidate) => candidate.id === session.userId);

  if (!user) {
    request.user = null;
    request.session = null;
    next();
    return;
  }

  request.user = user;
  request.session = session;

  if (shouldTouchSession(session)) {
    session.lastSeenAt = nowIso();
    await persistStore();
  }

  next();
}

function requireAuth(request, _response, next) {
  if (!request.user) {
    next(createHttpError(401, "You need to sign in first."));
    return;
  }

  next();
}

function ensureUserAppData(user) {
  const existing = store.appDataByUserId[user.id];

  if (existing) {
    return existing;
  }

  const seeded = createSeedAppData();
  store.appDataByUserId[user.id] = seeded;
  persistStoreAsync("Failed to persist seeded app data.");
  return seeded;
}

function createSessionResponse(user, appData, csrfToken) {
  return {
    user: stripUser(user),
    appData,
    csrfToken,
  };
}

if (migrateLegacySeedContent()) {
  await persistStore();
}

export const app = express();
const api = express.Router();
let hasClientDist = false;

app.set("trust proxy", TRUST_PROXY);
app.disable("x-powered-by");
app.use(securityHeaders);

try {
  await fs.access(clientDistDir);
  hasClientDist = true;
  app.use(
    express.static(clientDistDir, {
      index: false,
      setHeaders(response, servedPath) {
        if (servedPath.endsWith(".html")) {
          response.setHeader("Cache-Control", "no-store");
          return;
        }

        if (servedPath.includes(`${path.sep}assets${path.sep}`)) {
          response.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        }
      },
    }),
  );
} catch {
  // Frontend build output is optional during development.
}

api.use(noStoreApiResponses);
api.use(express.json({ limit: MAX_BODY_SIZE }));
api.use(attachUser);
api.use(requireTrustedOrigin);
api.use(requireCsrf);

api.get("/health", (_request, response) => {
  response.json({
    ok: true,
    serverTime: nowIso(),
  });
});

api.post("/auth/register", rateLimit("auth-register", AUTH_RATE), async (request, response, next) => {
  try {
    const name = sanitizeText(request.body?.name ?? "", 60, "Name", {
      allowEmpty: false,
      pattern: NAME_PATTERN,
    });
    const email = sanitizeText(request.body?.email ?? "", 120, "Email", {
      allowEmpty: false,
      pattern: EMAIL_PATTERN,
    }).toLowerCase();
    const password = sanitizeText(request.body?.password ?? "", 128, "Password", {
      allowEmpty: false,
      normalize: false,
    });

    if (password.length < 10) {
      throw createHttpError(400, "Password must be at least 10 characters.");
    }

    if (store.users.some((user) => user.email === email)) {
      throw createHttpError(409, "An account with that email already exists.");
    }

    const user = {
      id: createId("user"),
      name,
      email,
      passwordHash: await hashPassword(password),
      createdAt: nowIso(),
      lastLoginAt: nowIso(),
    };

    store.users.push(user);
    store.appDataByUserId[user.id] = createSeedAppData();
    const { token, csrfToken } = await createSession(user.id);

    setSessionCookie(response, token);
    response.status(201).json(createSessionResponse(user, store.appDataByUserId[user.id], csrfToken));
  } catch (error) {
    next(error);
  }
});

api.post("/auth/login", rateLimit("auth-login", AUTH_RATE), async (request, response, next) => {
  try {
    const email = sanitizeText(request.body?.email ?? "", 120, "Email", {
      allowEmpty: false,
      pattern: EMAIL_PATTERN,
    }).toLowerCase();
    const password = sanitizeText(request.body?.password ?? "", 128, "Password", {
      allowEmpty: false,
      normalize: false,
    });
    const user = store.users.find((candidate) => candidate.email === email);

    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      throw createHttpError(401, "Email or password is incorrect.");
    }

    user.lastLoginAt = nowIso();
    const { token, csrfToken } = await createSession(user.id);

    setSessionCookie(response, token);
    response.json(createSessionResponse(user, ensureUserAppData(user), csrfToken));
  } catch (error) {
    next(error);
  }
});

api.get("/auth/session", requireAuth, (request, response) => {
  response.json(createSessionResponse(request.user, ensureUserAppData(request.user), ensureSessionCsrfToken(request.session)));
});

api.post("/auth/logout", requireAuth, async (request, response, next) => {
  try {
    const sessionId = request.session?.id;
    store.sessions = store.sessions.filter((session) => session.id !== sessionId);
    await persistStore();
    clearSessionCookie(response);
    response.status(204).end();
  } catch (error) {
    next(error);
  }
});

api.put("/app-data", requireAuth, rateLimit("app-write", WRITE_RATE), async (request, response, next) => {
  try {
    const sanitized = sanitizeAppData(request.body);
    store.appDataByUserId[request.user.id] = sanitized;
    await persistStore();

    response.json({
      savedAt: nowIso(),
    });
  } catch (error) {
    next(error);
  }
});

app.use("/api", api);

if (hasClientDist) {
  app.get(/^(?!\/api).*/, (_request, response) => {
    response.setHeader("Cache-Control", "no-store");
    response.sendFile(path.join(clientDistDir, "index.html"));
  });
}

app.use((error, _request, response, _next) => {
  if (error instanceof SyntaxError && "body" in error) {
    response.status(400).json({ message: "Request body must be valid JSON." });
    return;
  }

  const statusCode = Number.isInteger(error.statusCode) ? error.statusCode : 500;
  const message = statusCode >= 500 ? "Something went wrong on the server." : error.message;
  response.status(statusCode).json({ message });
});

export function startServer(port = PORT, host = "127.0.0.1") {
  return app.listen(port, host, () => {
    console.log(`StudyOps backend listening on http://127.0.0.1:${port}`);
  });
}

if (process.argv[1] === __filename) {
  startServer();
}
