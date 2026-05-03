#!/usr/bin/env node
/**
 * Downloads and verifies getbao release assets from the BAO API.
 *
 *   1. Fetches a presigned R2 URL for each asset from the BAO API.
 *   2. Downloads each asset to ASSETS_DIR.
 *   3. Verifies SHA-256 hashes against manifest.json.
 *   4. Extracts migrations.zip and tf.zip into subdirectories.
 *
 * Environment variables expected:
 *   BAO_API_KEY   - getbao license key
 *   BAO_API_URL   - Base URL of the BAO API
 *   VERSION       - Release version or channel to download (e.g. v1.2.3, latest)
 *   ASSETS_DIR    - Directory to download assets into
 */

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { configure, getLogger } from "@logtape/logtape";

const ASSETS = [
	"manifest.json",
	"worker.js",
	"rotation-worker.js",
	"migrations.zip",
	"tf.zip",
] as const;

const VERIFY_ASSETS = [
	"worker.js",
	"rotation-worker.js",
	"migrations.zip",
	"tf.zip",
] as const;

const EXTRACT: [string, string][] = [
	["migrations.zip", "migrations"],
	["tf.zip", "tf"],
];

type Asset = (typeof ASSETS)[number];
type Manifest = { assets: Record<string, { sha256: string }> };

export async function downloadAssets(env: NodeJS.ProcessEnv): Promise<void> {
	const logger = getLogger(["bao", "action", "download-assets"]);

	const missing = (
		["BAO_API_KEY", "BAO_API_URL", "VERSION", "ASSETS_DIR"] as const
	).filter((k) => !env[k]);

	if (missing.length > 0) {
		throw new Error(
			`Missing required environment variables: ${missing.join(", ")}`,
		);
	}

	const {
		BAO_API_KEY: apiKey,
		BAO_API_URL: apiUrl,
		VERSION: version,
		ASSETS_DIR: assetsDir,
	} = env as Record<
		"BAO_API_KEY" | "BAO_API_URL" | "VERSION" | "ASSETS_DIR",
		string
	>;

	await mkdir(assetsDir, { recursive: true });

	// 1. Resolve presigned URLs and download each asset
	for (const asset of ASSETS) {
		logger.info("Downloading {asset}...", { asset });

		const apiRes = await fetch(`${apiUrl}/v1/releases/${version}/${asset}`, {
			headers: { Authorization: `Bearer ${apiKey}` },
		});

		if (!apiRes.ok) {
			throw new Error(
				`API request failed for ${asset}: ${apiRes.status} ${await apiRes.text()}`,
			);
		}

		const { url: presignedUrl } = (await apiRes.json()) as { url: string };

		const downloadRes = await fetch(presignedUrl);
		if (!downloadRes.ok) {
			throw new Error(`Download failed for ${asset}: ${downloadRes.status}`);
		}

		await writeFile(
			join(assetsDir, asset),
			Buffer.from(await downloadRes.arrayBuffer()),
		);
	}

	// 2. Verify SHA-256 hashes against manifest
	logger.info("Verifying asset integrity...");

	const manifestRaw = await readFile(join(assetsDir, "manifest.json"), "utf-8");
	const manifest: Manifest = JSON.parse(manifestRaw);

	for (const asset of VERIFY_ASSETS) {
		const content = await readFile(join(assetsDir, asset));
		const actual = createHash("sha256").update(content).digest("hex");
		const expected = manifest.assets[asset as Asset]?.sha256;

		if (actual !== expected) {
			throw new Error(
				`Hash mismatch for ${asset}: expected ${expected}, got ${actual}`,
			);
		}

		logger.info("  {asset} ✓", { asset });
	}

	// 3. Extract archives
	for (const [archive, subdir] of EXTRACT) {
		logger.info("Extracting {archive}...", { archive });

		const result = spawnSync("unzip", [
			"-oq",
			join(assetsDir, archive),
			"-d",
			join(assetsDir, subdir),
		]);

		if (result.status !== 0) {
			throw new Error(
				`Failed to extract ${archive}: ${result.stderr?.toString() ?? "unknown error"}`,
			);
		}
	}

	logger.info("Assets extracted.");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	void (async () => {
		await configure({
			sinks: {
				stdout: (record) => {
					const msg = record.message
						.map((v) => (typeof v === "string" ? v : String(v)))
						.join("");
					process.stdout.write(`${msg}\n`);
				},
			},
			loggers: [{ category: ["bao"], sinks: ["stdout"], lowestLevel: "info" }],
		});

		const logger = getLogger(["bao", "action", "download-assets"]);
		try {
			await downloadAssets(process.env);
		} catch (err) {
			logger.fatal("::error::{message}", { message: (err as Error).message });
			process.exit(1);
		}
	})();
}
