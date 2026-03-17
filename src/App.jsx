import { useEffect, useMemo, useRef, useState } from "react";

import { api } from "./api";
import "./App.css";

const NAV_ITEMS = [
  { key: "dashboard", label: "Focus desk" },
  { key: "study", label: "Study plan" },
  { key: "labs", label: "Labs" },
  { key: "calendar", label: "Calendar" },
  { key: "activity", label: "Activity" },
];

const LAB_DIFFICULTIES = ["easy", "medium", "hard", "insane"];
const LAB_STATUSES = ["todo", "inprogress", "pwned", "stuck"];
const WRITEUP_STATUSES = ["none", "draft", "done", "published"];
const TIMER_MODES = {
  work: 25 * 60,
  short: 5 * 60,
  long: 15 * 60,
};

function createId(prefix) {
  if (globalThis.crypto?.randomUUID) {
    return `${prefix}_${globalThis.crypto.randomUUID()}`;
  }

  const buffer = new Uint32Array(2);
  globalThis.crypto?.getRandomValues?.(buffer);
  return `${prefix}_${Date.now()}_${Array.from(buffer).join("")}`;
}

function formatTimer(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatDate(dateValue, options = { month: "short", day: "numeric" }) {
  if (!dateValue) {
    return "No date";
  }

  return new Date(`${dateValue}T00:00:00`).toLocaleDateString("en-US", options);
}

function formatTimestamp(dateValue) {
  return new Date(dateValue).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function toDateKey(dateValue) {
  const parsed = new Date(dateValue);

  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatMonthLabel(dateValue) {
  return dateValue.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function buildCalendarDays(monthDate) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const startDate = new Date(year, month, 1 - firstDay.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const current = new Date(startDate);
    current.setDate(startDate.getDate() + index);

    return {
      key: toDateKey(current),
      dayNumber: current.getDate(),
      isCurrentMonth: current.getMonth() === month,
    };
  });
}

function getProgress(tasks) {
  if (!tasks.length) {
    return 0;
  }

  return Math.round((tasks.filter((task) => task.done).length / tasks.length) * 100);
}

function getHoursFromSessions(totalSessions) {
  return (totalSessions * 25) / 60;
}

function getFocusItems(appData) {
  return [
    ...appData.study.courses.map((course) => ({
      id: course.id,
      label: course.title,
      kind: "course",
      meta: course.provider,
    })),
    ...appData.study.certs.map((cert) => ({
      id: cert.id,
      label: cert.title,
      kind: "cert",
      meta: cert.vendor,
    })),
  ];
}

function getNextDeadlines(appData) {
  return [
    ...appData.study.courses
      .filter((course) => course.targetDate)
      .map((course) => ({
        id: course.id,
        title: course.title,
        type: "Course target",
        date: course.targetDate,
        note: course.provider,
      })),
    ...appData.study.certs
      .filter((cert) => cert.examDate)
      .map((cert) => ({
        id: cert.id,
        title: cert.title,
        type: "Certification exam",
        date: cert.examDate,
        note: cert.vendor,
      })),
    ...appData.labs.entries
      .filter((lab) => lab.completedAt)
      .map((lab) => ({
        id: lab.id,
        title: lab.name,
        type: "Lab completion",
        date: lab.completedAt,
        note: lab.platformKey.toUpperCase(),
      })),
  ].sort((left, right) => left.date.localeCompare(right.date));
}

function getCalendarItems(appData) {
  return [
    ...getNextDeadlines(appData).map((item) => ({
      id: `deadline-${item.type}-${item.id}`,
      title: item.title,
      type: item.type,
      dateKey: item.date,
      meta: item.note,
      detail: `${item.type} • ${item.note}`,
      kind: item.type.toLowerCase().replace(/\s+/g, "-"),
    })),
    ...appData.activity.map((item) => ({
      id: `activity-${item.id}`,
      title: item.label,
      type: "Activity",
      dateKey: toDateKey(item.occurredAt),
      meta: item.type,
      detail: item.detail,
      kind: "activity",
      occurredAt: item.occurredAt,
    })),
  ]
    .filter((item) => item.dateKey)
    .sort((left, right) => {
      if (left.dateKey !== right.dateKey) {
        return left.dateKey.localeCompare(right.dateKey);
      }

      return (right.occurredAt ?? "").localeCompare(left.occurredAt ?? "");
    });
}

function updateStudyItem(list, id, updater) {
  return list.map((item) => (item.id === id ? updater(item) : item));
}

function LoadingScreen({ message }) {
  return (
    <div className="loading-screen">
      <div className="loading-card">
        <div className="eyebrow">StudyOps</div>
        <h2>Loading workspace</h2>
        <p className="muted">{message}</p>
      </div>
    </div>
  );
}

function AuthScreen({
  mode,
  values,
  onChange,
  onSubmit,
  onModeChange,
  loading,
  error,
  serverOffline,
}) {
  return (
    <div className="auth-screen screen">
      <section className="auth-hero">
        <div>
          <span className="auth-kicker">Focused certification and lab tracker</span>
          <h1 className="auth-title">Study like an operator.</h1>
          <p className="auth-copy">
            StudyOps keeps your study plans, labs, and Pomodoro progress together in one protected workspace.
          </p>
          <div className="auth-points">
            <div className="auth-point">
              <strong>Protected account</strong>
              <p className="muted">Sign in to keep your workspace private and your progress tied to your account.</p>
            </div>
            <div className="auth-point">
              <strong>Desktop-first layout</strong>
              <p className="muted">A three-column workspace built for large screens, sticky context, and quick scanning.</p>
            </div>
            <div className="auth-point">
              <strong>Lasting study history</strong>
              <p className="muted">Courses, certifications, lab notes, and activity stay ready for your next session.</p>
            </div>
          </div>
        </div>
        <p className="subdued">Built for focused PC sessions, but still responsive when the viewport narrows.</p>
      </section>

      <section className="auth-panel-wrap">
        <div className="auth-panel">
          <div className="auth-switch" role="tablist" aria-label="Authentication mode">
            <button className={mode === "signin" ? "active" : ""} onClick={() => onModeChange("signin")}>
              Sign in
            </button>
            <button className={mode === "register" ? "active" : ""} onClick={() => onModeChange("register")}>
              Create account
            </button>
          </div>

          <div className="stack">
            <div>
              <div className="eyebrow">{mode === "signin" ? "Welcome back" : "New workspace"}</div>
              <h2>{mode === "signin" ? "Access your StudyOps desk" : "Create your protected study desk"}</h2>
              <p className="muted">
                {mode === "signin"
                  ? "Sign in to load your saved study plan, labs, and recent activity."
                  : "Register with your name, email, and password to create your own workspace."}
              </p>
            </div>

            {serverOffline ? (
              <div className="info-banner">StudyOps is temporarily unavailable. Try again in a moment.</div>
            ) : null}

            {error ? <div className="error-banner">{error}</div> : null}

            <form className="form-grid" onSubmit={onSubmit}>
              {mode === "register" ? (
                <div className="field">
                  <label htmlFor="name">Name</label>
                  <input
                    id="name"
                    name="name"
                    autoComplete="name"
                    value={values.name}
                    onChange={onChange}
                    placeholder="Your name"
                    maxLength={60}
                    required
                  />
                </div>
              ) : null}

              <div className="field">
                <label htmlFor="email">Email</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete={mode === "signin" ? "username" : "email"}
                  value={values.email}
                  onChange={onChange}
                  placeholder="you@example.com"
                  maxLength={120}
                  required
                />
              </div>

              <div className="field">
                <label htmlFor="password">Password</label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  value={values.password}
                  onChange={onChange}
                  placeholder="At least 10 characters"
                  minLength={10}
                  maxLength={128}
                  required
                />
              </div>

              <button className="primary-button" type="submit" disabled={loading || serverOffline}>
                {loading ? "Working..." : mode === "signin" ? "Sign in" : "Create account"}
              </button>
            </form>
          </div>
        </div>
      </section>
    </div>
  );
}

function Sidebar({ activeView, onViewChange, onLogout, user }) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">CF</div>
        <div>
          <div className="brand-name">StudyOps</div>
          <div className="brand-subtitle">Secure study operations desk</div>
        </div>
      </div>

      <nav className="nav-list" aria-label="Primary views">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.key}
            className={`nav-button ${activeView === item.key ? "active" : ""}`}
            onClick={() => onViewChange(item.key)}
          >
            <span>{item.label}</span>
            <span className="tiny-tag">{item.key}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="panel">
          <div className="eyebrow">Signed in</div>
          <h3 className="section-title">{user.name}</h3>
          <p className="muted">{user.email}</p>
        </div>
        <button className="quick-action" onClick={onLogout}>
          Sign out
        </button>
      </div>
    </aside>
  );
}

