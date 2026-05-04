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

// scripts/download-assets.ts
var download_assets_exports = {};
__export(download_assets_exports, {
  downloadAssets: () => downloadAssets
});
module.exports = __toCommonJS(download_assets_exports);
var import_node_child_process = require("node:child_process");
var import_node_crypto = require("node:crypto");
var import_promises = require("node:fs/promises");
var import_node_path = require("node:path");

// ../../node_modules/.pnpm/@logtape+logtape@2.0.2/node_modules/@logtape/logtape/dist/filter.js
function toFilter(filter) {
  if (typeof filter === "function") return filter;
  return getLevelFilter(filter);
}
function getLevelFilter(level) {
  if (level == null) return () => false;
  if (level === "fatal") return (record) => record.level === "fatal";
  else if (level === "error") return (record) => record.level === "fatal" || record.level === "error";
  else if (level === "warning") return (record) => record.level === "fatal" || record.level === "error" || record.level === "warning";
  else if (level === "info") return (record) => record.level === "fatal" || record.level === "error" || record.level === "warning" || record.level === "info";
  else if (level === "debug") return (record) => record.level === "fatal" || record.level === "error" || record.level === "warning" || record.level === "info" || record.level === "debug";
  else if (level === "trace") return () => true;
  throw new TypeError(`Invalid log level: ${level}.`);
}

// ../../node_modules/.pnpm/@logtape+logtape@2.0.2/node_modules/@logtape/logtape/dist/level.js
var logLevels = [
  "trace",
  "debug",
  "info",
  "warning",
  "error",
  "fatal"
];
function compareLogLevel(a, b) {
  const aIndex = logLevels.indexOf(a);
  if (aIndex < 0) throw new TypeError(`Invalid log level: ${JSON.stringify(a)}.`);
  const bIndex = logLevels.indexOf(b);
  if (bIndex < 0) throw new TypeError(`Invalid log level: ${JSON.stringify(b)}.`);
  return aIndex - bIndex;
}

