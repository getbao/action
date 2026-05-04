import { createHash } from "node:crypto";
import { basename } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { downloadAssets } from "../download-assets.js";

// ── hoist mocks so factories can reference them ───────────────────────────────

const { mockMkdir, mockWriteFile, mockReadFile, mockSpawnSync } = vi.hoisted(
	() => ({
		mockMkdir: vi.fn(),
		mockWriteFile: vi.fn(),
		mockReadFile: vi.fn(),
		mockSpawnSync: vi.fn(),
	}),
);

vi.mock("node:fs/promises", () => ({
	mkdir: mockMkdir,
	writeFile: mockWriteFile,
	readFile: mockReadFile,
}));

vi.mock("node:child_process", () => ({
	spawnSync: mockSpawnSync,
}));

// ── fixtures ──────────────────────────────────────────────────────────────────

const FIXTURE: Record<string, Buffer> = {
	"worker.js": Buffer.from("worker-content"),
	"rotation-worker.js": Buffer.from("rotation-worker-content"),
	"migrations.zip": Buffer.from("migrations-content"),
	"tf.zip": Buffer.from("tf-content"),
};

const MANIFEST = {
	assets: Object.fromEntries(
		Object.entries(FIXTURE).map(([name, buf]) => [
			name,
			{ sha256: createHash("sha256").update(buf).digest("hex") },
		]),
	),
};

// ── fetch mock ────────────────────────────────────────────────────────────────

function mockFetch() {
	globalThis.fetch = vi.fn(async (url: string | URL | Request) => {
		const urlStr = url.toString();

		// API call → return presigned URL
		if (urlStr.includes("/v1/releases/")) {
			const asset = urlStr.split("/").at(-1) ?? "unknown";
			return {
				ok: true,
				status: 200,
				json: async () => ({ url: `presigned://${asset}` }),
				text: async () => "",
			};
		}

		// Presigned download → return fixture content
		const asset = urlStr.replace("presigned://", "");
		const content = FIXTURE[asset] ?? Buffer.from("");
		return {
			ok: true,
			status: 200,
			arrayBuffer: async () =>
				content.buffer.slice(
					content.byteOffset,
					content.byteOffset + content.byteLength,
				),
			text: async () => "",
		};
	}) as unknown as typeof fetch;
}

const BASE_ENV: NodeJS.ProcessEnv = {
	BAO_API_KEY: "test-key",
	BAO_API_URL: "https://api.test.dev",
	VERSION: "v1.0.0",
	ASSETS_DIR: "/tmp/test-assets",
};

// ── tests ─────────────────────────────────────────────────────────────────────

describe("downloadAssets", () => {
	beforeEach(() => {
		vi.resetAllMocks();
		mockMkdir.mockResolvedValue(undefined);
		mockWriteFile.mockResolvedValue(undefined);
		mockReadFile.mockImplementation(async (filePath: unknown) => {
			const name = basename(filePath as string);
			if (name === "manifest.json") return JSON.stringify(MANIFEST);
			return FIXTURE[name] ?? Buffer.alloc(0);
		});
		mockSpawnSync.mockReturnValue({ status: 0, stderr: null });
		mockFetch();
	});

	it("throws when required env vars are missing", async () => {
		await expect(downloadAssets({})).rejects.toThrow(
			"Missing required environment variables",
		);
	});

	it.each([
		"BAO_API_KEY",
		"BAO_API_URL",
		"VERSION",
		"ASSETS_DIR",
	] as const)("throws when %s is missing", async (key) => {
		const env = { ...BASE_ENV, [key]: undefined };
		await expect(downloadAssets(env)).rejects.toThrow(key);
	});

	it("creates ASSETS_DIR", async () => {
		await downloadAssets(BASE_ENV);
		expect(mockMkdir).toHaveBeenCalledWith(BASE_ENV.ASSETS_DIR, {
			recursive: true,
		});
	});

	it("fetches presigned URLs and downloads all assets", async () => {
		await downloadAssets(BASE_ENV);

		const assets = [
			"manifest.json",
			"worker.js",
			"rotation-worker.js",
			"migrations.zip",
			"tf.zip",
		];
		for (const asset of assets) {
			expect(fetch).toHaveBeenCalledWith(
				`${BASE_ENV.BAO_API_URL}/v1/releases/${BASE_ENV.VERSION}/${asset}`,
				expect.objectContaining({
					headers: { Authorization: `Bearer ${BASE_ENV.BAO_API_KEY}` },
				}),
			);
			expect(fetch).toHaveBeenCalledWith(`presigned://${asset}`);
		}
	});

	it("writes each downloaded asset to ASSETS_DIR", async () => {
		await downloadAssets(BASE_ENV);

		for (const asset of Object.keys(FIXTURE)) {
			expect(mockWriteFile).toHaveBeenCalledWith(
				`${BASE_ENV.ASSETS_DIR}/${asset}`,
				expect.any(Buffer),
			);
		}
	});

	it("throws when the API call fails", async () => {
		globalThis.fetch = vi.fn(async () => ({
			ok: false,
			status: 401,
			text: async () => "Unauthorized",
		})) as unknown as typeof fetch;

		await expect(downloadAssets(BASE_ENV)).rejects.toThrow(
			"API request failed",
		);
	});

	it("throws when the presigned download fails", async () => {
		let callCount = 0;
		globalThis.fetch = vi.fn(async (url: string | URL | Request) => {
			const urlStr = url.toString();
			if (urlStr.includes("/v1/releases/")) {
				const asset = urlStr.split("/").at(-1) ?? "unknown";
				return {
					ok: true,
					status: 200,
					json: async () => ({ url: `presigned://${asset}` }),
					text: async () => "",
				};
			}
			// First download fails
			if (callCount++ === 0) {
				return { ok: false, status: 403, text: async () => "Forbidden" };
			}
			return {
				ok: true,
				status: 200,
				arrayBuffer: async () => new ArrayBuffer(0),
				text: async () => "",
			};
		}) as unknown as typeof fetch;

		await expect(downloadAssets(BASE_ENV)).rejects.toThrow("Download failed");
	});

	it("throws on SHA-256 hash mismatch", async () => {
		mockReadFile.mockImplementation(async (filePath: unknown) => {
			const name = basename(filePath as string);
			if (name === "manifest.json") return JSON.stringify(MANIFEST);
			if (name === "worker.js") return Buffer.from("tampered-content");
			return FIXTURE[name] ?? Buffer.alloc(0);
		});

		await expect(downloadAssets(BASE_ENV)).rejects.toThrow(
			"Hash mismatch for worker.js",
		);
	});

	it("extracts migrations.zip and tf.zip", async () => {
		await downloadAssets(BASE_ENV);

		expect(mockSpawnSync).toHaveBeenCalledWith("unzip", [
			"-oq",
			`${BASE_ENV.ASSETS_DIR}/migrations.zip`,
			"-d",
			`${BASE_ENV.ASSETS_DIR}/migrations`,
		]);
		expect(mockSpawnSync).toHaveBeenCalledWith("unzip", [
			"-oq",
			`${BASE_ENV.ASSETS_DIR}/tf.zip`,
			"-d",
			`${BASE_ENV.ASSETS_DIR}/tf`,
		]);
	});

	it("throws when extraction fails", async () => {
		mockSpawnSync.mockReturnValue({
			status: 1,
			stderr: Buffer.from("unzip: error"),
		});

		await expect(downloadAssets(BASE_ENV)).rejects.toThrow(
			"Failed to extract migrations.zip",
		);
	});
});
