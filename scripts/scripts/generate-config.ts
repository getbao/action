#!/usr/bin/env node
/**
 * Reads bao.config.json from the workspace root, validates it against the
 * project-config Zod schema, then:
 *  - Writes wrangler.json (used by cloudflare/wrangler-action)
 *  - Emits GITHUB_OUTPUT variables consumed by subsequent composite steps:
 *      app_name, db_id (from tofu outputs), base_url
 *
 * Environment variables expected:
 *   TOFU_DB_ID        - d1_database_id output from `tofu output -json`
 *   TOFU_DB_NAME      - d1_database_name output from `tofu output -json`
 *   TOFU_KV_ID        - kv_namespace_id output from `tofu output -json`
 *   GITHUB_OUTPUT     - path to the GitHub Actions output file
 *   GITHUB_WORKSPACE  - repo root (set automatically by Actions runner)
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { projectConfigSchema } from "@bao/project-config";

// ── helpers ──────────────────────────────────────────────────────────────────

function setOutput(name: string, value: string): void {
	const outputFile = process.env.GITHUB_OUTPUT;
	if (outputFile) {
		fs.appendFileSync(outputFile, `${name}=${value}\n`);
	} else {
		// Fallback for local testing
		console.log(`::set-output name=${name}::${value}`);
	}
}

function fail(message: string): never {
	console.error(`::error::${message}`);
	process.exit(1);
}

// ── main ─────────────────────────────────────────────────────────────────────

export async function main(): Promise<void> {
	const workDir = process.env.GITHUB_WORKSPACE ?? process.cwd();
	const configPath = path.resolve(workDir, "bao.config.json");

	// 1. Read config file
	let rawConfig: string;
	try {
		rawConfig = fs.readFileSync(configPath, "utf-8");
	} catch (err) {
		const error = err as NodeJS.ErrnoException;
		if (error.code === "ENOENT") {
			fail(`Configuration file not found at ${configPath}`);
		}
		fail(`Failed to read configuration file: ${error.message}`);
	}

	// 2. Parse JSON
	let userConfig: unknown;
	try {
		userConfig = JSON.parse(rawConfig);
	} catch (err) {
		fail(`Failed to parse configuration file: ${(err as Error).message}`);
	}

	// 3. Validate with Zod schema from @bao/project-config
	const result = projectConfigSchema.safeParse(userConfig);
	if (!result.success) {
		fail(
			`Invalid configuration: ${JSON.stringify(result.error.format(), null, 2)}`,
		);
	}
	const config = result.data;

	// 4. Resolve infra outputs written by the tofu steps
	const deployEnv = process.env.DEPLOY_ENV || "dev";
	const dbId = process.env.TOFU_DB_ID ?? "";
	const kvId = process.env.TOFU_KV_ID ?? "";
	const workerFileName = "worker.js";

	// 5. Enforce production requirements
	if (deployEnv === "production" && !config.auth?.baseURL) {
		fail(
			"auth.baseURL is required in bao.config.json for production deployments.",
		);
	}

	// 6. Generate wrangler.json
	const compatDate = new Date().toISOString().split("T")[0];
	const envVars = {
		ENVIRONMENT: deployEnv,
		BETTER_AUTH_URL: config.auth?.baseURL || "",
		ROOT_DOMAIN: config.auth?.baseURL
			? new URL(config.auth.baseURL).hostname
			: "",
		APP_CONFIG: JSON.stringify(config),
	};

	const envBlock = {
		vars: envVars,
		...(dbId && {
			d1_databases: [
				{
					binding: "DB",
					database_name: `bao_db_${deployEnv}`,
					database_id: dbId,
				},
			],
		}),
		...(kvId && {
			kv_namespaces: [{ binding: "BAO_CONFIG", id: kvId }],
		}),
	};

	const wranglerConfig = {
		name: config.appName,
		main: workerFileName,
		compatibility_date: compatDate,
		compatibility_flags: ["nodejs_compat"],
		env: { [deployEnv]: envBlock },
	};

	const wranglerConfigPath = path.resolve(workDir, "wrangler.json");
	fs.writeFileSync(wranglerConfigPath, JSON.stringify(wranglerConfig, null, 2));
	console.log(
		`wrangler.json written to ${wranglerConfigPath} with env [${deployEnv}]`,
	);

	// 6b. Generate wrangler-rotation.json (rotation worker)
	const rotationWorkerName = `${config.appName}-rotation`;
	const rotationConfig = {
		name: rotationWorkerName,
		main: "rotation-worker.js",
		compatibility_date: compatDate,
		compatibility_flags: ["nodejs_compat"],
		env: {
			[deployEnv]: {
				...(kvId && {
					kv_namespaces: [{ binding: "BAO_CONFIG", id: kvId }],
				}),
				triggers: { crons: ["0 0 1 */3 *"] },
			},
		},
	};

	const rotationConfigPath = path.resolve(workDir, "wrangler-rotation.json");
	fs.writeFileSync(rotationConfigPath, JSON.stringify(rotationConfig, null, 2));
	console.log(
		`wrangler-rotation.json written to ${rotationConfigPath} with env [${deployEnv}]`,
	);

	// 7. Emit outputs for subsequent steps
	setOutput("app_name", config.appName);
	setOutput("rotation_worker_name", rotationWorkerName);
	setOutput("db_id", dbId);
	setOutput("base_url", config.auth?.baseURL ?? "");

	console.log(
		`Config generated for app: ${config.appName} in env: ${deployEnv}`,
	);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	main().catch((err: Error) => {
		console.error(`::error::${err.message}`);
		process.exit(1);
	});
}