// ../../node_modules/.pnpm/@logtape+logtape@2.0.2/node_modules/@logtape/logtape/dist/logger.js
var lazySymbol = /* @__PURE__ */ Symbol.for("logtape.lazy");
function isLazy(value) {
  return value != null && typeof value === "object" && lazySymbol in value && value[lazySymbol] === true;
}
function resolveProperties(properties) {
  const resolved = {};
  for (const key in properties) {
    const value = properties[key];
    resolved[key] = isLazy(value) ? value.getter() : value;
  }
  return resolved;
}
function getLogger(category = []) {
  return LoggerImpl.getLogger(category);
}
var globalRootLoggerSymbol = /* @__PURE__ */ Symbol.for("logtape.rootLogger");
var LoggerImpl = class LoggerImpl2 {
  parent;
  children;
  category;
  sinks;
  parentSinks = "inherit";
  filters;
  lowestLevel = "trace";
  contextLocalStorage;
  static getLogger(category = []) {
    let rootLogger = globalRootLoggerSymbol in globalThis ? globalThis[globalRootLoggerSymbol] ?? null : null;
    if (rootLogger == null) {
      rootLogger = new LoggerImpl2(null, []);
      globalThis[globalRootLoggerSymbol] = rootLogger;
    }
    if (typeof category === "string") return rootLogger.getChild(category);
    if (category.length === 0) return rootLogger;
    return rootLogger.getChild(category);
  }
  constructor(parent, category) {
    this.parent = parent;
    this.children = {};
    this.category = category;
    this.sinks = [];
    this.filters = [];
  }
  getChild(subcategory) {
    const name = typeof subcategory === "string" ? subcategory : subcategory[0];
    const childRef = this.children[name];
    let child = childRef instanceof LoggerImpl2 ? childRef : childRef?.deref();
    if (child == null) {
      child = new LoggerImpl2(this, [...this.category, name]);
      this.children[name] = "WeakRef" in globalThis ? new WeakRef(child) : child;
    }
    if (typeof subcategory === "string" || subcategory.length === 1) return child;
    return child.getChild(subcategory.slice(1));
  }
  /**
  * Reset the logger.  This removes all sinks and filters from the logger.
  */
  reset() {
    while (this.sinks.length > 0) this.sinks.shift();
    this.parentSinks = "inherit";
    while (this.filters.length > 0) this.filters.shift();
    this.lowestLevel = "trace";
  }
  /**
  * Reset the logger and all its descendants.  This removes all sinks and
  * filters from the logger and all its descendants.
  */
  resetDescendants() {
    for (const child of Object.values(this.children)) {
      const logger = child instanceof LoggerImpl2 ? child : child.deref();
      if (logger != null) logger.resetDescendants();
    }
    this.reset();
  }
  with(properties) {
    return new LoggerCtx(this, { ...properties });
  }
  filter(record) {
    for (const filter of this.filters) if (!filter(record)) return false;
    if (this.filters.length < 1) return this.parent?.filter(record) ?? true;
    return true;
  }
  *getSinks(level) {
    if (this.lowestLevel === null || compareLogLevel(level, this.lowestLevel) < 0) return;
    if (this.parent != null && this.parentSinks === "inherit") for (const sink of this.parent.getSinks(level)) yield sink;
    for (const sink of this.sinks) yield sink;
  }
  isEnabledFor(level) {
    if (this.lowestLevel === null || compareLogLevel(level, this.lowestLevel) < 0) return false;
    for (const _ of this.getSinks(level)) return true;
    return false;
  }
  emit(record, bypassSinks) {
    const categoryPrefix = getCategoryPrefix();
    const baseCategory = "category" in record ? record.category : this.category;
    const fullCategory = categoryPrefix.length > 0 ? [...categoryPrefix, ...baseCategory] : baseCategory;
    const descriptors = Object.getOwnPropertyDescriptors(record);
    descriptors.category = {
      value: fullCategory,
      enumerable: true,
      configurable: true
    };
    const fullRecord = Object.defineProperties({}, descriptors);
    if (this.lowestLevel === null || compareLogLevel(fullRecord.level, this.lowestLevel) < 0 || !this.filter(fullRecord)) return;
    for (const sink of this.getSinks(fullRecord.level)) {
      if (bypassSinks?.has(sink)) continue;
      try {
        sink(fullRecord);
      } catch (error) {
        const bypassSinks2 = new Set(bypassSinks);
        bypassSinks2.add(sink);
        metaLogger.log("fatal", "Failed to emit a log record to sink {sink}: {error}", {
          sink,
          error,
          record: fullRecord
        }, bypassSinks2);
      }
    }
  }
  log(level, rawMessage, properties, bypassSinks) {
    const implicitContext = getImplicitContext();
    let cachedProps = void 0;
    const record = typeof properties === "function" ? {
      category: this.category,
      level,
      timestamp: Date.now(),
      get message() {
        return parseMessageTemplate(rawMessage, this.properties);
      },
      rawMessage,
      get properties() {
        if (cachedProps == null) cachedProps = {
          ...implicitContext,
          ...properties()
        };
        return cachedProps;
      }
    } : {
      category: this.category,
      level,
      timestamp: Date.now(),
      message: parseMessageTemplate(rawMessage, {
        ...implicitContext,
        ...properties
      }),
      rawMessage,
      properties: {
        ...implicitContext,
        ...properties
      }
    };
    this.emit(record, bypassSinks);
  }
  logLazily(level, callback, properties = {}) {
    const implicitContext = getImplicitContext();
    let rawMessage = void 0;
    let msg = void 0;
    function realizeMessage() {
      if (msg == null || rawMessage == null) {
        msg = callback((tpl, ...values) => {
          rawMessage = tpl;
          return renderMessage(tpl, values);
        });
        if (rawMessage == null) throw new TypeError("No log record was made.");
      }
      return [msg, rawMessage];
    }
    this.emit({
      category: this.category,
      level,
      get message() {
        return realizeMessage()[0];
      },
      get rawMessage() {
        return realizeMessage()[1];
      },
      timestamp: Date.now(),
      properties: {
        ...implicitContext,
        ...properties
      }
    });
  }
  logTemplate(level, messageTemplate, values, properties = {}) {
    const implicitContext = getImplicitContext();
    this.emit({
      category: this.category,
      level,
      message: renderMessage(messageTemplate, values),
      rawMessage: messageTemplate,
      timestamp: Date.now(),
      properties: {
        ...implicitContext,
        ...properties
      }
    });
  }
  trace(message, ...values) {
    if (typeof message === "string") {
      const props = values[0];
      if (typeof props === "function") {
        if (props.constructor.name === "AsyncFunction") {
          if (!this.isEnabledFor("trace")) return Promise.resolve();
          return props().then((resolvedProps) => {
            this.log("trace", message, resolvedProps);
          });
        }
        const result = props();
        if (result instanceof Promise) {
          if (!this.isEnabledFor("trace")) return Promise.resolve();
          return result.then((resolvedProps) => {
            this.log("trace", message, resolvedProps);
          });
        }
        this.log("trace", message, result);
        return;
      }
      this.log("trace", message, props ?? {});
    } else if (typeof message === "function") this.logLazily("trace", message);
    else if (!Array.isArray(message)) this.log("trace", "{*}", message);
    else this.logTemplate("trace", message, values);
  }
  debug(message, ...values) {
    if (typeof message === "string") {
      const props = values[0];
      if (typeof props === "function") {
        if (props.constructor.name === "AsyncFunction") {
          if (!this.isEnabledFor("debug")) return Promise.resolve();
          return props().then((resolvedProps) => {
            this.log("debug", message, resolvedProps);
          });
        }
        const result = props();
        if (result instanceof Promise) {
          if (!this.isEnabledFor("debug")) return Promise.resolve();
          return result.then((resolvedProps) => {
            this.log("debug", message, resolvedProps);
          });
        }
        this.log("debug", message, result);
        return;
      }
      this.log("debug", message, props ?? {});
    } else if (typeof message === "function") this.logLazily("debug", message);
    else if (!Array.isArray(message)) this.log("debug", "{*}", message);
    else this.logTemplate("debug", message, values);
  }
  info(message, ...values) {
    if (typeof message === "string") {
      const props = values[0];
      if (typeof props === "function") {
        if (props.constructor.name === "AsyncFunction") {
          if (!this.isEnabledFor("info")) return Promise.resolve();
          return props().then((resolvedProps) => {
            this.log("info", message, resolvedProps);
          });
        }
        const result = props();
        if (result instanceof Promise) {
          if (!this.isEnabledFor("info")) return Promise.resolve();
          return result.then((resolvedProps) => {
            this.log("info", message, resolvedProps);
          });
        }
        this.log("info", message, result);
        return;
      }
      this.log("info", message, props ?? {});
    } else if (typeof message === "function") this.logLazily("info", message);
    else if (!Array.isArray(message)) this.log("info", "{*}", message);
    else this.logTemplate("info", message, values);
  }
  warn(message, ...values) {
    if (message instanceof Error) this.log("warning", "{error.message}", { error: message });
    else if (typeof message === "string" && values[0] instanceof Error) this.log("warning", message, { error: values[0] });
    else if (typeof message === "string") {
      const props = values[0];
      if (typeof props === "function") {
        if (props.constructor.name === "AsyncFunction") {
          if (!this.isEnabledFor("warning")) return Promise.resolve();
          return props().then((resolvedProps) => {
            this.log("warning", message, resolvedProps);
          });
        }
        const result = props();
        if (result instanceof Promise) {
          if (!this.isEnabledFor("warning")) return Promise.resolve();
          return result.then((resolvedProps) => {
            this.log("warning", message, resolvedProps);
          });
        }
        this.log("warning", message, result);
        return;
      }
      this.log("warning", message, props ?? {});
    } else if (typeof message === "function") this.logLazily("warning", message);
    else if (!Array.isArray(message)) this.log("warning", "{*}", message);
    else this.logTemplate("warning", message, values);
  }
  warning(message, ...values) {
    if (message instanceof Error) this.log("warning", "{error.message}", { error: message });
    else if (typeof message === "string" && values[0] instanceof Error) this.log("warning", message, { error: values[0] });
    else if (typeof message === "string") {
      const props = values[0];
      if (typeof props === "function") {
        if (props.constructor.name === "AsyncFunction") {
          if (!this.isEnabledFor("warning")) return Promise.resolve();
          return props().then((resolvedProps) => {
            this.log("warning", message, resolvedProps);
          });
        }
        const result = props();
        if (result instanceof Promise) {
          if (!this.isEnabledFor("warning")) return Promise.resolve();
          return result.then((resolvedProps) => {
            this.log("warning", message, resolvedProps);
          });
        }
        this.log("warning", message, result);
        return;
      }
      this.log("warning", message, props ?? {});
    } else if (typeof message === "function") this.logLazily("warning", message);
    else if (!Array.isArray(message)) this.log("warning", "{*}", message);
    else this.logTemplate("warning", message, values);
  }
  error(message, ...values) {
    if (message instanceof Error) this.log("error", "{error.message}", { error: message });
    else if (typeof message === "string" && values[0] instanceof Error) this.log("error", message, { error: values[0] });
    else if (typeof message === "string") {
      const props = values[0];
      if (typeof props === "function") {
        if (props.constructor.name === "AsyncFunction") {
          if (!this.isEnabledFor("error")) return Promise.resolve();
          return props().then((resolvedProps) => {
            this.log("error", message, resolvedProps);
          });
        }
        const result = props();
        if (result instanceof Promise) {
          if (!this.isEnabledFor("error")) return Promise.resolve();
          return result.then((resolvedProps) => {
            this.log("error", message, resolvedProps);
          });
        }
        this.log("error", message, result);
        return;
      }
      this.log("error", message, props ?? {});
    } else if (typeof message === "function") this.logLazily("error", message);
    else if (!Array.isArray(message)) this.log("error", "{*}", message);
    else this.logTemplate("error", message, values);
  }
  fatal(message, ...values) {
    if (message instanceof Error) this.log("fatal", "{error.message}", { error: message });
    else if (typeof message === "string" && values[0] instanceof Error) this.log("fatal", message, { error: values[0] });
    else if (typeof message === "string") {
      const props = values[0];
      if (typeof props === "function") {
        if (props.constructor.name === "AsyncFunction") {
          if (!this.isEnabledFor("fatal")) return Promise.resolve();
          return props().then((resolvedProps) => {
            this.log("fatal", message, resolvedProps);
          });
        }
        const result = props();
        if (result instanceof Promise) {
          if (!this.isEnabledFor("fatal")) return Promise.resolve();
          return result.then((resolvedProps) => {
            this.log("fatal", message, resolvedProps);
          });
        }
        this.log("fatal", message, result);
        return;
      }
      this.log("fatal", message, props ?? {});
    } else if (typeof message === "function") this.logLazily("fatal", message);
    else if (!Array.isArray(message)) this.log("fatal", "{*}", message);
    else this.logTemplate("fatal", message, values);
  }
};
var LoggerCtx = class LoggerCtx2 {
  logger;
  properties;
  constructor(logger, properties) {
    this.logger = logger;
    this.properties = properties;
  }
  get category() {
    return this.logger.category;
  }
  get parent() {
    return this.logger.parent;
  }
  getChild(subcategory) {
    return this.logger.getChild(subcategory).with(this.properties);
  }
  with(properties) {
    return new LoggerCtx2(this.logger, {
      ...this.properties,
      ...properties
    });
  }
  log(level, message, properties, bypassSinks) {
    const contextProps = this.properties;
    this.logger.log(level, message, typeof properties === "function" ? () => resolveProperties({
      ...contextProps,
      ...properties()
    }) : () => resolveProperties({
      ...contextProps,
      ...properties
    }), bypassSinks);
  }
  logLazily(level, callback) {
    this.logger.logLazily(level, callback, resolveProperties(this.properties));
  }
  logTemplate(level, messageTemplate, values) {
    this.logger.logTemplate(level, messageTemplate, values, resolveProperties(this.properties));
  }
  emit(record) {
    const recordWithContext = {
      ...record,
      properties: resolveProperties({
        ...this.properties,
        ...record.properties
      })
    };
    this.logger.emit(recordWithContext);
  }
  isEnabledFor(level) {
    return this.logger.isEnabledFor(level);
  }
  trace(message, ...values) {
    if (typeof message === "string") {
      const props = values[0];
      if (typeof props === "function") {
        if (props.constructor.name === "AsyncFunction") {
          if (!this.isEnabledFor("trace")) return Promise.resolve();
          return props().then((resolvedProps) => {
            this.log("trace", message, resolvedProps);
          });
        }
        const result = props();
        if (result instanceof Promise) {
          if (!this.isEnabledFor("trace")) return Promise.resolve();
          return result.then((resolvedProps) => {
            this.log("trace", message, resolvedProps);
          });
        }
        this.log("trace", message, result);
        return;
      }
      this.log("trace", message, props ?? {});
    } else if (typeof message === "function") this.logLazily("trace", message);
    else if (!Array.isArray(message)) this.log("trace", "{*}", message);
    else this.logTemplate("trace", message, values);
  }
  debug(message, ...values) {
    if (typeof message === "string") {
      const props = values[0];
      if (typeof props === "function") {
        if (props.constructor.name === "AsyncFunction") {
          if (!this.isEnabledFor("debug")) return Promise.resolve();
          return props().then((resolvedProps) => {
            this.log("debug", message, resolvedProps);
          });
        }
        const result = props();
        if (result instanceof Promise) {
          if (!this.isEnabledFor("debug")) return Promise.resolve();
          return result.then((resolvedProps) => {
            this.log("debug", message, resolvedProps);
          });
        }
        this.log("debug", message, result);
        return;
      }
      this.log("debug", message, props ?? {});
    } else if (typeof message === "function") this.logLazily("debug", message);
    else if (!Array.isArray(message)) this.log("debug", "{*}", message);
    else this.logTemplate("debug", message, values);
  }
  info(message, ...values) {
    if (typeof message === "string") {
      const props = values[0];
      if (typeof props === "function") {
        if (props.constructor.name === "AsyncFunction") {
          if (!this.isEnabledFor("info")) return Promise.resolve();
          return props().then((resolvedProps) => {
            this.log("info", message, resolvedProps);
          });
        }
        const result = props();
        if (result instanceof Promise) {
          if (!this.isEnabledFor("info")) return Promise.resolve();
          return result.then((resolvedProps) => {
            this.log("info", message, resolvedProps);
          });
        }
        this.log("info", message, result);
        return;
      }
      this.log("info", message, props ?? {});
    } else if (typeof message === "function") this.logLazily("info", message);
    else if (!Array.isArray(message)) this.log("info", "{*}", message);
    else this.logTemplate("info", message, values);
  }
  warn(message, ...values) {
    if (message instanceof Error) this.log("warning", "{error.message}", { error: message });
    else if (typeof message === "string" && values[0] instanceof Error) this.log("warning", message, { error: values[0] });
    else if (typeof message === "string") {
      const props = values[0];
      if (typeof props === "function") {
        if (props.constructor.name === "AsyncFunction") {
          if (!this.isEnabledFor("warning")) return Promise.resolve();
          return props().then((resolvedProps) => {
            this.log("warning", message, resolvedProps);
          });
        }
        const result = props();
        if (result instanceof Promise) {
          if (!this.isEnabledFor("warning")) return Promise.resolve();
          return result.then((resolvedProps) => {
            this.log("warning", message, resolvedProps);
          });
        }
        this.log("warning", message, result);
        return;
      }
      this.log("warning", message, props ?? {});
    } else if (typeof message === "function") this.logLazily("warning", message);
    else if (!Array.isArray(message)) this.log("warning", "{*}", message);
    else this.logTemplate("warning", message, values);
  }
  warning(message, ...values) {
    if (message instanceof Error) this.log("warning", "{error.message}", { error: message });
    else if (typeof message === "string" && values[0] instanceof Error) this.log("warning", message, { error: values[0] });
    else if (typeof message === "string") {
      const props = values[0];
      if (typeof props === "function") {
        if (props.constructor.name === "AsyncFunction") {
          if (!this.isEnabledFor("warning")) return Promise.resolve();
          return props().then((resolvedProps) => {
            this.log("warning", message, resolvedProps);
          });
        }
        const result = props();
        if (result instanceof Promise) {
          if (!this.isEnabledFor("warning")) return Promise.resolve();
          return result.then((resolvedProps) => {
            this.log("warning", message, resolvedProps);
          });
        }
        this.log("warning", message, result);
        return;
      }
      this.log("warning", message, props ?? {});
    } else if (typeof message === "function") this.logLazily("warning", message);
    else if (!Array.isArray(message)) this.log("warning", "{*}", message);
    else this.logTemplate("warning", message, values);
  }
  error(message, ...values) {
    if (message instanceof Error) this.log("error", "{error.message}", { error: message });
    else if (typeof message === "string" && values[0] instanceof Error) this.log("error", message, { error: values[0] });
    else if (typeof message === "string") {
      const props = values[0];
      if (typeof props === "function") {
        if (props.constructor.name === "AsyncFunction") {
          if (!this.isEnabledFor("error")) return Promise.resolve();
          return props().then((resolvedProps) => {
            this.log("error", message, resolvedProps);
          });
        }
        const result = props();
        if (result instanceof Promise) {
          if (!this.isEnabledFor("error")) return Promise.resolve();
          return result.then((resolvedProps) => {
            this.log("error", message, resolvedProps);
          });
        }
        this.log("error", message, result);
        return;
      }
      this.log("error", message, props ?? {});
    } else if (typeof message === "function") this.logLazily("error", message);
    else if (!Array.isArray(message)) this.log("error", "{*}", message);
    else this.logTemplate("error", message, values);
  }
  fatal(message, ...values) {
    if (message instanceof Error) this.log("fatal", "{error.message}", { error: message });
    else if (typeof message === "string" && values[0] instanceof Error) this.log("fatal", message, { error: values[0] });
    else if (typeof message === "string") {
      const props = values[0];
      if (typeof props === "function") {
        if (props.constructor.name === "AsyncFunction") {
          if (!this.isEnabledFor("fatal")) return Promise.resolve();
          return props().then((resolvedProps) => {
            this.log("fatal", message, resolvedProps);
          });
        }
        const result = props();
        if (result instanceof Promise) {
          if (!this.isEnabledFor("fatal")) return Promise.resolve();
          return result.then((resolvedProps) => {
            this.log("fatal", message, resolvedProps);
          });
        }
        this.log("fatal", message, result);
        return;
      }
      this.log("fatal", message, props ?? {});
    } else if (typeof message === "function") this.logLazily("fatal", message);
    else if (!Array.isArray(message)) this.log("fatal", "{*}", message);
    else this.logTemplate("fatal", message, values);
  }
};
var metaLogger = LoggerImpl.getLogger(["logtape", "meta"]);
function isNestedAccess(key) {
  return key.includes(".") || key.includes("[") || key.includes("?.");
}
function getOwnProperty(obj, key) {
  if (key === "__proto__" || key === "prototype" || key === "constructor") return void 0;
  if ((typeof obj === "object" || typeof obj === "function") && obj !== null) return Object.prototype.hasOwnProperty.call(obj, key) ? obj[key] : void 0;
  return void 0;
}
function parseNextSegment(path, fromIndex) {
  const len = path.length;
  let i = fromIndex;
  if (i >= len) return null;
  let segment;
  if (path[i] === "[") {
    i++;
    if (i >= len) return null;
    if (path[i] === '"' || path[i] === "'") {
      const quote = path[i];
      i++;
      let segmentStr = "";
      while (i < len && path[i] !== quote) if (path[i] === "\\") {
        i++;
        if (i < len) {
          const escapeChar = path[i];
          switch (escapeChar) {
            case "n":
              segmentStr += "\n";
              break;
            case "t":
              segmentStr += "	";
              break;
            case "r":
              segmentStr += "\r";
              break;
            case "b":
              segmentStr += "\b";
              break;
            case "f":
              segmentStr += "\f";
              break;
            case "v":
              segmentStr += "\v";
              break;
            case "0":
              segmentStr += "\0";
              break;
            case "\\":
              segmentStr += "\\";
              break;
            case '"':
              segmentStr += '"';
              break;
            case "'":
              segmentStr += "'";
              break;
            case "u":
              if (i + 4 < len) {
                const hex = path.slice(i + 1, i + 5);
                const codePoint = Number.parseInt(hex, 16);
                if (!Number.isNaN(codePoint)) {
                  segmentStr += String.fromCharCode(codePoint);
                  i += 4;
                } else segmentStr += escapeChar;
              } else segmentStr += escapeChar;
              break;
            default:
              segmentStr += escapeChar;
          }
          i++;
        }
      } else {
        segmentStr += path[i];
        i++;
      }
      if (i >= len) return null;
      segment = segmentStr;
      i++;
    } else {
      const startIndex = i;
      while (i < len && path[i] !== "]" && path[i] !== "'" && path[i] !== '"') i++;
      if (i >= len) return null;
      const indexStr = path.slice(startIndex, i);
      if (indexStr.length === 0) return null;
      const indexNum = Number(indexStr);
      segment = Number.isNaN(indexNum) ? indexStr : indexNum;
    }
    while (i < len && path[i] !== "]") i++;
    if (i < len) i++;
  } else {
    const startIndex = i;
    while (i < len && path[i] !== "." && path[i] !== "[" && path[i] !== "?" && path[i] !== "]") i++;
    segment = path.slice(startIndex, i);
    if (segment.length === 0) return null;
  }
  if (i < len && path[i] === ".") i++;
  return {
    segment,
    nextIndex: i
  };
}
function accessProperty(obj, segment) {
  if (typeof segment === "string") return getOwnProperty(obj, segment);
  if (Array.isArray(obj) && segment >= 0 && segment < obj.length) return obj[segment];
  return void 0;
}
function resolvePropertyPath(obj, path) {
  if (obj == null) return void 0;
  if (path.length === 0 || path.endsWith(".")) return void 0;
  let current = obj;
  let i = 0;
  const len = path.length;
  while (i < len) {
    const isOptional = path.slice(i, i + 2) === "?.";
    if (isOptional) {
      i += 2;
      if (current == null) return void 0;
    } else if (current == null) return void 0;
    const result = parseNextSegment(path, i);
    if (result === null) return void 0;
    const { segment, nextIndex } = result;
    i = nextIndex;
    current = accessProperty(current, segment);
    if (current === void 0) return void 0;
  }
  return current;
}
function parseMessageTemplate(template, properties) {
  const length = template.length;
  if (length === 0) return [""];
  if (!template.includes("{")) return [template];
  const message = [];
  let startIndex = 0;
  for (let i = 0; i < length; i++) {
    const char = template[i];
    if (char === "{") {
      const nextChar = i + 1 < length ? template[i + 1] : "";
      if (nextChar === "{") {
        i++;
        continue;
      }
      const closeIndex = template.indexOf("}", i + 1);
      if (closeIndex === -1) continue;
      const beforeText = template.slice(startIndex, i);
      message.push(beforeText.replace(/{{/g, "{").replace(/}}/g, "}"));
      const key = template.slice(i + 1, closeIndex);
      let prop;
      const trimmedKey = key.trim();
      if (trimmedKey === "*") prop = key in properties ? properties[key] : "*" in properties ? properties["*"] : properties;
      else {
        if (key !== trimmedKey) prop = key in properties ? properties[key] : properties[trimmedKey];
        else prop = properties[key];
        if (prop === void 0 && isNestedAccess(trimmedKey)) prop = resolvePropertyPath(properties, trimmedKey);
      }
      message.push(prop);
      i = closeIndex;
      startIndex = i + 1;
    } else if (char === "}" && i + 1 < length && template[i + 1] === "}") i++;
  }
  const remainingText = template.slice(startIndex);
  message.push(remainingText.replace(/{{/g, "{").replace(/}}/g, "}"));
  return message;
}
function renderMessage(template, values) {
  const args = [];
  for (let i = 0; i < template.length; i++) {
    args.push(template[i]);
    if (i < values.length) args.push(values[i]);
  }
  return args;
}

