import crypto from "node:crypto";

function makeId(prefix) {
  return `${prefix}_${crypto.randomUUID()}`;
}

const DEFAULT_PLATFORMS = [
  { key: "htb", name: "Hack The Box", accent: "#7bd88f" },
  { key: "thm", name: "TryHackMe", accent: "#ff8c69" },
  { key: "portswigger", name: "PortSwigger", accent: "#ff6b35" },
];
const LEGACY_COURSE_KEYS = new Set([
  "Linux Privilege Escalation::TryHackMe",
  "Web Exploitation Path::HackSmarter",
]);
const LEGACY_CERT_KEYS = new Set(["CompTIA Security+::CompTIA"]);
const LEGACY_LAB_KEYS = new Set(["Lame::htb", "OWASP Top 10::thm"]);
const LEGACY_PLATFORM_KEYS = new Set(["hs"]);
const LEGACY_ACTIVITY_DETAIL = "Your courses, cert goals, and labs now sync from the backend.";

function createWelcomeActivity() {
  return {
    id: makeId("activity"),
    type: "system",
    label: "Workspace ready",
    detail: "Add your first course, certification, or lab to start building your study plan.",
    occurredAt: new Date().toISOString(),
  };
}

export function createSeedAppData() {
  return {
    preferences: {
      activeView: "dashboard",
      selectedLabPlatform: "htb",
      focusItemId: "",
      timerDurations: {
        work: 25,
        short: 5,
        long: 15,
      },
    },
    stats: {
      completedPomodoros: 0,
    },
    study: {
      courses: [],
      certs: [],
    },
    labs: {
      platforms: DEFAULT_PLATFORMS.map((platform) => ({ ...platform })),
      entries: [],
    },
    activity: [createWelcomeActivity()],
  };
}

export function removeLegacySeedContent(appData, displayName) {
  if (!appData || typeof appData !== "object" || Array.isArray(appData)) {
    return appData;
  }

  const currentStudy = appData.study && typeof appData.study === "object" ? appData.study : {};
  const currentLabs = appData.labs && typeof appData.labs === "object" ? appData.labs : {};
  const currentPreferences =
    appData.preferences && typeof appData.preferences === "object" ? appData.preferences : {};
  const firstName = displayName.trim().split(/\s+/)[0] || "operator";

  const nextCourses = Array.isArray(currentStudy.courses)
    ? currentStudy.courses.filter(
        (course) => !LEGACY_COURSE_KEYS.has(`${course?.title ?? ""}::${course?.provider ?? ""}`),
      )
    : [];
  const nextCerts = Array.isArray(currentStudy.certs)
    ? currentStudy.certs.filter(
        (cert) => !LEGACY_CERT_KEYS.has(`${cert?.title ?? ""}::${cert?.vendor ?? ""}`),
      )
    : [];
  const nextPlatforms = Array.isArray(currentLabs.platforms)
    ? currentLabs.platforms.filter((platform) => !LEGACY_PLATFORM_KEYS.has(platform?.key ?? ""))
    : [];
  const ensuredPlatforms =
    nextPlatforms.length > 0
      ? nextPlatforms
      : DEFAULT_PLATFORMS.map((platform) => ({ ...platform }));
  const allowedPlatformKeys = new Set(ensuredPlatforms.map((platform) => platform.key));
  const nextEntries = Array.isArray(currentLabs.entries)
    ? currentLabs.entries.filter(
        (lab) =>
          !LEGACY_PLATFORM_KEYS.has(lab?.platformKey ?? "") &&
          !LEGACY_LAB_KEYS.has(`${lab?.name ?? ""}::${lab?.platformKey ?? ""}`) &&
          allowedPlatformKeys.has(lab?.platformKey ?? ""),
      )
    : [];
  const nextActivity = Array.isArray(appData.activity)
    ? appData.activity.filter(
        (activity) =>
          !(
            activity?.type === "system" &&
            activity?.label === `Workspace created for ${firstName}` &&
            activity?.detail === LEGACY_ACTIVITY_DETAIL
          ),
      )
    : [];
  const focusIds = new Set([
    ...nextCourses.map((course) => course.id),
    ...nextCerts.map((cert) => cert.id),
  ]);
  const nextFocusItemId = focusIds.has(currentPreferences.focusItemId)
    ? currentPreferences.focusItemId
    : "";
  const currentTimerDurations =
    currentPreferences.timerDurations && typeof currentPreferences.timerDurations === "object"
      ? currentPreferences.timerDurations
      : {};
  const nextTimerDurations = {
    work: Number.isInteger(currentTimerDurations.work) ? currentTimerDurations.work : 25,
    short: Number.isInteger(currentTimerDurations.short) ? currentTimerDurations.short : 5,
    long: Number.isInteger(currentTimerDurations.long) ? currentTimerDurations.long : 15,
  };
  const nextSelectedLabPlatform = allowedPlatformKeys.has(currentPreferences.selectedLabPlatform)
    ? currentPreferences.selectedLabPlatform
    : ensuredPlatforms[0]?.key ?? "";
  const changed =
    nextCourses.length !== (Array.isArray(currentStudy.courses) ? currentStudy.courses.length : 0) ||
    nextCerts.length !== (Array.isArray(currentStudy.certs) ? currentStudy.certs.length : 0) ||
    ensuredPlatforms.length !== (Array.isArray(currentLabs.platforms) ? currentLabs.platforms.length : 0) ||
    nextEntries.length !== (Array.isArray(currentLabs.entries) ? currentLabs.entries.length : 0) ||
    nextActivity.length !== (Array.isArray(appData.activity) ? appData.activity.length : 0) ||
    nextFocusItemId !== (currentPreferences.focusItemId ?? "") ||
    nextSelectedLabPlatform !== (currentPreferences.selectedLabPlatform ?? "");

  if (!changed) {
    return appData;
  }

  return {
    ...appData,
    preferences: {
      ...currentPreferences,
      activeView:
        typeof currentPreferences.activeView === "string" ? currentPreferences.activeView : "dashboard",
      selectedLabPlatform: nextSelectedLabPlatform,
      focusItemId: nextFocusItemId,
      timerDurations: nextTimerDurations,
    },
    stats: {
      completedPomodoros: Number.isInteger(appData?.stats?.completedPomodoros)
        ? appData.stats.completedPomodoros
        : 0,
    },
    study: {
      ...currentStudy,
      courses: nextCourses,
      certs: nextCerts,
    },
    labs: {
      ...currentLabs,
      platforms: ensuredPlatforms,
      entries: nextEntries,
    },
    activity: nextActivity.length > 0 ? nextActivity : [createWelcomeActivity()],
  };
}
