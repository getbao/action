import { beforeEach, describe, expect, it, vi } from "vitest";
import { bootstrapSecrets } from "../bootstrap-secrets";

// ── fetch mock helpers ────────────────────────────────────────────────────────

interface MockResponse {
	ok?: boolean;
	status?: number;
	body?: string;
}

function mockFetch(responses: MockResponse[]) {
	let callIndex = 0;
	return vi.fn(async () => {
		const response = responses[callIndex++] ?? responses[responses.length - 1];
		return {
			ok: response.ok ?? true,
			status: response.status ?? 200,
			text: async () => response.body ?? "",
		};
	});
}

const BASE_ENV: NodeJS.ProcessEnv = {
	CLOUDFLARE_ACCOUNT_ID: "test-account",
	CLOUDFLARE_API_TOKEN: "test-token",
	KV_NAMESPACE_ID: "test-ns",
	AUTH_WORKER_NAME: "my-app",
	ROTATION_WORKER_NAME: "my-app-rotation",
};

describe("bootstrapSecrets", () => {
	let log: ReturnType<typeof vi.fn>;
	let errLog: ReturnType<typeof vi.fn>;
	let exit: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		log = vi.fn();
		errLog = vi.fn();
		exit = vi.fn();
	});

	it("exits with 1 when required env vars are missing", async () => {
		await bootstrapSecrets({}, log, errLog, exit);
		expect(exit).toHaveBeenCalledWith(1);
		expect(errLog).toHaveBeenCalledWith(expect.stringContaining("Missing"));
	});

	it("skips bootstrap when BETTER_AUTH_SECRETS already exists in KV", async () => {
		globalThis.fetch = mockFetch([
			// KV GET → 200 with existing value
			{ ok: true, status: 200, body: "aXY=:Y2lwaGVydGV4dA==" },
		]) as unknown as typeof fetch;

		await bootstrapSecrets({ ...BASE_ENV }, log, errLog, exit);

		expect(exit).not.toHaveBeenCalled();
		expect(fetch).toHaveBeenCalledTimes(1);
		expect(log).toHaveBeenCalledWith(
			expect.stringContaining("already present"),
		);
	});

	it("generates and writes secrets when KV is empty", async () => {
		globalThis.fetch = mockFetch([
			// KV GET → 404 (not found)
			{ ok: false, status: 404, body: "" },
			// KV PUT → 200
			{ ok: true, status: 200, body: "" },
			// setWorkerSecret auth worker → 200
			{ ok: true, status: 200, body: "" },
			// setWorkerSecret rotation worker → 200
			{ ok: true, status: 200, body: "" },
		]) as unknown as typeof fetch;

		await bootstrapSecrets({ ...BASE_ENV }, log, errLog, exit);

		expect(exit).not.toHaveBeenCalled();
		expect(fetch).toHaveBeenCalledTimes(4);
		expect(log).toHaveBeenCalledWith(
			expect.stringContaining("Bootstrap complete"),
		);
	});

	it("regenerates when FORCE_ROTATE is true even if KV has a value", async () => {
		globalThis.fetch = mockFetch([
			// KV GET → 200 (exists)
			{ ok: true, status: 200, body: "aXY=:Y2lwaGVydGV4dA==" },
			// KV PUT → 200
			{ ok: true, status: 200, body: "" },
			// setWorkerSecret auth worker → 200
			{ ok: true, status: 200, body: "" },
			// setWorkerSecret rotation worker → 200
			{ ok: true, status: 200, body: "" },
		]) as unknown as typeof fetch;

		await bootstrapSecrets(
			{ ...BASE_ENV, FORCE_ROTATE: "true" },
			log,
			errLog,
			exit,
		);

		expect(exit).not.toHaveBeenCalled();
		expect(fetch).toHaveBeenCalledTimes(4);
		expect(log).toHaveBeenCalledWith(expect.stringContaining("Force rotate"));
		expect(log).toHaveBeenCalledWith(
			expect.stringContaining("Bootstrap complete"),
		);
	});

	it("throws and exits when KV PUT fails", async () => {
		globalThis.fetch = mockFetch([
			// KV GET → 404
			{ ok: false, status: 404, body: "" },
			// KV PUT → 500
			{ ok: false, status: 500, body: "Internal Server Error" },
		]) as unknown as typeof fetch;

		await expect(
			bootstrapSecrets({ ...BASE_ENV }, log, errLog, exit),
		).rejects.toThrow("KV PUT failed");
	});

	it("throws and exits when setting Worker Secret fails", async () => {
		globalThis.fetch = mockFetch([
			// KV GET → 404
			{ ok: false, status: 404, body: "" },
			// KV PUT → 200
			{ ok: true, status: 200, body: "" },
			// setWorkerSecret auth worker → 403
			{ ok: false, status: 403, body: "Forbidden" },
		]) as unknown as typeof fetch;

		await expect(
			bootstrapSecrets({ ...BASE_ENV }, log, errLog, exit),
		).rejects.toThrow("Set secret on my-app failed");
	});
});
