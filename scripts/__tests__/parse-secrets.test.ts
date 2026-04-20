import { describe, expect, it, vi } from "vitest";
import { parseSecrets } from "../parse-secrets";

describe("parseSecrets", () => {
	it("should parse secrets correctly and output to GITHUB_ENV", () => {
		const env: NodeJS.ProcessEnv = {
			APP_SECRETS: JSON.stringify({
				FOO: "bar",
				EMPTY: "",
				NUM: 123,
			}),
			GITHUB_ENV: "/tmp/github_env_test",
		};
		const mockAppendFileSync = vi.fn();
		const mockLog = vi.fn();
		const mockErrLog = vi.fn();
		const mockExit = vi.fn();

		parseSecrets(env, mockAppendFileSync, mockLog, mockErrLog, mockExit);

		expect(mockExit).not.toHaveBeenCalled();
		expect(mockErrLog).not.toHaveBeenCalled();
		expect(mockAppendFileSync).toHaveBeenCalledTimes(1);

		const callArgs = mockAppendFileSync.mock.calls[0];
		expect(callArgs[0]).toBe("/tmp/github_env_test");

		const content = callArgs[1] as string;
		expect(content).toContain("FOO<<");
		expect(content).toContain("\nbar\n");
		expect(content).toContain("EMPTY<<");
		expect(content).toContain("\nUNSET\n");
		expect(content).toContain("NUM<<");
		expect(content).toContain("\n123\n");
		expect(content).toContain("SECRET_KEYS<<");
		expect(content).toContain("FOO\nEMPTY\nNUM");

		expect(mockLog).toHaveBeenCalledWith(
			"Parsed 3 secrets and exported to GITHUB_ENV.",
		);
	});

	it("should default to empty object if APP_SECRETS is missing", () => {
		const env: NodeJS.ProcessEnv = {
			GITHUB_ENV: "/tmp/github_env_test",
		};
		const mockAppendFileSync = vi.fn();
		const mockLog = vi.fn();
		const mockErrLog = vi.fn();
		const mockExit = vi.fn();

		parseSecrets(env, mockAppendFileSync, mockLog, mockErrLog, mockExit);

		expect(mockExit).not.toHaveBeenCalled();
		expect(mockAppendFileSync).toHaveBeenCalledTimes(1);

		const content = mockAppendFileSync.mock.calls[0][1] as string;
		expect(content).not.toContain("FOO<<");
		expect(content).toMatch(/SECRET_KEYS<<.*\n\n.*\n/); // Empty string for keys
	});

	it("should handle invalid JSON in APP_SECRETS", () => {
		const env: NodeJS.ProcessEnv = {
			APP_SECRETS: "invalid-json",
			GITHUB_ENV: "/tmp/github_env_test",
		};
		const mockAppendFileSync = vi.fn();
		const mockLog = vi.fn();
		const mockErrLog = vi.fn();
		const mockExit = vi.fn();

		parseSecrets(env, mockAppendFileSync, mockLog, mockErrLog, mockExit);

		expect(mockExit).not.toHaveBeenCalled();
		expect(mockErrLog).toHaveBeenCalledWith(
			expect.stringContaining("Failed to parse APP_SECRETS JSON:"),
		);
		expect(mockAppendFileSync).toHaveBeenCalledTimes(1);
	});

	it("should exit with 1 if GITHUB_ENV is missing", () => {
		const env: NodeJS.ProcessEnv = {};
		const mockAppendFileSync = vi.fn();
		const mockLog = vi.fn();
		const mockErrLog = vi.fn();
		const mockExit = vi.fn();

		parseSecrets(env, mockAppendFileSync, mockLog, mockErrLog, mockExit);

		expect(mockExit).toHaveBeenCalledWith(1);
		expect(mockErrLog).toHaveBeenCalledWith("GITHUB_ENV not found");
		expect(mockAppendFileSync).not.toHaveBeenCalled();
	});
});
