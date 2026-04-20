#!/usr/bin/env node
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
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
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// scripts/bootstrap-secrets.ts
var bootstrap_secrets_exports = {};
__export(bootstrap_secrets_exports, {
  bootstrapSecrets: () => bootstrapSecrets
});
module.exports = __toCommonJS(bootstrap_secrets_exports);
var import_node_crypto = require("node:crypto");
var import_node_url = require("node:url");
var import_meta = {};
var crypto = import_node_crypto.webcrypto;
async function kvGet(accountId, apiToken, namespaceId, key) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/values/${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiToken}` }
  });
  if (res.status === 404) return null;
  if (!res.ok)
    throw new Error(`KV GET failed: ${res.status} ${await res.text()}`);
  return res.text();
}
async function kvPut(accountId, apiToken, namespaceId, key, value) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/values/${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "text/plain"
    },
    body: value
  });
  if (!res.ok)
    throw new Error(`KV PUT failed: ${res.status} ${await res.text()}`);
}
async function setWorkerSecret(accountId, apiToken, workerName, name, value) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/${workerName}/secrets`;
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ name, text: value, type: "secret_text" })
  });
  if (!res.ok)
    throw new Error(
      `Set secret on ${workerName} failed: ${res.status} ${await res.text()}`
    );
}
async function importKey(keyBase64, usage) {
  const keyBytes = Buffer.from(keyBase64, "base64");
  return crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, usage);
}
async function encrypt(plaintext, keyBase64) {
  const key = await importKey(keyBase64, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoded
  );
  const ivB64 = Buffer.from(iv).toString("base64");
  const ctB64 = Buffer.from(new Uint8Array(ciphertext)).toString("base64");
  return `${ivB64}:${ctB64}`;
}
async function bootstrapSecrets(env, log, errLog, exit) {
  const {
    CLOUDFLARE_ACCOUNT_ID: accountId,
    CLOUDFLARE_API_TOKEN: apiToken,
    KV_NAMESPACE_ID: kvNamespaceId,
    AUTH_WORKER_NAME: authWorkerName,
    ROTATION_WORKER_NAME: rotationWorkerName,
    FORCE_ROTATE: forceRotateStr
  } = env;
  const forceRotate = forceRotateStr === "true";
  if (!accountId || !apiToken || !kvNamespaceId || !authWorkerName || !rotationWorkerName) {
    errLog(
      "Missing required environment variables: CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN, KV_NAMESPACE_ID, AUTH_WORKER_NAME, ROTATION_WORKER_NAME"
    );
    exit(1);
    return;
  }
  const existing = await kvGet(
    accountId,
    apiToken,
    kvNamespaceId,
    "BETTER_AUTH_SECRETS"
  );
  if (existing && !forceRotate) {
    log("BETTER_AUTH_SECRETS already present in KV \u2014 skipping bootstrap.");
    return;
  }
  if (forceRotate) {
    log(
      "Force rotate requested \u2014 discarding all existing versions and regenerating."
    );
  }
  const encKeyBytes = crypto.getRandomValues(new Uint8Array(32));
  const encKeyBase64 = Buffer.from(encKeyBytes).toString("base64");
  const secretBytes = crypto.getRandomValues(new Uint8Array(32));
  const secretBase64 = Buffer.from(secretBytes).toString("base64");
  const secretsStr = `1:${secretBase64}`;
  const encrypted = await encrypt(secretsStr, encKeyBase64);
  await kvPut(
    accountId,
    apiToken,
    kvNamespaceId,
    "BETTER_AUTH_SECRETS",
    encrypted
  );
  log("BETTER_AUTH_SECRETS written to KV.");
  await setWorkerSecret(
    accountId,
    apiToken,
    authWorkerName,
    "BAO_KV_ENCRYPTION_KEY",
    encKeyBase64
  );
  log(`BAO_KV_ENCRYPTION_KEY set on ${authWorkerName}.`);
  await setWorkerSecret(
    accountId,
    apiToken,
    rotationWorkerName,
    "BAO_KV_ENCRYPTION_KEY",
    encKeyBase64
  );
  log(`BAO_KV_ENCRYPTION_KEY set on ${rotationWorkerName}.`);
  log("Bootstrap complete.");
}
async function main() {
  await bootstrapSecrets(process.env, console.log, console.error, process.exit);
}
if (process.argv[1] === (0, import_node_url.fileURLToPath)(import_meta.url)) {
  main().catch((err) => {
    console.error(`::error::${err.message}`);
    process.exit(1);
  });
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  bootstrapSecrets
});