// ../../node_modules/.pnpm/@logtape+logtape@2.0.2/node_modules/@logtape/logtape/dist/context.js
var categoryPrefixSymbol = /* @__PURE__ */ Symbol.for("logtape.categoryPrefix");
function getCategoryPrefix() {
  const rootLogger = LoggerImpl.getLogger();
  const store = rootLogger.contextLocalStorage?.getStore();
  if (store == null) return [];
  const prefix = store[categoryPrefixSymbol];
  return Array.isArray(prefix) ? prefix : [];
}
function getImplicitContext() {
  const rootLogger = LoggerImpl.getLogger();
  const store = rootLogger.contextLocalStorage?.getStore();
  if (store == null) return {};
  const result = {};
  for (const key of Object.keys(store)) result[key] = store[key];
  return result;
}

// ../../node_modules/.pnpm/@logtape+logtape@2.0.2/node_modules/@logtape/logtape/dist/util.node.js
var util_node_exports = {};
__export(util_node_exports, {
  inspect: () => inspect
});
var import_node_util = __toESM(require("node:util"), 1);
function inspect(obj, options) {
  return import_node_util.default.inspect(obj, options);
}

// ../../node_modules/.pnpm/@logtape+logtape@2.0.2/node_modules/@logtape/logtape/dist/formatter.js
var levelAbbreviations = {
  "trace": "TRC",
  "debug": "DBG",
  "info": "INF",
  "warning": "WRN",
  "error": "ERR",
  "fatal": "FTL"
};
var inspect2 = typeof document !== "undefined" || typeof navigator !== "undefined" && navigator.product === "ReactNative" ? (v) => JSON.stringify(v) : "Deno" in globalThis && "inspect" in globalThis.Deno && typeof globalThis.Deno.inspect === "function" ? (v, opts) => globalThis.Deno.inspect(v, {
  strAbbreviateSize: Infinity,
  iterableLimit: Infinity,
  ...opts
}) : util_node_exports != null && "inspect" in util_node_exports && typeof inspect === "function" ? (v, opts) => inspect(v, {
  maxArrayLength: Infinity,
  maxStringLength: Infinity,
  ...opts
}) : (v) => JSON.stringify(v);
function padZero(num) {
  return num < 10 ? `0${num}` : `${num}`;
}
function padThree(num) {
  return num < 10 ? `00${num}` : num < 100 ? `0${num}` : `${num}`;
}
var timestampFormatters = {
  "date-time-timezone": (ts) => {
    const d = new Date(ts);
    const year = d.getUTCFullYear();
    const month = padZero(d.getUTCMonth() + 1);
    const day = padZero(d.getUTCDate());
    const hour = padZero(d.getUTCHours());
    const minute = padZero(d.getUTCMinutes());
    const second = padZero(d.getUTCSeconds());
    const ms = padThree(d.getUTCMilliseconds());
    return `${year}-${month}-${day} ${hour}:${minute}:${second}.${ms} +00:00`;
  },
  "date-time-tz": (ts) => {
    const d = new Date(ts);
    const year = d.getUTCFullYear();
    const month = padZero(d.getUTCMonth() + 1);
    const day = padZero(d.getUTCDate());
    const hour = padZero(d.getUTCHours());
    const minute = padZero(d.getUTCMinutes());
    const second = padZero(d.getUTCSeconds());
    const ms = padThree(d.getUTCMilliseconds());
    return `${year}-${month}-${day} ${hour}:${minute}:${second}.${ms} +00`;
  },
  "date-time": (ts) => {
    const d = new Date(ts);
    const year = d.getUTCFullYear();
    const month = padZero(d.getUTCMonth() + 1);
    const day = padZero(d.getUTCDate());
    const hour = padZero(d.getUTCHours());
    const minute = padZero(d.getUTCMinutes());
    const second = padZero(d.getUTCSeconds());
    const ms = padThree(d.getUTCMilliseconds());
    return `${year}-${month}-${day} ${hour}:${minute}:${second}.${ms}`;
  },
  "time-timezone": (ts) => {
    const d = new Date(ts);
    const hour = padZero(d.getUTCHours());
    const minute = padZero(d.getUTCMinutes());
    const second = padZero(d.getUTCSeconds());
    const ms = padThree(d.getUTCMilliseconds());
    return `${hour}:${minute}:${second}.${ms} +00:00`;
  },
  "time-tz": (ts) => {
    const d = new Date(ts);
    const hour = padZero(d.getUTCHours());
    const minute = padZero(d.getUTCMinutes());
    const second = padZero(d.getUTCSeconds());
    const ms = padThree(d.getUTCMilliseconds());
    return `${hour}:${minute}:${second}.${ms} +00`;
  },
  "time": (ts) => {
    const d = new Date(ts);
    const hour = padZero(d.getUTCHours());
    const minute = padZero(d.getUTCMinutes());
    const second = padZero(d.getUTCSeconds());
    const ms = padThree(d.getUTCMilliseconds());
    return `${hour}:${minute}:${second}.${ms}`;
  },
  "date": (ts) => {
    const d = new Date(ts);
    const year = d.getUTCFullYear();
    const month = padZero(d.getUTCMonth() + 1);
    const day = padZero(d.getUTCDate());
    return `${year}-${month}-${day}`;
  },
  "rfc3339": (ts) => new Date(ts).toISOString(),
  "none": () => null
};
var levelRenderersCache = {
  ABBR: levelAbbreviations,
  abbr: {
    trace: "trc",
    debug: "dbg",
    info: "inf",
    warning: "wrn",
    error: "err",
    fatal: "ftl"
  },
  FULL: {
    trace: "TRACE",
    debug: "DEBUG",
    info: "INFO",
    warning: "WARNING",
    error: "ERROR",
    fatal: "FATAL"
  },
  full: {
    trace: "trace",
    debug: "debug",
    info: "info",
    warning: "warning",
    error: "error",
    fatal: "fatal"
  },
  L: {
    trace: "T",
    debug: "D",
    info: "I",
    warning: "W",
    error: "E",
    fatal: "F"
  },
  l: {
    trace: "t",
    debug: "d",
    info: "i",
    warning: "w",
    error: "e",
    fatal: "f"
  }
};
function getLineEndingValue(lineEnding) {
  return lineEnding === "crlf" ? "\r\n" : "\n";
}
function jsonReplacer(_key, value) {
  if (!(value instanceof Error)) return value;
  const serialized = {
    name: value.name,
    message: value.message
  };
  if (typeof value.stack === "string") serialized.stack = value.stack;
  const cause = value.cause;
  if (cause !== void 0) serialized.cause = cause;
  if (typeof AggregateError !== "undefined" && value instanceof AggregateError) serialized.errors = value.errors;
  for (const key of Object.keys(value)) if (!(key in serialized)) serialized[key] = value[key];
  return serialized;
}
function getTextFormatter(options = {}) {
  const timestampRenderer = (() => {
    const tsOption = options.timestamp;
    if (tsOption == null) return timestampFormatters["date-time-timezone"];
    else if (tsOption === "disabled") return timestampFormatters["none"];
    else if (typeof tsOption === "string" && tsOption in timestampFormatters) return timestampFormatters[tsOption];
    else return tsOption;
  })();
  const categorySeparator = options.category ?? "\xB7";
  const valueRenderer = options.value ? (v) => options.value(v, inspect2) : inspect2;
  const levelRenderer = (() => {
    const levelOption = options.level;
    if (levelOption == null || levelOption === "ABBR") return (level) => levelRenderersCache.ABBR[level];
    else if (levelOption === "abbr") return (level) => levelRenderersCache.abbr[level];
    else if (levelOption === "FULL") return (level) => levelRenderersCache.FULL[level];
    else if (levelOption === "full") return (level) => levelRenderersCache.full[level];
    else if (levelOption === "L") return (level) => levelRenderersCache.L[level];
    else if (levelOption === "l") return (level) => levelRenderersCache.l[level];
    else return levelOption;
  })();
  const lineEnding = getLineEndingValue(options.lineEnding);
  const formatter = options.format ?? (({ timestamp, level, category, message }) => `${timestamp ? `${timestamp} ` : ""}[${level}] ${category}: ${message}`);
  return (record) => {
    const msgParts = record.message;
    const msgLen = msgParts.length;
    let message;
    if (msgLen === 1) message = msgParts[0];
    else if (msgLen <= 6) {
      message = "";
      for (let i = 0; i < msgLen; i++) message += i % 2 === 0 ? msgParts[i] : valueRenderer(msgParts[i]);
    } else {
      const parts = new Array(msgLen);
      for (let i = 0; i < msgLen; i++) parts[i] = i % 2 === 0 ? msgParts[i] : valueRenderer(msgParts[i]);
      message = parts.join("");
    }
    const timestamp = timestampRenderer(record.timestamp);
    const level = levelRenderer(record.level);
    const category = typeof categorySeparator === "function" ? categorySeparator(record.category) : record.category.join(categorySeparator);
    const values = {
      timestamp,
      level,
      category,
      message,
      record
    };
    return `${formatter(values)}${lineEnding}`;
  };
}
var defaultTextFormatter = getTextFormatter();
var RESET = "\x1B[0m";
var ansiColors = {
  black: "\x1B[30m",
  red: "\x1B[31m",
  green: "\x1B[32m",
  yellow: "\x1B[33m",
  blue: "\x1B[34m",
  magenta: "\x1B[35m",
  cyan: "\x1B[36m",
  white: "\x1B[37m"
};
var ansiStyles = {
  bold: "\x1B[1m",
  dim: "\x1B[2m",
  italic: "\x1B[3m",
  underline: "\x1B[4m",
  strikethrough: "\x1B[9m"
};
var defaultLevelColors = {
  trace: null,
  debug: "blue",
  info: "green",
  warning: "yellow",
  error: "red",
  fatal: "magenta"
};
function getAnsiColorFormatter(options = {}) {
  const format = options.format;
  const timestampStyle = typeof options.timestampStyle === "undefined" ? "dim" : options.timestampStyle;
  const timestampColor = options.timestampColor ?? null;
  const timestampPrefix = `${timestampStyle == null ? "" : ansiStyles[timestampStyle]}${timestampColor == null ? "" : ansiColors[timestampColor]}`;
  const timestampSuffix = timestampStyle == null && timestampColor == null ? "" : RESET;
  const levelStyle = typeof options.levelStyle === "undefined" ? "bold" : options.levelStyle;
  const levelColors = options.levelColors ?? defaultLevelColors;
  const categoryStyle = typeof options.categoryStyle === "undefined" ? "dim" : options.categoryStyle;
  const categoryColor = options.categoryColor ?? null;
  const categoryPrefix = `${categoryStyle == null ? "" : ansiStyles[categoryStyle]}${categoryColor == null ? "" : ansiColors[categoryColor]}`;
  const categorySuffix = categoryStyle == null && categoryColor == null ? "" : RESET;
  return getTextFormatter({
    timestamp: "date-time-tz",
    value(value, fallbackInspect) {
      return fallbackInspect(value, { colors: true });
    },
    ...options,
    format({ timestamp, level, category, message, record }) {
      const levelColor = levelColors[record.level];
      timestamp = timestamp == null ? null : `${timestampPrefix}${timestamp}${timestampSuffix}`;
      level = `${levelStyle == null ? "" : ansiStyles[levelStyle]}${levelColor == null ? "" : ansiColors[levelColor]}${level}${levelStyle == null && levelColor == null ? "" : RESET}`;
      return format == null ? `${timestamp == null ? "" : `${timestamp} `}${level} ${categoryPrefix}${category}:${categorySuffix} ${message}` : format({
        timestamp,
        level,
        category: `${categoryPrefix}${category}${categorySuffix}`,
        message,
        record
      });
    }
  });
}
var ansiColorFormatter = getAnsiColorFormatter();
function getJsonLinesFormatter(options = {}) {
  const lineEnding = getLineEndingValue(options.lineEnding);
  if (!options.categorySeparator && !options.message && !options.properties) return (record) => {
    if (record.message.length === 3) return JSON.stringify({
      "@timestamp": new Date(record.timestamp).toISOString(),
      level: record.level === "warning" ? "WARN" : record.level.toUpperCase(),
      message: record.message[0] + JSON.stringify(record.message[1]) + record.message[2],
      logger: record.category.join("."),
      properties: record.properties
    }, jsonReplacer) + lineEnding;
    if (record.message.length === 1) return JSON.stringify({
      "@timestamp": new Date(record.timestamp).toISOString(),
      level: record.level === "warning" ? "WARN" : record.level.toUpperCase(),
      message: record.message[0],
      logger: record.category.join("."),
      properties: record.properties
    }, jsonReplacer) + lineEnding;
    let msg = record.message[0];
    for (let i = 1; i < record.message.length; i++) msg += i & 1 ? JSON.stringify(record.message[i]) : record.message[i];
    return JSON.stringify({
      "@timestamp": new Date(record.timestamp).toISOString(),
      level: record.level === "warning" ? "WARN" : record.level.toUpperCase(),
      message: msg,
      logger: record.category.join("."),
      properties: record.properties
    }, jsonReplacer) + lineEnding;
  };
  const isTemplateMessage = options.message === "template";
  const propertiesOption = options.properties ?? "nest:properties";
  let joinCategory;
  if (typeof options.categorySeparator === "function") joinCategory = options.categorySeparator;
  else {
    const separator = options.categorySeparator ?? ".";
    joinCategory = (category) => category.join(separator);
  }
  let getProperties;
  if (propertiesOption === "flatten") getProperties = (properties) => properties;
  else if (propertiesOption.startsWith("prepend:")) {
    const prefix = propertiesOption.substring(8);
    if (prefix === "") throw new TypeError(`Invalid properties option: ${JSON.stringify(propertiesOption)}. It must be of the form "prepend:<prefix>" where <prefix> is a non-empty string.`);
    getProperties = (properties) => {
      const result = {};
      for (const key in properties) result[`${prefix}${key}`] = properties[key];
      return result;
    };
  } else if (propertiesOption.startsWith("nest:")) {
    const key = propertiesOption.substring(5);
    getProperties = (properties) => ({ [key]: properties });
  } else throw new TypeError(`Invalid properties option: ${JSON.stringify(propertiesOption)}. It must be "flatten", "prepend:<prefix>", or "nest:<key>".`);
  let getMessage;
  if (isTemplateMessage) getMessage = (record) => {
    if (typeof record.rawMessage === "string") return record.rawMessage;
    let msg = "";
    for (let i = 0; i < record.rawMessage.length; i++) msg += i % 2 < 1 ? record.rawMessage[i] : "{}";
    return msg;
  };
  else getMessage = (record) => {
    const msgLen = record.message.length;
    if (msgLen === 1) return record.message[0];
    let msg = "";
    for (let i = 0; i < msgLen; i++) msg += i % 2 < 1 ? record.message[i] : JSON.stringify(record.message[i]);
    return msg;
  };
  return (record) => {
    return JSON.stringify({
      "@timestamp": new Date(record.timestamp).toISOString(),
      level: record.level === "warning" ? "WARN" : record.level.toUpperCase(),
      message: getMessage(record),
      logger: joinCategory(record.category),
      ...getProperties(record.properties)
    }, jsonReplacer) + lineEnding;
  };
}
var jsonLinesFormatter = getJsonLinesFormatter();
var logLevelStyles = {
  "trace": "background-color: gray; color: white;",
  "debug": "background-color: gray; color: white;",
  "info": "background-color: white; color: black;",
  "warning": "background-color: orange; color: black;",
  "error": "background-color: red; color: white;",
  "fatal": "background-color: maroon; color: white;"
};
function defaultConsoleFormatter(record) {
  let msg = "";
  const values = [];
  for (let i = 0; i < record.message.length; i++) if (i % 2 === 0) msg += record.message[i];
  else {
    msg += "%o";
    values.push(record.message[i]);
  }
  const date = new Date(record.timestamp);
  const time = `${date.getUTCHours().toString().padStart(2, "0")}:${date.getUTCMinutes().toString().padStart(2, "0")}:${date.getUTCSeconds().toString().padStart(2, "0")}.${date.getUTCMilliseconds().toString().padStart(3, "0")}`;
  return [
    `%c${time} %c${levelAbbreviations[record.level]}%c %c${record.category.join("\xB7")} %c${msg}`,
    "color: gray;",
    logLevelStyles[record.level],
    "background-color: default;",
    "color: gray;",
    "color: default;",
    ...values
  ];
}

