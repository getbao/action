#!/usr/bin/env node
/**
 * Parses a JSON string of secrets provided by the user in the `app_secrets` input,
 * converts all entries into multiline environment variables in GITHUB_ENV, and generates
 * a dynamic list of keys to pass to the cloudflare/wrangler-action.
 *
 * Empty string values are replaced with "UNSET" to prevent Cloudflare deployment
 * errors, as Cloudflare Workers require secrets to be non-empty.
 *
 * Environment variables expected:
 *   APP_SECRETS   - JSON string of application secrets
 *   GITHUB_ENV    - Path to the GitHub Actions env file
 */

import crypto from "node:crypto";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

export function parseSecrets(
	env: NodeJS.ProcessEnv,
	appendFileSync: (path: string, data: string) => void,
	log: (message: string) => void,
	errLog: (message: string) => void,
	exit: (code: number) => void,
): void {
	const appSecretsStr = env.APP_SECRETS || "{}";
	const githubEnvPath = env.GITHUB_ENV;

	if (!githubEnvPath) {
		errLog("GITHUB_ENV not found");
		exit(1);
		return;
	}

	let appSecrets: Record<string, unknown> = {};
	try {
		appSecrets = JSON.parse(
			appSecretsStr === '""' || appSecretsStr === "''" ? "{}" : appSecretsStr,
		) as Record<string, unknown>;
	} catch (err) {
		errLog(`Failed to parse APP_SECRETS JSON: ${(err as Error).message}`);
		appSecrets = {};
	}

	const delimiter = crypto.randomBytes(16).toString("hex");
	const keys = Object.keys(appSecrets);

	let envFileContent = "";

	for (const [key, value] of Object.entries(appSecrets)) {
		const stringValue = String(value);
		const finalValue = stringValue === "" ? "UNSET" : stringValue;
		envFileContent += `${key}<<${delimiter}\n${finalValue}\n${delimiter}\n`;
	}

	const secretKeysList = keys.join("\n");
	envFileContent += `SECRET_KEYS<<${delimiter}\n${secretKeysList}\n${delimiter}\n`;

	appendFileSync(githubEnvPath, envFileContent);
	log(`Parsed ${keys.length} secrets and exported to GITHUB_ENV.`);
}

function main(): void {
	parseSecrets(
		process.env,
		fs.appendFileSync,
		console.log,
		console.error,
		process.exit,
	);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	main();
}
