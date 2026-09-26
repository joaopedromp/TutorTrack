import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { createRequire } from "node:module";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
const { createGoogleCalendar, validateClient } = createRequire(import.meta.url)(
  "../desktop/google-calendar.cjs",
);
const nativeFetch = globalThis.fetch;
let directory: string;
const safeStorage = {
  isEncryptionAvailable: () => true,
  encryptString: (text: string) =>
    Buffer.from("sealed:" + Buffer.from(text).toString("base64")),
  decryptString: (bytes: Buffer) =>
    Buffer.from(bytes.toString().slice(7), "base64").toString(),
};
const client = {
  id: "example.apps.googleusercontent.com",
  secret: "test-only-secret",
};
const make = (extra = {}) =>
  createGoogleCalendar({
    safeStorage,
    shell: { openExternal: vi.fn() },
    dialog: { showOpenDialog: vi.fn() },
    getWindow: () => ({}),
    dataPath: directory,
    ...extra,
  });
async function vault(value: unknown) {
  await fs.writeFile(
    path.join(directory, "google-calendar.enc"),
    safeStorage.encryptString(JSON.stringify(value)),
  );
}
beforeEach(async () => {
  directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "tutortrack-calendar-test-"),
  );
});
afterEach(async () => {
  vi.unstubAllGlobals();
  const resolved = path.resolve(directory);
  if (
    !resolved.startsWith(
      path.resolve(os.tmpdir()) + path.sep + "tutortrack-calendar-test-",
    )
  )
    throw Error("Unexpected test folder");
  await fs.rm(resolved, { recursive: true, force: true });
});

it("accepts desktop clients only and never trusts endpoints from the JSON", () => {
  expect(
    validateClient({
      installed: {
        client_id: client.id,
        client_secret: client.secret,
        token_uri: "https://example.invalid",
      },
    }),
  ).toEqual(client);
  expect(() =>
    validateClient({
      web: { client_id: client.id, client_secret: client.secret },
    }),
  ).toThrow();
});
it("exposes connection state without tokens or client credentials", async () => {
  await vault({
    client,
    refreshToken: "test-refresh",
    accessToken: "test-access",
    calendarId: "example",
    calendars: [],
  });
  const state = await make().status();
  expect(state).toEqual({
    configured: true,
    connected: true,
    calendarId: "example",
    calendars: [],
  });
  expect(JSON.stringify(state)).not.toMatch(/secret|refreshToken|accessToken/);
});
it("fails closed if encrypted credential storage is unavailable", async () => {
  await expect(
    make({
      safeStorage: { ...safeStorage, isEncryptionAvailable: () => false },
    }).status(),
  ).rejects.toThrow("Secure credential storage");
  await expect(
    make({
      safeStorage: {
        ...safeStorage,
        getSelectedStorageBackend: () => "basic_text",
      },
    }).status(),
  ).rejects.toThrow("Secure credential storage");
});
it("disconnects locally without deleting imported records or calling Google", async () => {
  await vault({
    client,
    refreshToken: "test-refresh",
    accessToken: "test-access",
    calendarId: "example",
  });
  const request = vi.fn();
  vi.stubGlobal("fetch", request);
  expect((await make().disconnect()).connected).toBe(false);
  expect(request).not.toHaveBeenCalled();
  expect(
    JSON.parse(
      safeStorage.decryptString(
        await fs.readFile(path.join(directory, "google-calendar.enc")),
      ),
    ),
  ).toEqual({ client });
});
it("reads all pages and returns only tutoring or previously linked events", async () => {
  await vault({
    client,
    refreshToken: "test-refresh",
    accessToken: "test-access",
    expiresAt: Date.now() + 3600000,
    calendarId: "example",
  });
  const request = vi
    .fn()
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          items: [
            { id: "new", summary: "Tutoring Work" },
            { id: "private-other", summary: "Other meeting" },
          ],
          nextPageToken: "page-two",
        }),
      ),
    )
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          items: [{ id: "linked", summary: "Renamed meeting" }],
        }),
      ),
    );
  vi.stubGlobal("fetch", request);
  const result = await make().events(["linked"]);
  expect(result.events.map((event: { id: string }) => event.id)).toEqual([
    "new",
    "linked",
  ]);
  expect(new URL(request.mock.calls[1][0]).searchParams.get("pageToken")).toBe(
    "page-two",
  );
  expect(
    request.mock.calls.every(
      ([url, options]) =>
        new URL(url).origin === "https://www.googleapis.com" && !options.method,
    ),
  ).toBe(true);
});
it("rejects a failed page rather than returning a partial import", async () => {
  await vault({
    client,
    refreshToken: "test-refresh",
    accessToken: "test-access",
    expiresAt: Date.now() + 3600000,
    calendarId: "example",
  });
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            items: [{ id: "new", summary: "Tutoring Work" }],
            nextPageToken: "next",
          }),
        ),
      )
      .mockResolvedValueOnce(new Response("{}", { status: 403 })),
  );
  await expect(make().events([])).rejects.toThrow("Google denied");
});
it("clears expired authorization without exposing Google error details", async () => {
  await vault({ client, refreshToken: "test-refresh", calendarId: "example" });
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            error: "invalid_grant",
            error_description: "private provider detail",
          }),
          { status: 400 },
        ),
      ),
  );
  const google = make();
  await expect(google.events([])).rejects.toThrow("expired or was revoked");
  expect((await google.status()).connected).toBe(false);
});
it("uses browser sign-in with PKCE, a loopback callback and a checked state", async () => {
  await vault({ client });
  const scopes =
    "https://www.googleapis.com/auth/calendar.events.readonly https://www.googleapis.com/auth/calendar.calendarlist.readonly";
  const requests = vi.fn(
    async (url: URL | string) =>
      new Response(
        JSON.stringify(
          String(url).includes("/token")
            ? {
                access_token: "test-access",
                refresh_token: "test-refresh",
                expires_in: 3600,
                scope: scopes,
              }
            : {
                items: [
                  {
                    id: "example",
                    summary: "Example calendar",
                    primary: true,
                    accessRole: "owner",
                  },
                ],
              },
        ),
      ),
  );
  vi.stubGlobal("fetch", requests);
  const shell = {
    openExternal: async (address: string) => {
      const url = new URL(address);
      expect(url.origin).toBe("https://accounts.google.com");
      expect(url.searchParams.get("code_challenge_method")).toBe("S256");
      expect(url.searchParams.get("scope")).toBe(scopes);
      expect(address).not.toContain(client.secret);
      const redirect = url.searchParams.get("redirect_uri")!;
      expect(new URL(redirect).hostname).toBe("127.0.0.1");
      expect(
        (await nativeFetch(redirect + "?state=wrong&code=unused")).status,
      ).toBe(400);
      expect(
        (
          await nativeFetch(
            redirect +
              "?state=" +
              url.searchParams.get("state") +
              "&code=test-code",
          )
        ).status,
      ).toBe(200);
    },
  };
  expect(await make({ shell }).connect()).toMatchObject({
    configured: true,
    connected: true,
    calendarId: "example",
  });
});