function RightRail({ user, appData, saveState, lastSavedAt }) {
  const totalStudySessions =
    appData.study.courses.reduce((sum, item) => sum + item.sessions, 0) +
    appData.study.certs.reduce((sum, item) => sum + item.sessions, 0);
  const pwnedLabs = appData.labs.entries.filter((lab) => lab.status === "pwned").length;
  const publishedWriteups = appData.labs.entries.filter((lab) => ["done", "published"].includes(lab.writeupStatus)).length;
  const nextDeadline = getNextDeadlines(appData)[0];

  return (
    <aside className="rail">
      <div className="rail-stack">
        <div className="panel">
          <div className="eyebrow">Profile</div>
          <h3 className="profile-name">{user.name}</h3>
          <div className="profile-email">{user.email}</div>
          <div className="divider" />
          <div className="mini-grid">
            <span className="tiny-tag good">Protected account</span>
            <span className={`tiny-tag ${saveState === "error" ? "bad" : "warn"}`}>
              {saveState === "saving"
                ? "Syncing"
                : saveState === "error"
                  ? "Sync issue"
                  : lastSavedAt
                    ? `Saved ${lastSavedAt}`
                    : "Saved"}
            </span>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <h3 className="panel-title">Quick stats</h3>
            <span className="tiny-tag">25m blocks</span>
          </div>
          <div className="stack">
            <div>
              <div className="metric-value">{totalStudySessions}</div>
              <div className="metric-note">{getHoursFromSessions(totalStudySessions).toFixed(1)} tracked study hours</div>
            </div>
            <div>
              <div className="metric-value">{pwnedLabs}</div>
              <div className="metric-note">Labs fully pwned</div>
            </div>
            <div>
              <div className="metric-value">{publishedWriteups}</div>
              <div className="metric-note">Writeups drafted or published</div>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <h3 className="panel-title">Upcoming</h3>
            <span className="tiny-tag warn">Next milestone</span>
          </div>
          {nextDeadline ? (
            <div className="stack">
              <strong>{nextDeadline.title}</strong>
              <div className="muted">{nextDeadline.type}</div>
              <div>{formatDate(nextDeadline.date, { month: "long", day: "numeric", year: "numeric" })}</div>
              <div className="tiny-tag">{nextDeadline.note}</div>
            </div>
          ) : (
            <p className="muted">Add a course target or exam date to see it here.</p>
          )}
        </div>
      </div>
    </aside>
  );
}

function MetricCard({ label, value, note }) {
  return (
    <div className="metric-card">
      <div className="metric-header">
        <span className="subdued">{label}</span>
      </div>
      <div className="metric-value">{value}</div>
      <div className="metric-note">{note}</div>
    </div>
  );
}

