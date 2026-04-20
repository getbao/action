#!/usr/bin/env node
/**
 * Bootstraps BETTER_AUTH_SECRETS on first deploy (or force_rotate):
 *   1. Checks KV for an existing encrypted BETTER_AUTH_SECRETS value.
 *   2. If missing (or force_rotate=true):
 *      - Generates a new AES-GCM encryption key (BAO_KV_ENCRYPTION_KEY).
 *      - Generates auth secret version 1.
 *      - Encrypts the versioned string and writes it to KV.
 *      - Sets BAO_KV_ENCRYPTION_KEY as a Worker Secret on both the auth
 *        worker and the rotation worker via the Cloudflare API.
 *   3. If already present: no-op (encryption key persists as Worker Secret).
 *
 * Environment variables expected:
 *   CLOUDFLARE_ACCOUNT_ID   - Cloudflare account ID
 *   CLOUDFLARE_API_TOKEN    - Cloudflare API token (Workers edit + KV write)
 *   KV_NAMESPACE_ID         - ID of the bao-config KV namespace
 *   AUTH_WORKER_NAME        - Name of the deployed auth worker script
 *   ROTATION_WORKER_NAME    - Name of the deployed rotation worker script
 *   FORCE_ROTATE            - "true" to discard all existing versions and regenerate
 */

import { webcrypto } from "node:crypto";
import { fileURLToPath } from "node:url";

const crypto = webcrypto;

// ── Cloudflare API helpers ────────────────────────────────────────────────────

async function kvGet(
	accountId: string,
	apiToken: string,
	namespaceId: string,
	key: string,
): Promise<string | null> {
	const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/values/${encodeURIComponent(key)}`;
	const res = await fetch(url, {
		headers: { Authorization: `Bearer ${apiToken}` },
	});
	if (res.status === 404) return null;
	if (!res.ok)
		throw new Error(`KV GET failed: ${res.status} ${await res.text()}`);
	return res.text();
}

async function kvPut(
	accountId: string,
	apiToken: string,
	namespaceId: string,
	key: string,
	value: string,
): Promise<void> {
	const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/values/${encodeURIComponent(key)}`;
	const res = await fetch(url, {
		method: "PUT",
		headers: {
			Authorization: `Bearer ${apiToken}`,
			"Content-Type": "text/plain",
		},
		body: value,
	});
	if (!res.ok)
		throw new Error(`KV PUT failed: ${res.status} ${await res.text()}`);
}

async function setWorkerSecret(
	accountId: string,
	apiToken: string,
	workerName: string,
	name: string,
	value: string,
): Promise<void> {
	const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/${workerName}/secrets`;
	const res = await fetch(url, {
		method: "PUT",
		headers: {
			Authorization: `Bearer ${apiToken}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({ name, text: value, type: "secret_text" }),
	});
	if (!res.ok)
		throw new Error(
			`Set secret on ${workerName} failed: ${res.status} ${await res.text()}`,
		);
}

// ── Crypto helpers ────────────────────────────────────────────────────────────

async function importKey(
	keyBase64: string,
	usage: KeyUsage[],
): Promise<CryptoKey> {
	const keyBytes = Buffer.from(keyBase64, "base64");
	return crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, usage);
}

async function encrypt(plaintext: string, keyBase64: string): Promise<string> {
	const key = await importKey(keyBase64, ["encrypt"]);
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const encoded = new TextEncoder().encode(plaintext);
	const ciphertext = await crypto.subtle.encrypt(
		{ name: "AES-GCM", iv },
		key,
		encoded,
	);
	const ivB64 = Buffer.from(iv).toString("base64");
	const ctB64 = Buffer.from(new Uint8Array(ciphertext)).toString("base64");
	return `${ivB64}:${ctB64}`;
}

// ── Core logic ────────────────────────────────────────────────────────────────

export async function bootstrapSecrets(
	env: NodeJS.ProcessEnv,
	log: (message: string) => void,
	errLog: (message: string) => void,
	exit: (code: number) => void,
): Promise<void> {
	const {
		CLOUDFLARE_ACCOUNT_ID: accountId,
		CLOUDFLARE_API_TOKEN: apiToken,
		KV_NAMESPACE_ID: kvNamespaceId,
		AUTH_WORKER_NAME: authWorkerName,
		ROTATION_WORKER_NAME: rotationWorkerName,
		FORCE_ROTATE: forceRotateStr,
	} = env;

	const forceRotate = forceRotateStr === "true";

	if (
		!accountId ||
		!apiToken ||
		!kvNamespaceId ||
		!authWorkerName ||
		!rotationWorkerName
	) {
		errLog(
			"Missing required environment variables: CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN, KV_NAMESPACE_ID, AUTH_WORKER_NAME, ROTATION_WORKER_NAME",
		);
		exit(1);
		return;
	}

	const existing = await kvGet(
		accountId,
		apiToken,
		kvNamespaceId,
		"BETTER_AUTH_SECRETS",
	);

	if (existing && !forceRotate) {
		log("BETTER_AUTH_SECRETS already present in KV — skipping bootstrap.");
		return;
	}

	if (forceRotate) {
		log(
			"Force rotate requested — discarding all existing versions and regenerating.",
		);
	}

	// Generate encryption key (256-bit)
	const encKeyBytes = crypto.getRandomValues(new Uint8Array(32));
	const encKeyBase64 = Buffer.from(encKeyBytes).toString("base64");

	// Generate auth secret version 1
	const secretBytes = crypto.getRandomValues(new Uint8Array(32));
	const secretBase64 = Buffer.from(secretBytes).toString("base64");
	const secretsStr = `1:${secretBase64}`;

	// Encrypt and persist to KV
	const encrypted = await encrypt(secretsStr, encKeyBase64);
	await kvPut(
		accountId,
		apiToken,
		kvNamespaceId,
		"BETTER_AUTH_SECRETS",
		encrypted,
	);
	log("BETTER_AUTH_SECRETS written to KV.");

	// Set BAO_KV_ENCRYPTION_KEY on both workers
	await setWorkerSecret(
		accountId,
		apiToken,
		authWorkerName,
		"BAO_KV_ENCRYPTION_KEY",
		encKeyBase64,
	);
	log(`BAO_KV_ENCRYPTION_KEY set on ${authWorkerName}.`);

	await setWorkerSecret(
		accountId,
		apiToken,
		rotationWorkerName,
		"BAO_KV_ENCRYPTION_KEY",
		encKeyBase64,
	);
	log(`BAO_KV_ENCRYPTION_KEY set on ${rotationWorkerName}.`);

	log("Bootstrap complete.");
}

async function main(): Promise<void> {
	await bootstrapSecrets(process.env, console.log, console.error, process.exit);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	main().catch((err: Error) => {
		console.error(`::error::${err.message}`);
		process.exit(1);
	});
}