// ../../node_modules/.pnpm/@logtape+logtape@2.0.2/node_modules/@logtape/logtape/dist/sink.js
function getConsoleSink(options = {}) {
  const formatter = options.formatter ?? defaultConsoleFormatter;
  const levelMap = {
    trace: "debug",
    debug: "debug",
    info: "info",
    warning: "warn",
    error: "error",
    fatal: "error",
    ...options.levelMap ?? {}
  };
  const console = options.console ?? globalThis.console;
  const baseSink = (record) => {
    const args = formatter(record);
    const method = levelMap[record.level];
    if (method === void 0) throw new TypeError(`Invalid log level: ${record.level}.`);
    if (typeof args === "string") {
      const msg = args.replace(/\r?\n$/, "");
      console[method](msg);
    } else console[method](...args);
  };
  if (!options.nonBlocking) return baseSink;
  const nonBlockingConfig = options.nonBlocking === true ? {} : options.nonBlocking;
  const bufferSize = nonBlockingConfig.bufferSize ?? 100;
  const flushInterval = nonBlockingConfig.flushInterval ?? 100;
  const buffer = [];
  let flushTimer = null;
  let disposed = false;
  let flushScheduled = false;
  const maxBufferSize = bufferSize * 2;
  function flush() {
    if (buffer.length === 0) return;
    const records = buffer.splice(0);
    for (const record of records) try {
      baseSink(record);
    } catch {
    }
  }
  function scheduleFlush() {
    if (flushScheduled) return;
    flushScheduled = true;
    setTimeout(() => {
      flushScheduled = false;
      flush();
    }, 0);
  }
  function startFlushTimer() {
    if (flushTimer !== null || disposed) return;
    flushTimer = setInterval(() => {
      flush();
    }, flushInterval);
  }
  const nonBlockingSink = (record) => {
    if (disposed) return;
    if (buffer.length >= maxBufferSize) buffer.shift();
    buffer.push(record);
    if (buffer.length >= bufferSize) scheduleFlush();
    else if (flushTimer === null) startFlushTimer();
  };
  nonBlockingSink[Symbol.dispose] = () => {
    disposed = true;
    if (flushTimer !== null) {
      clearInterval(flushTimer);
      flushTimer = null;
    }
    flush();
  };
  return nonBlockingSink;
}

