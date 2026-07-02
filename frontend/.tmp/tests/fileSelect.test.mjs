// src/__tests__/fileSelect.test.mjs
import assert from "node:assert/strict";

// src/fileSelect.ts
var preferredLogFilePrefixes = [
  "admin",
  "chat",
  "economy",
  "event_kill",
  "famepoints",
  "gameplay",
  "kill",
  "login",
  "violations",
  "vehicle_destruction"
];
var defaultLogFileDescription = "\u65E5\u5FD7\u6587\u4EF6\uFF0C\u7528\u4E8E\u67E5\u770B\u670D\u52A1\u5668\u8FD0\u884C\u3001\u804A\u5929\u3001\u7ECF\u6D4E\u548C\u4E8B\u4EF6\u8BB0\u5F55\u3002";
var defaultConfigFileDescriptions = {
  "AdminUsers.ini": "\u7BA1\u7406\u5458\u767D\u540D\u5355\uFF0C\u63A7\u5236\u54EA\u4E9B\u73A9\u5BB6\u62E5\u6709\u670D\u52A1\u7AEF\u7BA1\u7406\u6743\u9650\u3002",
  "BannedUsers.ini": "\u5C01\u7981\u540D\u5355\uFF0C\u8BB0\u5F55\u88AB\u7981\u6B62\u8FDB\u5165\u670D\u52A1\u5668\u7684\u73A9\u5BB6\u3002",
  "EconomyOverride.json": "\u7ECF\u6D4E\u7CFB\u7EDF\u8986\u76D6\u914D\u7F6E\uFF0C\u7528\u4E8E\u8C03\u6574\u5546\u5E97\u3001\u4EF7\u683C\u548C\u7ECF\u6D4E\u4EA7\u51FA\u89C4\u5219\u3002",
  "ExclusiveUsers.ini": "\u4E13\u5C5E\u8BBF\u95EE\u540D\u5355\uFF0C\u7528\u4E8E\u9650\u5236\u53EA\u6709\u6307\u5B9A\u7528\u6237\u53EF\u4EE5\u8FDB\u5165\u670D\u52A1\u5668\u3002",
  "GameUserSettings.ini": "\u6E38\u620F\u5BA2\u6237\u7AEF/\u670D\u52A1\u7AEF\u901A\u7528\u8BBE\u7F6E\u8986\u76D6\u6587\u4EF6\uFF0C\u901A\u5E38\u7528\u4E8E\u8865\u5145\u57FA\u7840\u56FE\u5F62\u6216\u8F93\u5165\u7C7B\u914D\u7F6E\u3002",
  "Input.ini": "\u8F93\u5165\u6620\u5C04\u914D\u7F6E\u6587\u4EF6\uFF0C\u7528\u4E8E\u81EA\u5B9A\u4E49\u6309\u952E\u6216\u63A7\u5236\u7ED1\u5B9A\u3002",
  "Input.ini.bak": "\u8F93\u5165\u6620\u5C04\u5907\u4EFD\u6587\u4EF6\uFF0C\u7528\u4E8E\u56DE\u6EDA\u4E4B\u524D\u7684\u8F93\u5165\u914D\u7F6E\u3002",
  "Notifications.json": "\u901A\u77E5\u6D88\u606F\u914D\u7F6E\uFF0C\u7528\u4E8E\u63A7\u5236\u516C\u544A\u3001\u63D0\u793A\u548C\u63A8\u9001\u7C7B\u5185\u5BB9\u3002",
  "RaidTimes.json": "\u653B\u9632\u65F6\u95F4\u914D\u7F6E\uFF0C\u7528\u4E8E\u9650\u5236\u6216\u5B89\u6392\u53EF\u653B\u51FB\u65F6\u6BB5\u3002",
  "ServerSettings.ini": "\u670D\u52A1\u5668\u6838\u5FC3\u914D\u7F6E\u6587\u4EF6\uFF0C\u5305\u542B\u4EBA\u6570\u3001\u89C6\u89D2\u3001\u804A\u5929\u3001\u50F5\u5C38\u548C\u73A9\u6CD5\u7B49\u4E3B\u8981\u8BBE\u7F6E\u3002",
  "ServerSettingsAdminUsers.ini": "\u670D\u52A1\u5668\u7BA1\u7406\u5458\u914D\u7F6E\u8865\u5145\u6587\u4EF6\uFF0C\u7528\u4E8E\u7EF4\u62A4\u7BA1\u7406\u5458\u76F8\u5173\u8BBE\u7F6E\u3002",
  "SilencedUsers.ini": "\u7981\u8A00\u540D\u5355\uFF0C\u8BB0\u5F55\u88AB\u9650\u5236\u804A\u5929\u7684\u73A9\u5BB6\u3002",
  "WhitelistedUsers.ini": "\u767D\u540D\u5355\u914D\u7F6E\uFF0C\u63A7\u5236\u5141\u8BB8\u8FDB\u5165\u670D\u52A1\u5668\u7684\u73A9\u5BB6\u5217\u8868\u3002"
};
var normalizeRelativePath = (path) => String(path || "").replace(/\\+/g, "/").replace(/^\/+/, "").replace(/\/+/g, "/").trim();
var fileNameFromPath = (path) => {
  const normalizedPath = normalizeRelativePath(path);
  if (!normalizedPath) {
    return "";
  }
  const segments = normalizedPath.split("/");
  return segments[segments.length - 1] || "";
};
var modifiedAtValue = (value) => {
  const timestamp = value ? Date.parse(value) : NaN;
  return Number.isFinite(timestamp) ? timestamp : 0;
};
var buildFileOptionLabel = (entry, fileDescriptions, isLogWorkspace) => {
  const fileName = entry.name || fileNameFromPath(entry.relativePath);
  if (isLogWorkspace) {
    return fileName;
  }
  const description = resolveFileDescription(entry, fileDescriptions, isLogWorkspace);
  return description ? `${fileName} - ${description}` : fileName;
};
var buildFileSelectOptions = (entries, fileDescriptions, isLogWorkspace) => entries.map((entry) => ({
  label: buildFileOptionLabel(entry, fileDescriptions, isLogWorkspace),
  value: entry.relativePath
}));
var filterFileEntriesByQuery = (entries, query, fileDescriptions, isLogWorkspace) => {
  const normalizedQuery = String(query || "").trim().toLowerCase();
  if (!normalizedQuery) {
    return entries;
  }
  return entries.filter((entry) => {
    const fileName = (entry.name || fileNameFromPath(entry.relativePath)).toLowerCase();
    if (fileName.includes(normalizedQuery)) {
      return true;
    }
    return buildFileOptionLabel(entry, fileDescriptions, isLogWorkspace).toLowerCase().includes(normalizedQuery);
  });
};
var prioritizeFiles = (entries, preferredFiles, preferNewest = false) => {
  if (preferNewest) {
    return [...entries].sort(compareLogEntries);
  }
  if (preferredFiles.length === 0) {
    return [...entries].sort((left, right) => left.name.localeCompare(right.name));
  }
  const priority = /* @__PURE__ */ new Map();
  preferredFiles.forEach((name, index) => {
    priority.set(normalizeRelativePath(name).toLowerCase(), index);
    priority.set(fileNameFromPath(name).toLowerCase(), index);
  });
  return [...entries].sort((left, right) => {
    const leftPriority = resolvePreferredFilePriority(left, priority, preferredFiles.length);
    const rightPriority = resolvePreferredFilePriority(right, priority, preferredFiles.length);
    if (leftPriority === rightPriority) {
      return left.name.localeCompare(right.name);
    }
    return leftPriority - rightPriority;
  });
};
var compareEntriesByModifiedAtDesc = (left, right) => {
  const leftTime = modifiedAtValue(left.modifiedAt);
  const rightTime = modifiedAtValue(right.modifiedAt);
  if (leftTime !== rightTime) {
    return rightTime - leftTime;
  }
  return left.name.localeCompare(right.name);
};
var resolvePreferredFilePriority = (entry, priority, fallbackPriority) => {
  const normalizedPath = normalizeRelativePath(entry.relativePath).toLowerCase();
  const normalizedName = entry.name.toLowerCase();
  const directPriority = priority.get(normalizedPath) ?? priority.get(normalizedName);
  if (typeof directPriority === "number") {
    return directPriority;
  }
  for (const [candidate, value] of priority.entries()) {
    const candidateName = fileNameFromPath(candidate);
    const preferredStem = candidateName.replace(/\.[^.]+$/, "");
    if (preferredStem && (normalizedName === preferredStem || normalizedName.startsWith(`${preferredStem}_`) || normalizedName.startsWith(`${preferredStem}.`))) {
      return value;
    }
  }
  return fallbackPriority + 1;
};
var resolveFileDescription = (entry, fileDescriptions, isLogWorkspace) => {
  const normalizedPath = normalizeRelativePath(entry.relativePath);
  const fileName = entry.name || fileNameFromPath(normalizedPath);
  return fileDescriptions[normalizedPath] || fileDescriptions[fileName] || defaultConfigFileDescriptions[fileName] || (isLogWorkspace ? defaultLogFileDescription : "");
};
var compareLogEntries = (left, right) => {
  const leftPriority = resolveLogPrefixPriority(left.name || fileNameFromPath(left.relativePath));
  const rightPriority = resolveLogPrefixPriority(right.name || fileNameFromPath(right.relativePath));
  if (leftPriority !== rightPriority) {
    return leftPriority - rightPriority;
  }
  return compareEntriesByModifiedAtDesc(left, right);
};
var resolveLogPrefixPriority = (fileName) => {
  const normalizedName = String(fileName || "").trim().toLowerCase();
  const matchedIndex = preferredLogFilePrefixes.findIndex((prefix) => matchesLogPrefix(normalizedName, prefix));
  return matchedIndex >= 0 ? matchedIndex : preferredLogFilePrefixes.length;
};
var matchesLogPrefix = (fileName, prefix) => {
  return fileName === `${prefix}.log` || fileName.startsWith(`${prefix}_`) || fileName.startsWith(`${prefix}.`) || fileName === prefix;
};

