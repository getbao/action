import { configure, getConsoleSink, getLogger } from "@logtape/logtape";
import { build } from "esbuild";

const SCRIPTS = [
	"download-assets",
	"generate-config",
	"parse-secrets",
	"bootstrap-secrets",
	"parse-tofu-outputs",
];

await configure({
	sinks: { console: getConsoleSink() },
	loggers: [
		{ category: ["bao"], sinks: ["console"], lowestLevel: "info" },
		{ category: ["logtape", "meta"], sinks: [], lowestLevel: "fatal" },
	],
});

const logger = getLogger(["bao", "action", "build"]);
const start = Date.now();
logger.info("Building {count} scripts...", { count: SCRIPTS.length });

const results = await Promise.allSettled(
	SCRIPTS.map((name) =>
		build({
			entryPoints: [`entrypoints/${name}.ts`],
			outfile: `dist/${name}.js`,
			bundle: true,
			platform: "node",
			target: "node24",
			format: "cjs",
			sourcemap: true,
			sourcesContent: true,
		}).then(() => name),
	),
);

let failed = false;
for (const result of results) {
	if (result.status === "fulfilled") {
		logger.info("  ✓ dist/{name}.js", { name: result.value });
	} else {
		logger.error("  ✗ {reason}", { reason: String(result.reason) });
		failed = true;
	}
}

logger.info("Done in {ms}ms", { ms: Date.now() - start });
if (failed) process.exit(1);