// ../../node_modules/.pnpm/@logtape+logtape@2.0.2/node_modules/@logtape/logtape/dist/config.js
var currentConfig = null;
var strongRefs = /* @__PURE__ */ new Set();
var disposables = /* @__PURE__ */ new Set();
var asyncDisposables = /* @__PURE__ */ new Set();
function isLoggerConfigMeta(cfg) {
  return cfg.category.length === 0 || cfg.category.length === 1 && cfg.category[0] === "logtape" || cfg.category.length === 2 && cfg.category[0] === "logtape" && cfg.category[1] === "meta";
}
async function configure(config) {
  if (currentConfig != null && !config.reset) throw new ConfigError("Already configured; if you want to reset, turn on the reset flag.");
  await reset();
  try {
    configureInternal(config, true);
  } catch (e) {
    if (e instanceof ConfigError) await reset();
    throw e;
  }
}
function configureInternal(config, allowAsync) {
  currentConfig = config;
  let metaConfigured = false;
  const configuredCategories = /* @__PURE__ */ new Set();
  for (const cfg of config.loggers) {
    if (isLoggerConfigMeta(cfg)) metaConfigured = true;
    const categoryKey = Array.isArray(cfg.category) ? JSON.stringify(cfg.category) : JSON.stringify([cfg.category]);
    if (configuredCategories.has(categoryKey)) throw new ConfigError(`Duplicate logger configuration for category: ${categoryKey}. Each category can only be configured once.`);
    configuredCategories.add(categoryKey);
    const logger = LoggerImpl.getLogger(cfg.category);
    for (const sinkId of cfg.sinks ?? []) {
      const sink = config.sinks[sinkId];
      if (!sink) throw new ConfigError(`Sink not found: ${sinkId}.`);
      logger.sinks.push(sink);
    }
    logger.parentSinks = cfg.parentSinks ?? "inherit";
    if (cfg.lowestLevel !== void 0) logger.lowestLevel = cfg.lowestLevel;
    for (const filterId of cfg.filters ?? []) {
      const filter = config.filters?.[filterId];
      if (filter === void 0) throw new ConfigError(`Filter not found: ${filterId}.`);
      logger.filters.push(toFilter(filter));
    }
    strongRefs.add(logger);
  }
  LoggerImpl.getLogger().contextLocalStorage = config.contextLocalStorage;
  for (const sink of Object.values(config.sinks)) {
    if (Symbol.asyncDispose in sink) if (allowAsync) asyncDisposables.add(sink);
    else throw new ConfigError("Async disposables cannot be used with configureSync().");
    if (Symbol.dispose in sink) disposables.add(sink);
  }
  for (const filter of Object.values(config.filters ?? {})) {
    if (filter == null || typeof filter === "string") continue;
    if (Symbol.asyncDispose in filter) if (allowAsync) asyncDisposables.add(filter);
    else throw new ConfigError("Async disposables cannot be used with configureSync().");
    if (Symbol.dispose in filter) disposables.add(filter);
  }
  if (typeof globalThis.EdgeRuntime !== "string" && "process" in globalThis && !("Deno" in globalThis)) {
    const proc = globalThis.process;
    const onMethod = proc?.["on"];
    if (typeof onMethod === "function") onMethod.call(proc, "exit", allowAsync ? dispose : disposeSync);
  } else if ("Deno" in globalThis) addEventListener("unload", allowAsync ? dispose : disposeSync);
  else addEventListener("pagehide", allowAsync ? dispose : disposeSync);
  const meta = LoggerImpl.getLogger(["logtape", "meta"]);
  if (!metaConfigured) meta.sinks.push(getConsoleSink());
  meta.info("LogTape loggers are configured.  Note that LogTape itself uses the meta logger, which has category {metaLoggerCategory}.  The meta logger purposes to log internal errors such as sink exceptions.  If you are seeing this message, the meta logger is automatically configured.  It's recommended to configure the meta logger with a separate sink so that you can easily notice if logging itself fails or is misconfigured.  To turn off this message, configure the meta logger with higher log levels than {dismissLevel}.  See also <https://logtape.org/manual/categories#meta-logger>.", {
    metaLoggerCategory: ["logtape", "meta"],
    dismissLevel: "info"
  });
}
async function reset() {
  await dispose();
  resetInternal();
}
function resetInternal() {
  const rootLogger = LoggerImpl.getLogger([]);
  rootLogger.resetDescendants();
  delete rootLogger.contextLocalStorage;
  strongRefs.clear();
  currentConfig = null;
}
async function dispose() {
  disposeSync();
  const promises = [];
  for (const disposable of asyncDisposables) {
    promises.push(disposable[Symbol.asyncDispose]());
    asyncDisposables.delete(disposable);
  }
  await Promise.all(promises);
}
function disposeSync() {
  for (const disposable of disposables) disposable[Symbol.dispose]();
  disposables.clear();
}
var ConfigError = class extends Error {
  /**
  * Constructs a new configuration error.
  * @param message The error message.
  */
  constructor(message) {
    super(message);
    this.name = "ConfigureError";
  }
};