// src/__tests__/fileSelect.test.mjs
var configDescriptions = {
  "ServerSettings.ini": "\u670D\u52A1\u5668\u6838\u5FC3\u914D\u7F6E\u6587\u4EF6\uFF0C\u5305\u542B\u4EBA\u6570\u3001\u89C6\u89D2\u3001\u804A\u5929\u3001\u50F5\u5C38\u548C\u73A9\u6CD5\u7B49\u4E3B\u8981\u8BBE\u7F6E\u3002",
  "AdminUsers.ini": "\u7BA1\u7406\u5458\u767D\u540D\u5355\uFF0C\u63A7\u5236\u54EA\u4E9B\u73A9\u5BB6\u62E5\u6709\u670D\u52A1\u7AEF\u7BA1\u7406\u6743\u9650\u3002"
};
var configEntries = [
  {
    name: "AdminUsers.ini",
    relativePath: "SCUM/Saved/Config/WindowsServer/AdminUsers.ini"
  },
  {
    name: "ServerSettings.ini",
    relativePath: "SCUM/Saved/Config/WindowsServer/ServerSettings.ini"
  }
];
var sortedLogEntries = prioritizeFiles([
  {
    name: "misc.log",
    relativePath: "SCUM/Saved/SaveFiles/Logs/misc.log",
    modifiedAt: "2026-06-29T06:00:00.000Z"
  },
  {
    name: "chat_2026-06-28.log",
    relativePath: "SCUM/Saved/SaveFiles/Logs/chat_2026-06-28.log",
    modifiedAt: "2026-06-28T06:00:00.000Z"
  },
  {
    name: "gameplay_2026-06-27.log",
    relativePath: "SCUM/Saved/SaveFiles/Logs/gameplay_2026-06-27.log",
    modifiedAt: "2026-06-27T06:00:00.000Z"
  },
  {
    name: "chat_2026-06-29.log",
    relativePath: "SCUM/Saved/SaveFiles/Logs/chat_2026-06-29.log",
    modifiedAt: "2026-06-29T07:00:00.000Z"
  }
], [], true);
assert.equal(sortedLogEntries[0]?.name, "chat_2026-06-29.log", "newer chat logs should sort ahead of older same-prefix files");
assert.equal(sortedLogEntries[1]?.name, "chat_2026-06-28.log", "older chat logs should remain after newer same-prefix files");
assert.equal(sortedLogEntries[2]?.name, "gameplay_2026-06-27.log", "preferred gameplay prefix should sort ahead of non-priority logs");
assert.equal(sortedLogEntries[3]?.name, "misc.log", "non-priority logs should sort after preferred log prefixes");
assert.equal(
  buildFileOptionLabel(configEntries[1], configDescriptions, false),
  "ServerSettings.ini - \u670D\u52A1\u5668\u6838\u5FC3\u914D\u7F6E\u6587\u4EF6\uFF0C\u5305\u542B\u4EBA\u6570\u3001\u89C6\u89D2\u3001\u804A\u5929\u3001\u50F5\u5C38\u548C\u73A9\u6CD5\u7B49\u4E3B\u8981\u8BBE\u7F6E\u3002",
  "config file labels should include description text"
);
assert.equal(
  buildFileOptionLabel(configEntries[0], configDescriptions, false),
  "AdminUsers.ini - \u7BA1\u7406\u5458\u767D\u540D\u5355\uFF0C\u63A7\u5236\u54EA\u4E9B\u73A9\u5BB6\u62E5\u6709\u670D\u52A1\u7AEF\u7BA1\u7406\u6743\u9650\u3002",
  "known config file descriptions should appear in option labels"
);
var labeledOptions = buildFileSelectOptions(configEntries, configDescriptions, false);
assert.equal(labeledOptions[0]?.label.includes("\u7BA1\u7406\u5458\u767D\u540D\u5355"), true, "generated options should carry config descriptions");
var filteredByName = filterFileEntriesByQuery(configEntries, "server", configDescriptions, false);
assert.deepEqual(filteredByName.map((entry) => entry.name), ["ServerSettings.ini"], "search should match file names case-insensitively");
var filteredByDescription = filterFileEntriesByQuery(configEntries, "\u7BA1\u7406\u6743\u9650", configDescriptions, false);
assert.deepEqual(filteredByDescription.map((entry) => entry.name), ["AdminUsers.ini"], "search should also match description text");
console.log("file select checks passed");
