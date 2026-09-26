const fs = require("node:fs/promises");
const path = require("node:path");
const http = require("node:http");
const crypto = require("node:crypto");
const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events.readonly",
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
];

function validateClient(raw) {
  const client = raw?.installed;
  if (
    !client ||
    typeof client.client_id !== "string" ||
    !/^[-\w.]+\.apps\.googleusercontent\.com$/.test(client.client_id) ||
    typeof client.client_secret !== "string" ||
    !client.client_secret ||
    client.client_secret.length > 4096
  )
    throw Error("Choose a Google OAuth Desktop app credentials JSON file.");
  return { id: client.client_id, secret: client.client_secret };
}
function createGoogleCalendar({
  safeStorage,
  shell,
  dialog,
  getWindow,
  dataPath,
}) {
  const file = path.join(dataPath, "google-calendar.enc");
  let busy = false;
  async function exclusive(fn) {
    if (busy)
      throw Error("Google Calendar is busy. Wait for the current request.");
    busy = true;
    try {
      return await fn();
    } finally {
      busy = false;
    }
  }
  function ensureEncryption() {
    if (
      !safeStorage.isEncryptionAvailable() ||
      safeStorage.getSelectedStorageBackend?.() === "basic_text"
    )
      throw Error("Secure credential storage is unavailable on this computer.");
  }
  async function read() {
    ensureEncryption();
    try {
      return JSON.parse(safeStorage.decryptString(await fs.readFile(file)));
    } catch (error) {
      if (error.code === "ENOENT") return {};
      throw Error(
        "Google credentials could not be unlocked. Import your Desktop client again.",
      );
    }
  }
  async function write(value) {
    ensureEncryption();
    await fs.mkdir(dataPath, { recursive: true });
    const temp = file + ".tmp";
    await fs.writeFile(temp, safeStorage.encryptString(JSON.stringify(value)));
    await fs.rename(temp, file);
  }
  function state(value) {
    return {
      configured: !!value.client,
      connected: !!value.refreshToken,
      calendarId: value.calendarId || "",
      calendars: value.calendars || [],
    };
  }
  async function jsonRequest(url, options = {}) {
    let response;
    try {
      response = await fetch(url, {
        ...options,
        redirect: "error",
        signal: AbortSignal.timeout(30000),
      });
    } catch {
      throw Error(
        "Could not reach Google. Check your connection and try again.",
      );
    }
    const text = await response.text();
    if (text.length > 20 * 1024 * 1024)
      throw Error("Google response was too large.");
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      throw Error("Google returned an unreadable response.");
    }
    return { response, body };
  }
  async function tokenRequest(params) {
    return jsonRequest("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(params),
    });
  }
  async function access(value) {
    if (value.accessToken && value.expiresAt > Date.now() + 60000)
      return value.accessToken;
    if (!value.client || !value.refreshToken)
      throw Error("Connect Google Calendar first.");
    const { response, body } = await tokenRequest({
      client_id: value.client.id,
      client_secret: value.client.secret,
      refresh_token: value.refreshToken,
      grant_type: "refresh_token",
    });
    if (!response.ok) {
      if (body.error === "invalid_grant") {
        delete value.refreshToken;
        delete value.accessToken;
        await write(value);
        throw Error("Google access expired or was revoked. Connect again.");
      }
      throw Error("Google could not refresh access. Try reconnecting.");
    }
    if (typeof body.access_token !== "string")
      throw Error("Google did not return an access token.");
    value.accessToken = body.access_token;
    value.expiresAt = Date.now() + Number(body.expires_in || 3600) * 1000;
    await write(value);
    return value.accessToken;
  }
  async function api(value, route, params = {}) {
    const url = new URL("https://www.googleapis.com/calendar/v3/" + route);
    for (const [key, entry] of Object.entries(params))
      url.searchParams.set(key, String(entry));
    let result = await jsonRequest(url, {
      headers: { Authorization: "Bearer " + (await access(value)) },
    });
    if (result.response.status === 401) {
      value.expiresAt = 0;
      result = await jsonRequest(url, {
        headers: { Authorization: "Bearer " + (await access(value)) },
      });
    }
    if (!result.response.ok)
      throw Error(
        result.response.status === 403
          ? "Google denied calendar access. Check permissions and that Calendar API is enabled."
          : result.response.status === 429
            ? "Google request limit reached. Try again later."
            : "Google Calendar request failed. Try again.",
      );
    return result.body;
  }
  async function loadCalendars(value) {
    const calendars = [];
    let pageToken;
    do {
      const body = await api(value, "users/me/calendarList", {
        maxResults: 250,
        fields: "items(id,summary,primary,accessRole),nextPageToken",
        ...(pageToken ? { pageToken } : {}),
      });
      for (const calendar of body.items || [])
        if (["owner", "writer", "reader"].includes(calendar.accessRole))
          calendars.push({
            id: calendar.id,
            name: calendar.summary || calendar.id,
            primary: !!calendar.primary,
          });
      pageToken = body.nextPageToken;
      if (calendars.length > 1000) throw Error("Too many calendars.");
    } while (pageToken);
    value.calendars = calendars;
    if (!calendars.some((c) => c.id === value.calendarId))
      value.calendarId =
        calendars.find((c) => c.primary)?.id || calendars[0]?.id || "";
    await write(value);
  }
  async function authorizationCode(client) {
    const verifier = crypto.randomBytes(48).toString("base64url"),
      state = crypto.randomBytes(32).toString("base64url");
    const challenge = crypto
      .createHash("sha256")
      .update(verifier)
      .digest("base64url");
    let resolveCode, rejectCode, timer;
    const pending = new Promise((resolve, reject) => {
      resolveCode = resolve;
      rejectCode = reject;
    });
    // Attach a handler immediately; browser launch can fail before awaiting the callback.
    pending.catch(() => {});
    const server = http.createServer((request, response) => {
      const url = new URL(request.url, "http://127.0.0.1");
      response.setHeader("Content-Type", "text/plain; charset=utf-8");
      response.setHeader("Cache-Control", "no-store");
      response.setHeader("Content-Security-Policy", "default-src 'none'");
      if (
        request.method !== "GET" ||
        url.pathname !== "/oauth/callback" ||
        url.searchParams.get("state") !== state
      ) {
        response.writeHead(400);
        response.end("Invalid authorization callback.");
        return;
      }
      if (url.searchParams.has("error")) {
        response.end("Access was not granted. Return to TutorTrack.");
        rejectCode(Error("Google authorization was cancelled."));
        return;
      }
      const code = url.searchParams.get("code");
      if (!code || code.length > 8192) {
        response.writeHead(400);
        response.end("Missing code.");
        return;
      }
      response.end(
        "Authorization received. You can close this tab and return to TutorTrack to check the connection.",
      );
      resolveCode(code);
    });
    try {
      await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", resolve);
      });
      const redirect =
        "http://127.0.0.1:" + server.address().port + "/oauth/callback";
      const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      for (const [key, value] of Object.entries({
        client_id: client.id,
        redirect_uri: redirect,
        response_type: "code",
        scope: SCOPES.join(" "),
        state,
        code_challenge: challenge,
        code_challenge_method: "S256",
        access_type: "offline",
        prompt: "consent select_account",
      }))
        url.searchParams.set(key, value);
      timer = setTimeout(
        () =>
          rejectCode(Error("Google sign-in timed out. Try connecting again.")),
        5 * 60 * 1000,
      );
      await shell.openExternal(url.toString());
      return { code: await pending, verifier, redirect };
    } finally {
      clearTimeout(timer);
      server.close();
      server.closeAllConnections?.();
    }
  }
  return {
    status: async () => state(await read()),
    importClient: () =>
      exclusive(async () => {
        const selected = await dialog.showOpenDialog(getWindow(), {
          title: "Choose Google Desktop OAuth credentials",
          properties: ["openFile"],
          filters: [{ name: "Google client JSON", extensions: ["json"] }],
        });
        if (selected.canceled) return state(await read());
        const stat = await fs.stat(selected.filePaths[0]);
        if (stat.size > 64 * 1024) throw Error("Credential file is too large.");
        let raw;
        try {
          raw = JSON.parse(await fs.readFile(selected.filePaths[0], "utf8"));
        } catch {
          throw Error("Could not read the credentials JSON.");
        }
        const client = validateClient(raw);
        await write({ client });
        return state({ client });
      }),
    connect: () =>
      exclusive(async () => {
        const previous = await read();
        if (!previous.client)
          throw Error("Import a Google Desktop OAuth client first.");
        const { code, verifier, redirect } = await authorizationCode(
          previous.client,
        );
        const { response, body } = await tokenRequest({
          client_id: previous.client.id,
          client_secret: previous.client.secret,
          code,
          code_verifier: verifier,
          redirect_uri: redirect,
          grant_type: "authorization_code",
        });
        if (!response.ok || !body.refresh_token || !body.access_token)
          throw Error(
            "Google did not grant access. Connect again and allow the requested read-only permissions.",
          );
        if (
          body.scope &&
          SCOPES.some((scope) => !body.scope.split(" ").includes(scope))
        )
          throw Error(
            "Both requested read-only calendar permissions are needed.",
          );
        const value = {
          client: previous.client,
          refreshToken: body.refresh_token,
          accessToken: body.access_token,
          expiresAt: Date.now() + Number(body.expires_in || 3600) * 1000,
        };
        await write(value);
        await loadCalendars(value);
        return state(value);
      }),
    calendars: () =>
      exclusive(async () => {
        const value = await read();
        await loadCalendars(value);
        return state(value);
      }),
    select: (calendarId) =>
      exclusive(async () => {
        const value = await read();
        if (
          typeof calendarId !== "string" ||
          !value.calendars?.some((c) => c.id === calendarId)
        )
          throw Error("Choose an available calendar.");
        value.calendarId = calendarId;
        await write(value);
        return state(value);
      }),
    disconnect: () =>
      exclusive(async () => {
        const value = await read();
        await write(value.client ? { client: value.client } : {});
        return state(value.client ? { client: value.client } : {});
      }),
    events: (knownIds) =>
      exclusive(async () => {
        if (
          !Array.isArray(knownIds) ||
          knownIds.length > 5000 ||
          knownIds.some((id) => typeof id !== "string" || id.length > 1024)
        )
          throw Error("Invalid sync request.");
        const value = await read();
        if (!value.calendarId) throw Error("Choose a calendar first.");
        const from = new Date();
        from.setDate(from.getDate() - 30);
        const until = new Date();
        until.setDate(until.getDate() + 365);
        const events = [];
        const known = new Set(knownIds);
        let pageToken,
          total = 0;
        do {
          const body = await api(
            value,
            "calendars/" + encodeURIComponent(value.calendarId) + "/events",
            {
              timeMin: from.toISOString(),
              timeMax: until.toISOString(),
              singleEvents: true,
              showDeleted: true,
              maxResults: 2500,
              fields:
                "items(id,summary,description,location,status,updated,start,end),nextPageToken",
              ...(pageToken ? { pageToken } : {}),
            },
          );
          for (const event of body.items || []) {
            total++;
            if (
              (event.summary || "").trim().toLowerCase() === "tutoring work" ||
              known.has(event.id)
            )
              events.push(event);
          }
          if (total > 20000 || events.length > 5000)
            throw Error("Too many calendar events to import at once.");
          pageToken = body.nextPageToken;
        } while (pageToken);
        return { calendarId: value.calendarId, events };
      }),
  };
}
module.exports = { createGoogleCalendar, validateClient };