function TaskList({ tasks, onToggle, addValue, onAddValueChange, onAdd }) {
  return (
    <div className="stack">
      <div className="task-list">
        {tasks.map((task) => (
          <div key={task.id} className={`task-row ${task.done ? "done" : ""}`}>
            <label>
              <input type="checkbox" checked={task.done} onChange={() => onToggle(task.id)} />
              <span>{task.title}</span>
            </label>
          </div>
        ))}
      </div>

      <div className="inline-form">
        <div className="field">
          <label>Add checkpoint</label>
          <input value={addValue} onChange={onAddValueChange} placeholder="Add a small next action" maxLength={90} />
        </div>
        <button className="ghost-button" type="button" onClick={onAdd}>
          Add checkpoint
        </button>
      </div>
    </div>
  );
}

function DashboardView({
  appData,
  timerMode,
  secondsLeft,
  isRunning,
  onTimerModeChange,
  onTimerToggle,
  onTimerReset,
  focusItems,
  onFocusChange,
}) {
  const totalStudySessions =
    appData.study.courses.reduce((sum, item) => sum + item.sessions, 0) +
    appData.study.certs.reduce((sum, item) => sum + item.sessions, 0);
  const completedLabs = appData.labs.entries.filter((lab) => lab.status === "pwned").length;
  const publishedWriteups = appData.labs.entries.filter((lab) => ["done", "published"].includes(lab.writeupStatus)).length;
  const timerProgress = ((TIMER_MODES[timerMode] - secondsLeft) / TIMER_MODES[timerMode]) * 100;

  return (
    <div className="section">
      <div className="hero-card">
        <div className="hero-row">
          <div>
            <h3 className="hero-heading compact">StudyOps workspace</h3>
            <p className="muted">
              Track cert prep, lab progress, and writeups in one place.
            </p>
          </div>
          <div className="pill-row">
            <span className="tag">{focusItems.length} focus targets</span>
            <span className="tag">{appData.stats.completedPomodoros} completed Pomodoros</span>
          </div>
        </div>

        <div className="stats-grid">
          <MetricCard
            label="Study hours"
            value={getHoursFromSessions(totalStudySessions).toFixed(1)}
            note="Derived from tracked 25 minute sessions."
          />
          <MetricCard label="Labs pwned" value={completedLabs} note="Completed boxes and rooms across platforms." />
          <MetricCard label="Writeups ready" value={publishedWriteups} note="Drafted or fully published output." />
          <MetricCard label="Upcoming items" value={getNextDeadlines(appData).length} note="Deadlines and completions in your timeline." />
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="focus-card timer-shell">
          <div className="panel-head">
            <h3 className="panel-title">Pomodoro timer</h3>
            <span className="tiny-tag warn">{timerMode}</span>
          </div>
          <div className="timer-time">{formatTimer(secondsLeft)}</div>
          <div className="timer-progress">
            <span style={{ width: `${Math.max(0, Math.min(timerProgress, 100))}%` }} />
          </div>
          <div className="mode-list">
            {Object.keys(TIMER_MODES).map((mode) => (
              <button
                key={mode}
                type="button"
                className={`mode-button ${timerMode === mode ? "active" : ""}`}
                onClick={() => onTimerModeChange(mode)}
              >
                {mode}
              </button>
            ))}
          </div>
          <div className="button-row">
            <button className="primary-button" type="button" onClick={onTimerToggle}>
              {isRunning ? "Pause session" : "Start session"}
            </button>
            <button className="ghost-button" type="button" onClick={onTimerReset}>
              Reset
            </button>
          </div>
        </div>

        <div className="focus-card focus-grid">
          <div className="panel-head">
            <h3 className="panel-title">Focus target</h3>
            <span className="tiny-tag">Session routing</span>
          </div>
          <div className="field">
            <label htmlFor="focus-select">Link completed Pomodoros to</label>
            <select
              id="focus-select"
              value={appData.preferences.focusItemId}
              onChange={(event) => onFocusChange(event.target.value)}
            >
              <option value="">No linked item</option>
              {focusItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label} ({item.kind})
                </option>
              ))}
            </select>
          </div>
          <p className="muted">
            When a work session finishes, the linked course or certification gets another session count and a timeline entry.
          </p>
        </div>
      </div>
    </div>
  );
}