// scripts/download-assets.ts
var ASSETS = [
  "manifest.json",
  "worker.js",
  "rotation-worker.js",
  "migrations.zip",
  "tf.zip"
];
var VERIFY_ASSETS = [
  "worker.js",
  "rotation-worker.js",
  "migrations.zip",
  "tf.zip"
];
var EXTRACT = [
  ["migrations.zip", "migrations"],
  ["tf.zip", "tf"]
];
async function downloadAssets(env) {
  const logger = getLogger(["bao", "action", "download-assets"]);
  const missing = ["BAO_API_KEY", "BAO_API_URL", "VERSION", "ASSETS_DIR"].filter((k) => !env[k]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`
    );
  }
  const {
    BAO_API_KEY: apiKey,
    BAO_API_URL: apiUrl,
    VERSION: version,
    ASSETS_DIR: assetsDir
  } = env;
  await (0, import_promises.mkdir)(assetsDir, { recursive: true });
  for (const asset of ASSETS) {
    logger.info("Downloading {asset}...", { asset });
    const apiRes = await fetch(`${apiUrl}/v1/releases/${version}/${asset}`, {
      headers: { Authorization: `Bearer ${apiKey}` }
    });
    if (!apiRes.ok) {
      throw new Error(
        `API request failed for ${asset}: ${apiRes.status} ${await apiRes.text()}`
      );
    }
    const { url: presignedUrl } = await apiRes.json();
    const downloadRes = await fetch(presignedUrl);
    if (!downloadRes.ok) {
      throw new Error(`Download failed for ${asset}: ${downloadRes.status}`);
    }
    await (0, import_promises.writeFile)(
      (0, import_node_path.join)(assetsDir, asset),
      Buffer.from(await downloadRes.arrayBuffer())
    );
  }
  logger.info("Verifying asset integrity...");
  const manifestRaw = await (0, import_promises.readFile)((0, import_node_path.join)(assetsDir, "manifest.json"), "utf-8");
  const manifest = JSON.parse(manifestRaw);
  for (const asset of VERIFY_ASSETS) {
    const content = await (0, import_promises.readFile)((0, import_node_path.join)(assetsDir, asset));
    const actual = (0, import_node_crypto.createHash)("sha256").update(content).digest("hex");
    const expected = manifest.assets[asset]?.sha256;
    if (actual !== expected) {
      throw new Error(
        `Hash mismatch for ${asset}: expected ${expected}, got ${actual}`
      );
    }
    logger.info("  {asset} \u2713", { asset });
  }
  for (const [archive, subdir] of EXTRACT) {
    logger.info("Extracting {archive}...", { archive });
    const result = (0, import_node_child_process.spawnSync)("unzip", [
      "-oq",
      (0, import_node_path.join)(assetsDir, archive),
      "-d",
      (0, import_node_path.join)(assetsDir, subdir)
    ]);
    if (result.status !== 0) {
      throw new Error(
        `Failed to extract ${archive}: ${result.stderr?.toString() ?? "unknown error"}`
      );
    }
  }
  logger.info("Assets extracted.");
}
if (process.argv[1] === __filename) {
  void (async () => {
    await configure({
      sinks: {
        stdout: (record) => {
          const msg = record.message.map((v) => typeof v === "string" ? v : String(v)).join("");
          process.stdout.write(`${msg}
`);
        }
      },
      loggers: [{ category: ["bao"], sinks: ["stdout"], lowestLevel: "info" }]
    });
    const logger = getLogger(["bao", "action", "download-assets"]);
    try {
      await downloadAssets(process.env);
    } catch (err) {
      logger.fatal("::error::{message}", { message: err.message });
      process.exit(1);
    }
  })();
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  downloadAssets
});
