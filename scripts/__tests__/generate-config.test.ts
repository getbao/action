import fs from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { main } from "../generate-config";

const VALID_CONFIG = {
	appName: "test-app",
	auth: {
		baseURL: "http://localhost:8787",
		plugins: {
			password: { enabled: true },
			organization: { enabled: false },
			otp: { enabled: false },
			jwks: { enabled: false },
		},
	},
	cors: {
		origins: [],
	},
};

describe("generate-config", () => {
	let originalEnv: NodeJS.ProcessEnv;
	let originalCwd: () => string;

	beforeEach(() => {
		originalEnv = process.env;
		process.env = { ...originalEnv };
		originalCwd = process.cwd;

		vi.spyOn(console, "error").mockImplementation(() => {});
		vi.spyOn(console, "log").mockImplementation(() => {});
		vi.spyOn(process, "exit").mockImplementation((code) => {
			throw new Error(`process.exit: ${code}`);
		});
		vi.spyOn(process, "cwd").mockReturnValue("/mock/workspace");

		vi.spyOn(fs, "readFileSync").mockReturnValue("");
		vi.spyOn(fs, "writeFileSync").mockImplementation(() => {});
		vi.spyOn(fs, "appendFileSync").mockImplementation(() => {});
	});

	afterEach(() => {
		process.env = originalEnv;
		process.cwd = originalCwd;
		vi.restoreAllMocks();
		vi.resetAllMocks();
	});

	it("fails if config file does not exist", async () => {
		vi.mocked(fs.readFileSync).mockImplementation(() => {
			const error = Object.assign(new Error("ENOENT"), { code: "ENOENT" });
			throw error;
		});

		await expect(main()).rejects.toThrow("process.exit: 1");
		expect(console.error).toHaveBeenCalledWith(
			expect.stringContaining("Configuration file not found at"),
		);
	});

	it("fails if config file is invalid JSON", async () => {
		vi.mocked(fs.readFileSync).mockReturnValue("invalid-json");

		await expect(main()).rejects.toThrow("process.exit: 1");
		expect(console.error).toHaveBeenCalledWith(
			expect.stringContaining("Failed to parse configuration file"),
		);
	});

	it("fails if config file fails schema validation", async () => {
		vi.mocked(fs.readFileSync).mockReturnValue(
			JSON.stringify({ appName: "invalid" }), // Missing required fields!
		);

		await expect(main()).rejects.toThrow("process.exit: 1");
		expect(console.error).toHaveBeenCalledWith(
			expect.stringContaining("Invalid configuration"),
		);
	});

	it("fails if deployEnv is production and baseURL is missing", async () => {
		process.env.DEPLOY_ENV = "production";
		process.env.TOFU_DB_ID = "mock-db-id";

		const mockConfig = JSON.parse(JSON.stringify(VALID_CONFIG));
		delete mockConfig.auth.baseURL; // Missing baseURL, should fail custom check!

		vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockConfig));

		await expect(main()).rejects.toThrow("process.exit: 1");
		expect(console.error).toHaveBeenCalledWith(
			expect.stringContaining(
				"auth.baseURL is required in bao.config.json for production deployments.",
			),
		);
	});

	it("generates correct wrangler.json for dev with infrastructure", async () => {
		process.env.DEPLOY_ENV = "dev";
		process.env.TOFU_DB_ID = "mock-db-id";
		process.env.TOFU_KV_ID = "mock-kv-id";
		const mockConfig = JSON.parse(JSON.stringify(VALID_CONFIG));
		vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockConfig));

		await main();

		// Two files: wrangler.json and wrangler-rotation.json
		expect(fs.writeFileSync).toHaveBeenCalledTimes(2);

		const [wranglerCall, rotationCall] = vi.mocked(fs.writeFileSync).mock.calls;

		expect(wranglerCall[0]).toBe("/mock/workspace/wrangler.json");
		const writtenConfig = JSON.parse(wranglerCall[1] as string);
		expect(writtenConfig.name).toBe("test-app");
		expect(writtenConfig.env.dev.d1_databases[0].database_id).toBe(
			"mock-db-id",
		);
		expect(writtenConfig.env.dev.d1_databases[0].database_name).toBe(
			"bao_db_dev",
		);
		expect(writtenConfig.env.dev.vars.ENVIRONMENT).toBe("dev");
		expect(writtenConfig.env.dev.vars.BETTER_AUTH_URL).toBe(
			"http://localhost:8787",
		);
		expect(writtenConfig.env.dev.vars.ROOT_DOMAIN).toBe("localhost");
		expect(writtenConfig.env.dev.kv_namespaces[0].id).toBe("mock-kv-id");
		expect(writtenConfig.env.dev.kv_namespaces[0].binding).toBe("BAO_CONFIG");

		expect(rotationCall[0]).toBe("/mock/workspace/wrangler-rotation.json");
		const rotationConfig = JSON.parse(rotationCall[1] as string);
		expect(rotationConfig.name).toBe("test-app-rotation");
		expect(rotationConfig.env.dev.kv_namespaces[0].id).toBe("mock-kv-id");
		expect(rotationConfig.env.dev.triggers.crons).toEqual(["0 0 1 */3 *"]);
	});

	it("generates correct wrangler.json for production without infrastructure", async () => {
		process.env.DEPLOY_ENV = "production";
		delete process.env.TOFU_DB_ID;
		delete process.env.TOFU_KV_ID;
		const mockConfig = JSON.parse(JSON.stringify(VALID_CONFIG));
		mockConfig.auth.baseURL = "https://auth.example.com";

		vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockConfig));

		await main();

		expect(fs.writeFileSync).toHaveBeenCalledTimes(2);
		const [wranglerCall] = vi.mocked(fs.writeFileSync).mock.calls;

		expect(wranglerCall[0]).toBe("/mock/workspace/wrangler.json");
		const writtenConfig = JSON.parse(wranglerCall[1] as string);
		expect(writtenConfig.name).toBe("test-app");
		expect(writtenConfig.env.production.d1_databases).toBeUndefined();
		expect(writtenConfig.env.production.vars.ENVIRONMENT).toBe("production");
		expect(writtenConfig.env.production.vars.BETTER_AUTH_URL).toBe(
			"https://auth.example.com",
		);
		expect(writtenConfig.env.production.vars.ROOT_DOMAIN).toBe(
			"auth.example.com",
		);
		expect(writtenConfig.env.production.kv_namespaces).toBeUndefined();
	});

	it("outputs correct variables to GITHUB_OUTPUT", async () => {
		process.env.DEPLOY_ENV = "dev";
		process.env.TOFU_DB_ID = "mock-db-id";
		process.env.GITHUB_OUTPUT = "/mock/github_output";

		const mockConfig = JSON.parse(JSON.stringify(VALID_CONFIG));
		vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockConfig));

		await main();

		// Four outputs: app_name, rotation_worker_name, db_id, base_url
		expect(fs.appendFileSync).toHaveBeenCalledTimes(4);
		expect(fs.appendFileSync).toHaveBeenCalledWith(
			"/mock/github_output",
			"app_name=test-app\n",
		);
		expect(fs.appendFileSync).toHaveBeenCalledWith(
			"/mock/github_output",
			"rotation_worker_name=test-app-rotation\n",
		);
		expect(fs.appendFileSync).toHaveBeenCalledWith(
			"/mock/github_output",
			"db_id=mock-db-id\n",
		);
		expect(fs.appendFileSync).toHaveBeenCalledWith(
			"/mock/github_output",
			"base_url=http://localhost:8787\n",
		);
	});
});
