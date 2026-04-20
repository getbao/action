#!/usr/bin/env node
"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// scripts/parse-secrets.ts
var parse_secrets_exports = {};
__export(parse_secrets_exports, {
  parseSecrets: () => parseSecrets
});
module.exports = __toCommonJS(parse_secrets_exports);
var import_node_crypto = __toESM(require("node:crypto"));
var import_node_fs = __toESM(require("node:fs"));
var import_node_url = require("node:url");
var import_meta = {};
function parseSecrets(env, appendFileSync, log, errLog, exit) {
  const appSecretsStr = env.APP_SECRETS || "{}";
  const githubEnvPath = env.GITHUB_ENV;
  if (!githubEnvPath) {
    errLog("GITHUB_ENV not found");
    exit(1);
    return;
  }
  let appSecrets = {};
  try {
    appSecrets = JSON.parse(
      appSecretsStr === '""' || appSecretsStr === "''" ? "{}" : appSecretsStr
    );
  } catch (err) {
    errLog(`Failed to parse APP_SECRETS JSON: ${err.message}`);
    appSecrets = {};
  }
  const delimiter = import_node_crypto.default.randomBytes(16).toString("hex");
  const keys = Object.keys(appSecrets);
  let envFileContent = "";
  for (const [key, value] of Object.entries(appSecrets)) {
    const stringValue = String(value);
    const finalValue = stringValue === "" ? "UNSET" : stringValue;
    envFileContent += `${key}<<${delimiter}
${finalValue}
${delimiter}
`;
  }
  const secretKeysList = keys.join("\n");
  envFileContent += `SECRET_KEYS<<${delimiter}
${secretKeysList}
${delimiter}
`;
  appendFileSync(githubEnvPath, envFileContent);
  log(`Parsed ${keys.length} secrets and exported to GITHUB_ENV.`);
}
function main() {
  parseSecrets(
    process.env,
    import_node_fs.default.appendFileSync,
    console.log,
    console.error,
    process.exit
  );
}
if (process.argv[1] === (0, import_node_url.fileURLToPath)(import_meta.url)) {
  main();
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  parseSecrets
});