function StudyView({
  appData,
  forms,
  taskDrafts,
  onFormChange,
  onAddCourse,
  onAddCert,
  onStudyFieldChange,
  onTaskToggle,
  onTaskDraftChange,
  onTaskAdd,
}) {
  return (
    <div className="section">
      <div className="panel">
        <div className="panel-head">
          <div>
            <div className="eyebrow">New plan items</div>
            <h3 className="section-title">Track courses and certifications</h3>
          </div>
        </div>
        <div className="form-grid two">
          <form className="inline-form" onSubmit={onAddCourse}>
            <div className="field">
              <label>Course title</label>
              <input name="title" value={forms.course.title} onChange={(event) => onFormChange("course", event)} maxLength={80} required />
            </div>
            <div className="field">
              <label>Provider</label>
              <input name="provider" value={forms.course.provider} onChange={(event) => onFormChange("course", event)} maxLength={60} required />
            </div>
            <div className="form-grid two">
              <div className="field">
                <label>Start date</label>
                <input name="startDate" type="date" value={forms.course.startDate} onChange={(event) => onFormChange("course", event)} />
              </div>
              <div className="field">
                <label>Target date</label>
                <input name="targetDate" type="date" value={forms.course.targetDate} onChange={(event) => onFormChange("course", event)} />
              </div>
            </div>
            <div className="field">
              <label>Notes</label>
              <textarea name="notes" value={forms.course.notes} onChange={(event) => onFormChange("course", event)} maxLength={400} />
            </div>
            <button className="secondary-button" type="submit">
              Add course
            </button>
          </form>

          <form className="inline-form" onSubmit={onAddCert}>
            <div className="field">
              <label>Certification title</label>
              <input name="title" value={forms.cert.title} onChange={(event) => onFormChange("cert", event)} maxLength={80} required />
            </div>
            <div className="field">
              <label>Vendor</label>
              <input name="vendor" value={forms.cert.vendor} onChange={(event) => onFormChange("cert", event)} maxLength={60} required />
            </div>
            <div className="form-grid two">
              <div className="field">
                <label>Study start</label>
                <input name="studyStart" type="date" value={forms.cert.studyStart} onChange={(event) => onFormChange("cert", event)} />
              </div>
              <div className="field">
                <label>Exam date</label>
                <input name="examDate" type="date" value={forms.cert.examDate} onChange={(event) => onFormChange("cert", event)} />
              </div>
            </div>
            <div className="field">
              <label>Notes</label>
              <textarea name="notes" value={forms.cert.notes} onChange={(event) => onFormChange("cert", event)} maxLength={400} />
            </div>
            <button className="secondary-button" type="submit">
              Add cert
            </button>
          </form>
        </div>
      </div>

      <div className="item-grid">
        {appData.study.courses.map((course) => (
          <div className="course-card" key={course.id}>
            <div className="panel-head">
              <div>
                <h3 className="section-title">{course.title}</h3>
                <p className="muted">{course.provider}</p>
              </div>
              <div className="pill-row">
                <span className="tag">{course.sessions} sessions</span>
                <span className="tag">{getProgress(course.tasks)}% done</span>
              </div>
            </div>
            <div className="progress-line">
              <span style={{ width: `${getProgress(course.tasks)}%` }} />
            </div>
            <div className="form-grid two">
              <div className="field">
                <label>Start date</label>
                <input type="date" value={course.startDate} onChange={(event) => onStudyFieldChange("courses", course.id, "startDate", event.target.value)} />
              </div>
              <div className="field">
                <label>Target date</label>
                <input type="date" value={course.targetDate} onChange={(event) => onStudyFieldChange("courses", course.id, "targetDate", event.target.value)} />
              </div>
            </div>
            <div className="field">
              <label>Notes</label>
              <textarea value={course.notes} onChange={(event) => onStudyFieldChange("courses", course.id, "notes", event.target.value)} maxLength={400} />
            </div>
            <TaskList
              tasks={course.tasks}
              onToggle={(taskId) => onTaskToggle("courses", course.id, taskId)}
              addValue={taskDrafts[course.id] ?? ""}
              onAddValueChange={(event) => onTaskDraftChange(course.id, event.target.value)}
              onAdd={() => onTaskAdd("courses", course.id)}
            />
          </div>
        ))}

        {appData.study.certs.map((cert) => (
          <div className="cert-card" key={cert.id}>
            <div className="panel-head">
              <div>
                <h3 className="section-title">{cert.title}</h3>
                <p className="muted">{cert.vendor}</p>
              </div>
              <div className="pill-row">
                <span className="tag">{cert.sessions} sessions</span>
                <span className={`tiny-tag ${cert.passed ? "good" : "warn"}`}>{cert.passed ? "Passed" : "In progress"}</span>
              </div>
            </div>
            <div className="progress-line">
              <span style={{ width: `${getProgress(cert.tasks)}%` }} />
            </div>
            <div className="form-grid two">
              <div className="field">
                <label>Study start</label>
                <input type="date" value={cert.studyStart} onChange={(event) => onStudyFieldChange("certs", cert.id, "studyStart", event.target.value)} />
              </div>
              <div className="field">
                <label>Exam date</label>
                <input type="date" value={cert.examDate} onChange={(event) => onStudyFieldChange("certs", cert.id, "examDate", event.target.value)} />
              </div>
            </div>
            <div className="field">
              <label>Notes</label>
              <textarea value={cert.notes} onChange={(event) => onStudyFieldChange("certs", cert.id, "notes", event.target.value)} maxLength={400} />
            </div>
            <div className="field">
              <label>
                <input type="checkbox" checked={cert.passed} onChange={(event) => onStudyFieldChange("certs", cert.id, "passed", event.target.checked)} /> Certification passed
              </label>
            </div>
            <TaskList
              tasks={cert.tasks}
              onToggle={(taskId) => onTaskToggle("certs", cert.id, taskId)}
              addValue={taskDrafts[cert.id] ?? ""}
              onAddValueChange={(event) => onTaskDraftChange(cert.id, event.target.value)}
              onAdd={() => onTaskAdd("certs", cert.id)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function LabsView({
  appData,
  labForm,
  onLabFormChange,
  onLabAdd,
  onSelectedPlatformChange,
  onLabFieldChange,
}) {
  const visiblePlatform = appData.preferences.selectedLabPlatform || appData.labs.platforms[0]?.key || "";
  const visibleLabs = appData.labs.entries.filter((entry) => entry.platformKey === visiblePlatform);
  const platformColors = Object.fromEntries(appData.labs.platforms.map((platform) => [platform.key, platform.accent]));

  return (
    <div className="section">
      <div className="panel">
        <div className="panel-head">
          <div>
            <div className="eyebrow">Lab tracker</div>
            <h3 className="section-title">Add rooms, boxes, and writeup progress</h3>
          </div>
        </div>
        <form className="lab-form" onSubmit={onLabAdd}>
          <div className="form-grid two">
            <div className="field">
              <label>Lab name</label>
              <input name="name" value={labForm.name} onChange={onLabFormChange} maxLength={80} required />
            </div>
            <div className="field">
              <label>Platform</label>
              <select name="platformKey" value={labForm.platformKey} onChange={onLabFormChange} required>
                {appData.labs.platforms.map((platform) => (
                  <option key={platform.key} value={platform.key}>
                    {platform.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-grid two">
            <div className="field">
              <label>Difficulty</label>
              <select name="difficulty" value={labForm.difficulty} onChange={onLabFormChange}>
                {LAB_DIFFICULTIES.map((difficulty) => (
                  <option key={difficulty} value={difficulty}>
                    {difficulty}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Target OS</label>
              <input name="os" value={labForm.os} onChange={onLabFormChange} maxLength={24} />
            </div>
          </div>
          <div className="field">
            <label>Notes</label>
            <textarea name="notes" value={labForm.notes} onChange={onLabFormChange} maxLength={500} />
          </div>
          <button className="secondary-button" type="submit">
            Add lab entry
          </button>
        </form>
      </div>

      <div className="platform-filter">
        {appData.labs.platforms.map((platform) => (
          <button
            key={platform.key}
            type="button"
            className={`platform-chip ${platform.key === visiblePlatform ? "active" : ""}`}
            style={platform.key === visiblePlatform ? { background: platform.accent, borderColor: platform.accent } : {}}
            onClick={() => onSelectedPlatformChange(platform.key)}
          >
            {platform.name}
          </button>
        ))}
      </div>

      <div className="lab-grid">
        {visibleLabs.map((lab) => (
          <div className="lab-card" key={lab.id}>
            <div className="entry-row">
              <div>
                <h3 className="section-title">{lab.name}</h3>
                <p className="muted">{lab.os || "No OS set"}</p>
              </div>
              <div className="pill-row">
                <span className="tiny-tag" style={{ borderColor: platformColors[lab.platformKey], color: platformColors[lab.platformKey] }}>
                  {lab.platformKey.toUpperCase()}
                </span>
                <span className={`status-pill status-${lab.status}`}>{lab.status}</span>
              </div>
            </div>
            <div className="form-grid two">
              <div className="field">
                <label>Status</label>
                <select value={lab.status} onChange={(event) => onLabFieldChange(lab.id, "status", event.target.value)}>
                  {LAB_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Writeup</label>
                <select value={lab.writeupStatus} onChange={(event) => onLabFieldChange(lab.id, "writeupStatus", event.target.value)}>
                  {WRITEUP_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="form-grid two">
              <div className="field">
                <label>Difficulty</label>
                <select value={lab.difficulty} onChange={(event) => onLabFieldChange(lab.id, "difficulty", event.target.value)}>
                  {LAB_DIFFICULTIES.map((difficulty) => (
                    <option key={difficulty} value={difficulty}>
                      {difficulty}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Completed at</label>
                <input type="date" value={lab.completedAt} onChange={(event) => onLabFieldChange(lab.id, "completedAt", event.target.value)} />
              </div>
            </div>
            <div className="field">
              <label>Notes</label>
              <textarea value={lab.notes} onChange={(event) => onLabFieldChange(lab.id, "notes", event.target.value)} maxLength={500} />
            </div>
            <div className="field">
              <label>Writeup URL</label>
              <input
                type="url"
                value={lab.writeupUrl}
                onChange={(event) => onLabFieldChange(lab.id, "writeupUrl", event.target.value)}
                placeholder="https://"
              />
            </div>
            {lab.writeupUrl ? (
              <a href={lab.writeupUrl} target="_blank" rel="noopener noreferrer" className="ghost-button" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                Open writeup
              </a>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function CalendarView({ appData }) {
  const items = useMemo(() => getCalendarItems(appData), [appData]);
  const todayKey = toDateKey(new Date());
  const initialMonthKey = items[0]?.dateKey ?? todayKey;
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const initialDate = initialMonthKey ? new Date(`${initialMonthKey}T00:00:00`) : new Date();
    return new Date(initialDate.getFullYear(), initialDate.getMonth(), 1);
  });
  const [selectedDateKey, setSelectedDateKey] = useState(todayKey);

  const calendarDays = useMemo(() => buildCalendarDays(visibleMonth), [visibleMonth]);
  const itemsByDate = useMemo(
    () =>
      items.reduce((map, item) => {
        const group = map.get(item.dateKey) ?? [];
        group.push(item);
        map.set(item.dateKey, group);
        return map;
      }, new Map()),
    [items],
  );
  const selectedItems = itemsByDate.get(selectedDateKey) ?? [];
  const upcomingItems = items.filter((item) => item.dateKey >= todayKey).slice(0, 6);

  useEffect(() => {
    const monthPrefix = `${visibleMonth.getFullYear()}-${String(visibleMonth.getMonth() + 1).padStart(2, "0")}`;

    if (selectedDateKey.startsWith(monthPrefix)) {
      return;
    }

    const firstDayWithItems = calendarDays.find((day) => day.isCurrentMonth && itemsByDate.has(day.key));
    const fallbackDay = calendarDays.find((day) => day.isCurrentMonth);
    setSelectedDateKey(firstDayWithItems?.key ?? fallbackDay?.key ?? todayKey);
  }, [calendarDays, itemsByDate, selectedDateKey, todayKey, visibleMonth]);

  return (
    <div className="section">
      <div className="panel">
        <div className="panel-head">
          <div>
            <div className="eyebrow">Calendar</div>
            <h3 className="section-title">Calendar and activity tracker</h3>
            <p className="panel-copy">See study milestones and logged activity on an actual calendar.</p>
          </div>
          <div className="button-row">
            <button
              className="ghost-button"
              type="button"
              onClick={() => setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}
            >
              Prev
            </button>
            <button
              className="outline-button"
              type="button"
              onClick={() => setVisibleMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}
            >
              Today
            </button>
            <button
              className="ghost-button"
              type="button"
              onClick={() => setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}
            >
              Next
            </button>
          </div>
        </div>
      </div>
      <div className="calendar-layout">
        <div className="panel calendar-panel">
          <div className="calendar-toolbar">
            <h3 className="section-title">{formatMonthLabel(visibleMonth)}</h3>
            <span className="tiny-tag">{items.length} tracked items</span>
          </div>
          {items.length === 0 ? (
            <div className="empty-state">
              <h3 className="section-title">No dated activity yet</h3>
              <p className="muted">Add a course target, exam date, completed lab, or new activity and it will appear here.</p>
            </div>
          ) : null}
          <div className="calendar-weekdays" aria-hidden="true">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div className="calendar-grid">
            {calendarDays.map((day) => {
              const dayItems = itemsByDate.get(day.key) ?? [];

              return (
                <button
                  key={day.key}
                  type="button"
                  className={`calendar-day ${day.isCurrentMonth ? "" : "muted"} ${day.key === selectedDateKey ? "selected" : ""} ${day.key === todayKey ? "today" : ""}`}
                  onClick={() => setSelectedDateKey(day.key)}
                >
                  <span className="calendar-day-number">{day.dayNumber}</span>
                  <div className="calendar-markers">
                    {dayItems.slice(0, 3).map((item) => (
                      <span key={item.id} className={`calendar-marker marker-${item.kind}`} title={item.title} />
                    ))}
                  </div>
                  <span className="calendar-count">{dayItems.length > 0 ? `${dayItems.length} item${dayItems.length > 1 ? "s" : ""}` : ""}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="calendar-side">
          <div className="panel agenda-panel">
            <div className="panel-head">
              <div>
                <div className="eyebrow">Selected day</div>
                <h3 className="section-title">{formatDate(selectedDateKey, { month: "long", day: "numeric", year: "numeric" })}</h3>
              </div>
              <span className="tiny-tag">{selectedItems.length} entries</span>
            </div>
            <div className="agenda-list">
              {selectedItems.length ? (
                selectedItems.map((item) => (
                  <div className="agenda-item" key={item.id}>
                    <div className="entry-row">
                      <span className={`tiny-tag agenda-tag agenda-${item.kind}`}>{item.type}</span>
                      <span className="subdued">{item.meta}</span>
                    </div>
                    <h3 className="section-title">{item.title}</h3>
                    <p className="muted">{item.detail}</p>
                  </div>
                ))
              ) : (
                <p className="muted">No tracked activity on this day yet.</p>
              )}
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <div>
                <div className="eyebrow">Upcoming</div>
                <h3 className="section-title">Next milestones</h3>
              </div>
            </div>
            <div className="agenda-list">
              {upcomingItems.length ? (
                upcomingItems.map((item) => (
                  <div className="agenda-item compact" key={item.id}>
                    <div className="entry-row">
                      <span className={`tiny-tag agenda-tag agenda-${item.kind}`}>{item.type}</span>
                      <span className="subdued">{formatDate(item.dateKey, { month: "short", day: "numeric" })}</span>
                    </div>
                    <h3 className="section-title">{item.title}</h3>
                    <p className="muted">{item.meta}</p>
                  </div>
                ))
              ) : (
                <p className="muted">Upcoming deadlines and completions will appear here.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ActivityView({ appData }) {
  return (
    <div className="section">
      <div className="panel">
        <div className="panel-head">
          <div>
            <div className="eyebrow">Activity log</div>
            <h3 className="section-title">Recent authenticated events</h3>
          </div>
        </div>
      </div>
      <div className="entry-list">
        {appData.activity.length ? (
          appData.activity.map((item) => (
            <div className="activity-card" key={item.id}>
              <div className="entry-row">
                <span className="tiny-tag">{item.type}</span>
                <span className="subdued">{formatTimestamp(item.occurredAt)}</span>
              </div>
              <h3 className="section-title">{item.label}</h3>
              <p className="muted">{item.detail}</p>
            </div>
          ))
        ) : (
          <div className="activity-card">
            <h3 className="section-title">No activity yet</h3>
            <p className="muted">Your study actions and tracked updates will show up here as you use the workspace.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function AppShell({
  user,
  appData,
  activeView,
  setActiveView,
  saveState,
  lastSavedAt,
  onLogout,
  dashboardProps,
  studyProps,
  labsProps,
}) {
  return (
    <div className="app-shell screen">
      <Sidebar activeView={activeView} onViewChange={setActiveView} onLogout={onLogout} user={user} />
      <main className="content">
        <div className="topbar">
          <div>
            <h2>{NAV_ITEMS.find((item) => item.key === activeView)?.label ?? "Workspace"}</h2>
            <p>Your workspace is protected and saves automatically while you work.</p>
          </div>
          <div className="topbar-actions">
            <div className={`save-pill ${saveState === "error" ? "error" : ""}`}>
              {saveState === "saving"
                ? "Saving changes..."
                : saveState === "error"
                  ? "Sync error"
                  : lastSavedAt
                    ? `Saved ${lastSavedAt}`
                    : "Saved"}
            </div>
          </div>
        </div>

        {activeView === "dashboard" ? <DashboardView appData={appData} {...dashboardProps} /> : null}
        {activeView === "study" ? <StudyView appData={appData} {...studyProps} /> : null}
        {activeView === "labs" ? <LabsView appData={appData} {...labsProps} /> : null}
        {activeView === "calendar" ? <CalendarView appData={appData} /> : null}
        {activeView === "activity" ? <ActivityView appData={appData} /> : null}
      </main>
      <RightRail user={user} appData={appData} saveState={saveState} lastSavedAt={lastSavedAt} />
    </div>
  );
}

export default function App() {
  const [authStatus, setAuthStatus] = useState("loading");
  const [authMode, setAuthMode] = useState("signin");
  const [authValues, setAuthValues] = useState({ name: "", email: "", password: "" });
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [serverOffline, setServerOffline] = useState(false);
  const [user, setUser] = useState(null);
  const [appData, setAppData] = useState(null);
  const [saveState, setSaveState] = useState("saved");
  const [lastSavedAt, setLastSavedAt] = useState("");
  const [activeView, setActiveView] = useState("dashboard");
  const [studyForms, setStudyForms] = useState({
    course: { title: "", provider: "", startDate: "", targetDate: "", notes: "" },
    cert: { title: "", vendor: "", studyStart: "", examDate: "", notes: "" },
  });
  const [labForm, setLabForm] = useState({
    platformKey: "htb",
    name: "",
    difficulty: "easy",
    os: "",
    notes: "",
  });
  const [taskDrafts, setTaskDrafts] = useState({});
  const [timerMode, setTimerMode] = useState("work");
  const [secondsLeft, setSecondsLeft] = useState(TIMER_MODES.work);
  const [isRunning, setIsRunning] = useState(false);

  const skipFirstSave = useRef(true);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      try {
        const session = await api.getSession();

        if (cancelled) {
          return;
        }

        setServerOffline(false);
        setUser(session.user);
        setAppData(session.appData);
        setActiveView(session.appData.preferences.activeView || "dashboard");
        setLabForm((current) => ({
          ...current,
          platformKey: session.appData.labs.platforms[0]?.key ?? current.platformKey,
        }));
        setAuthStatus("authenticated");
      } catch (error) {
        if (cancelled) {
          return;
        }

        if (error.status === 401) {
          api.clearSession();
          setAuthStatus("anonymous");
          setServerOffline(false);
          return;
        }

        setServerOffline(true);
        setAuthStatus("anonymous");
      }
    }

    bootstrap();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!appData) {
      return;
    }

    setAppData((current) => ({
      ...current,
      preferences: {
        ...current.preferences,
        activeView,
      },
    }));
  }, [activeView]);

  useEffect(() => {
    if (!appData || authStatus !== "authenticated") {
      return;
    }

    if (skipFirstSave.current) {
      skipFirstSave.current = false;
      return;
    }

    setSaveState("saving");
    const timeoutId = window.setTimeout(async () => {
      try {
        const response = await api.saveAppData(appData);
        setSaveState("saved");
        setServerOffline(false);
        setLastSavedAt(new Date(response.savedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
      } catch {
        setSaveState("error");
        setServerOffline(true);
      }
    }, 550);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [appData, authStatus]);

  useEffect(() => {
    if (!isRunning) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setSecondsLeft((current) => {
        if (current > 1) {
          return current - 1;
        }

        setIsRunning(false);

        setAppData((currentData) => {
          if (!currentData) {
            return currentData;
          }

          const focusId = currentData.preferences.focusItemId;
          const focusCourse = currentData.study.courses.find((item) => item.id === focusId);
          const focusCert = currentData.study.certs.find((item) => item.id === focusId);
          const label = focusCourse?.title || focusCert?.title || "Unlinked session";

          return {
            ...currentData,
            stats: {
              ...currentData.stats,
              completedPomodoros: currentData.stats.completedPomodoros + 1,
            },
            study: {
              ...currentData.study,
              courses: focusCourse
                ? updateStudyItem(currentData.study.courses, focusId, (item) => ({
                    ...item,
                    sessions: item.sessions + 1,
                  }))
                : currentData.study.courses,
              certs: focusCert
                ? updateStudyItem(currentData.study.certs, focusId, (item) => ({
                    ...item,
                    sessions: item.sessions + 1,
                  }))
                : currentData.study.certs,
            },
            activity: [
              {
                id: createId("activity"),
                type: "timer",
                label: "Pomodoro completed",
                detail: `Finished a ${timerMode} block for ${label}.`,
                occurredAt: new Date().toISOString(),
              },
              ...currentData.activity,
            ].slice(0, 120),
          };
        });

        return TIMER_MODES[timerMode];
      });
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isRunning, timerMode]);

  const focusItems = useMemo(() => (appData ? getFocusItems(appData) : []), [appData]);

  function updateAppData(updater) {
    setAppData((current) => (current ? updater(current) : current));
  }

  function handleAuthFieldChange(event) {
    const { name, value } = event.target;
    setAuthValues((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function handleAuthSubmit(event) {
    event.preventDefault();
    setAuthError("");
    setAuthLoading(true);

    try {
      const response =
        authMode === "signin"
          ? await api.login({
              email: authValues.email,
              password: authValues.password,
            })
          : await api.register(authValues);

      setServerOffline(false);
      setUser(response.user);
      setAppData(response.appData);
      setActiveView(response.appData.preferences.activeView || "dashboard");
      setLabForm((current) => ({
        ...current,
        platformKey: response.appData.labs.platforms[0]?.key ?? current.platformKey,
      }));
      setAuthValues({ name: "", email: "", password: "" });
      setAuthStatus("authenticated");
      skipFirstSave.current = true;
    } catch (error) {
      setAuthError(error.message);
      if (!error.status) {
        setServerOffline(true);
      }
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleLogout() {
    try {
      await api.logout();
    } catch {
      // Ignore logout race conditions and clear local state anyway.
    }

    api.clearSession();
    setIsRunning(false);
    setUser(null);
    setAppData(null);
    setAuthStatus("anonymous");
    setSaveState("saved");
    setLastSavedAt("");
    setServerOffline(false);
    skipFirstSave.current = true;
  }

  function handleStudyFormChange(kind, event) {
    const { name, value } = event.target;
    setStudyForms((current) => ({
      ...current,
      [kind]: {
        ...current[kind],
        [name]: value,
      },
    }));
  }

  function appendActivity(currentData, label, detail, type = "update") {
    return [
      {
        id: createId("activity"),
        type,
        label,
        detail,
        occurredAt: new Date().toISOString(),
      },
      ...currentData.activity,
    ].slice(0, 120);
  }

  function handleAddCourse(event) {
    event.preventDefault();

    updateAppData((current) => ({
      ...current,
      study: {
        ...current.study,
        courses: [
          ...current.study.courses,
          {
            id: createId("course"),
            title: studyForms.course.title.trim(),
            provider: studyForms.course.provider.trim(),
            startDate: studyForms.course.startDate,
            targetDate: studyForms.course.targetDate,
            sessions: 0,
            notes: studyForms.course.notes.trim(),
            tasks: [],
          },
        ],
      },
      activity: appendActivity(current, "Course added", `Added ${studyForms.course.title.trim()} to the study board.`),
    }));

    setStudyForms((current) => ({
      ...current,
      course: { title: "", provider: "", startDate: "", targetDate: "", notes: "" },
    }));
  }

  function handleAddCert(event) {
    event.preventDefault();

    updateAppData((current) => ({
      ...current,
      study: {
        ...current.study,
        certs: [
          ...current.study.certs,
          {
            id: createId("cert"),
            title: studyForms.cert.title.trim(),
            vendor: studyForms.cert.vendor.trim(),
            studyStart: studyForms.cert.studyStart,
            examDate: studyForms.cert.examDate,
            sessions: 0,
            passed: false,
            notes: studyForms.cert.notes.trim(),
            tasks: [],
          },
        ],
      },
      activity: appendActivity(current, "Certification added", `Added ${studyForms.cert.title.trim()} to the exam plan.`),
    }));

    setStudyForms((current) => ({
      ...current,
      cert: { title: "", vendor: "", studyStart: "", examDate: "", notes: "" },
    }));
  }

  function handleStudyFieldChange(collection, id, field, value) {
    updateAppData((current) => ({
      ...current,
      study: {
        ...current.study,
        [collection]: updateStudyItem(current.study[collection], id, (item) => ({
          ...item,
          [field]: value,
        })),
      },
    }));
  }

  function handleTaskToggle(collection, itemId, taskId) {
    updateAppData((current) => ({
      ...current,
      study: {
        ...current.study,
        [collection]: updateStudyItem(current.study[collection], itemId, (item) => ({
          ...item,
          tasks: item.tasks.map((task) => (task.id === taskId ? { ...task, done: !task.done } : task)),
        })),
      },
    }));
  }

  function handleTaskDraftChange(itemId, value) {
    setTaskDrafts((current) => ({
      ...current,
      [itemId]: value,
    }));
  }

  function handleTaskAdd(collection, itemId) {
    const draft = (taskDrafts[itemId] || "").trim();

    if (!draft) {
      return;
    }

    updateAppData((current) => ({
      ...current,
      study: {
        ...current.study,
        [collection]: updateStudyItem(current.study[collection], itemId, (item) => ({
          ...item,
          tasks: [...item.tasks, { id: createId("task"), title: draft, done: false }],
        })),
      },
    }));

    setTaskDrafts((current) => ({
      ...current,
      [itemId]: "",
    }));
  }

  function handleLabFormChange(event) {
    const { name, value } = event.target;
    setLabForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function handleLabAdd(event) {
    event.preventDefault();

    updateAppData((current) => ({
      ...current,
      preferences: {
        ...current.preferences,
        selectedLabPlatform: labForm.platformKey,
      },
      labs: {
        ...current.labs,
        entries: [
          ...current.labs.entries,
          {
            id: createId("lab"),
            platformKey: labForm.platformKey,
            name: labForm.name.trim(),
            difficulty: labForm.difficulty,
            status: "todo",
            writeupStatus: "none",
            os: labForm.os.trim(),
            notes: labForm.notes.trim(),
            writeupUrl: "",
            completedAt: "",
          },
        ],
      },
      activity: appendActivity(current, "Lab added", `Added ${labForm.name.trim()} under ${labForm.platformKey.toUpperCase()}.`),
    }));

    setLabForm((current) => ({
      ...current,
      name: "",
      difficulty: "easy",
      os: "",
      notes: "",
    }));
  }

  function handleSelectedPlatformChange(platformKey) {
    updateAppData((current) => ({
      ...current,
      preferences: {
        ...current.preferences,
        selectedLabPlatform: platformKey,
      },
    }));
  }

  function handleLabFieldChange(id, field, value) {
    updateAppData((current) => ({
      ...current,
      labs: {
        ...current.labs,
        entries: current.labs.entries.map((entry) => (entry.id === id ? { ...entry, [field]: value } : entry)),
      },
    }));
  }

  function handleTimerModeChange(mode) {
    setTimerMode(mode);
    setSecondsLeft(TIMER_MODES[mode]);
    setIsRunning(false);
  }

  function handleTimerToggle() {
    setIsRunning((current) => !current);
  }

  function handleTimerReset() {
    setIsRunning(false);
    setSecondsLeft(TIMER_MODES[timerMode]);
  }

  function handleFocusChange(value) {
    updateAppData((current) => ({
      ...current,
      preferences: {
        ...current.preferences,
        focusItemId: value,
      },
    }));
  }

  if (authStatus === "loading") {
    return <LoadingScreen message="Checking for an active session." />;
  }

  if (authStatus !== "authenticated" || !user || !appData) {
    return (
      <AuthScreen
        mode={authMode}
        values={authValues}
        onChange={handleAuthFieldChange}
        onSubmit={handleAuthSubmit}
        onModeChange={setAuthMode}
        loading={authLoading}
        error={authError}
        serverOffline={serverOffline}
      />
    );
  }

  return (
    <AppShell
      user={user}
      appData={appData}
      activeView={activeView}
      setActiveView={setActiveView}
      saveState={saveState}
      lastSavedAt={lastSavedAt}
      onLogout={handleLogout}
      dashboardProps={{
        timerMode,
        secondsLeft,
        isRunning,
        onTimerModeChange: handleTimerModeChange,
        onTimerToggle: handleTimerToggle,
        onTimerReset: handleTimerReset,
        focusItems,
        onFocusChange: handleFocusChange,
      }}
      studyProps={{
        forms: studyForms,
        taskDrafts,
        onFormChange: handleStudyFormChange,
        onAddCourse: handleAddCourse,
        onAddCert: handleAddCert,
        onStudyFieldChange: handleStudyFieldChange,
        onTaskToggle: handleTaskToggle,
        onTaskDraftChange: handleTaskDraftChange,
        onTaskAdd: handleTaskAdd,
      }}
      labsProps={{
        labForm,
        onLabFormChange: handleLabFormChange,
        onLabAdd: handleLabAdd,
        onSelectedPlatformChange: handleSelectedPlatformChange,
        onLabFieldChange: handleLabFieldChange,
      }}
    />
  );
}
