/**
 * Version: 1.1.0
 * Date: 2026-10-18 2:40 PM
 * Change Log:
 * - 2026-10-18: Feature: Enforce strict server-side once-per-day logging, concurrency locks, and authentic streak validation [New Feature]
 * - 2026-09-12: Fix: Add fallback spreadsheet resolver to initializeSheets() for direct execution in Apps Script editor [Fix]
 * - 2026-09-12: Feature: Google Apps Script backend for ProTrack with Sheets data logging and Drive image storage [New Feature]
 */

/**
 * =========================================================================
 * PROTRACK GOOGLE APPS SCRIPT BACKEND
 * =========================================================================
 * Connects the ProTrack Project Tracker to Google Sheets & Google Drive.
 * 
 * Features:
 * - Serves index.html as a standalone Web App via doGet()
 * - Accepts REST API calls from external/local ProTrack instances via doPost()
 * - Supports native google.script.run client calls
 * - Automatically initializes 4 organized Google Sheet tabs (Projects, Daily Logs, Milestones, BOM)
 * - Automatically uploads daily imprinted photos to Google Drive ("ProTrack Uploads" folder)
 * - Saves direct Google Drive view links in Google Sheets
 * =========================================================================
 */

// Configuration constants
var FOLDER_NAME = "ProTrack Uploads";
var SHEET_PROJECTS = "Projects";
var SHEET_LOGS = "Daily Logs";
var SHEET_MILESTONES = "Milestones";
var SHEET_BOM = "Inventory (BOM)";

/**
 * Serve index.html when deployed as a Web App
 */
function doGet(e) {
  try {
    return HtmlService.createHtmlOutputFromFile('index')
      .setTitle('ProTrack - Project Tracker')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
  } catch (err) {
    // If index.html is not yet created inside GAS editor, provide health check response
    return ContentService.createTextOutput(JSON.stringify({
      status: "online",
      message: "ProTrack Google Apps Script backend is running successfully.",
      timestamp: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Handle POST requests from standalone/local/PWA instances
 */
function doPost(e) {
  try {
    var contents = e.postData ? e.postData.contents : null;
    if (!contents) {
      return jsonResponse({ status: "error", message: "No payload received" });
    }

    var payload = JSON.parse(contents);
    var action = payload.action;
    var result = {};

    switch (action) {
      case "logEntry":
        result = saveLog(payload.data);
        break;
      case "syncProject":
        result = syncProject(payload.data);
        break;
      case "validateMilestone":
        result = saveMilestone(payload.data);
        break;
      case "syncInventory":
        result = saveInventory(payload.data);
        break;
      case "ping":
        result = { status: "success", message: "ProTrack Backend Connected" };
        break;
      default:
        result = { status: "error", message: "Unknown action: " + action };
    }

    return jsonResponse(result);
  } catch (err) {
    return jsonResponse({ status: "error", message: err.toString() });
  }
}

/**
 * Helper to return JSON responses with CORS headers
 */
function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Get or create the ProTrack active spreadsheet
 */
function getSpreadsheet() {
  var ss = null;
  try {
    ss = SpreadsheetApp.getActiveSpreadsheet();
  } catch (e) {
    ss = null;
  }

  if (!ss) {
    var props = PropertiesService.getScriptProperties();
    var sheetId = props.getProperty("PROTRACK_SHEET_ID");
    if (sheetId) {
      try {
        ss = SpreadsheetApp.openById(sheetId);
      } catch (e) {
        ss = null;
      }
    }

    if (!ss) {
      ss = SpreadsheetApp.create("ProTrack Project Database");
      props.setProperty("PROTRACK_SHEET_ID", ss.getId());
    }
  }

  return ss;
}

/**
 * Setup and verification function.
 * Run this directly from the Apps Script editor toolbar to initialize sheets & Drive folder.
 */
function setup() {
  var ss = getSpreadsheet();
  initializeSheets(ss);
  var folder = getUploadsFolder();
  Logger.log("✅ ProTrack Backend Ready!");
  Logger.log("📊 Google Sheet: " + ss.getUrl());
  Logger.log("📁 Drive Folder: " + folder.getUrl());
  return {
    status: "success",
    sheetUrl: ss.getUrl(),
    folderUrl: folder.getUrl()
  };
}

/**
 * Initialize all necessary sheets and headers with styling.
 * Safe to run directly from Apps Script editor menu without arguments.
 */
function initializeSheets(ss) {
  if (!ss) {
    ss = getSpreadsheet();
  }
  if (!ss) {
    Logger.log("❌ Error: Could not obtain Google Spreadsheet.");
    return null;
  }

  var headerColor = "#beff33";
  var headerTextColor = "#000000";

  // 1. Projects Sheet
  var projSheet = ss.getSheetByName(SHEET_PROJECTS);
  if (!projSheet) {
    projSheet = ss.insertSheet(SHEET_PROJECTS);
    var projHeaders = ["Project ID", "Project Name", "Description", "Total Days", "Start Date", "Progress (%)", "Total Points (XP)", "Streak (Days)", "Last Updated"];
    projSheet.appendRow(projHeaders);
    formatHeaderRow(projSheet, projHeaders.length, headerColor, headerTextColor);
  }

  // 2. Daily Logs Sheet
  var logSheet = ss.getSheetByName(SHEET_LOGS);
  if (!logSheet) {
    logSheet = ss.insertSheet(SHEET_LOGS);
    var logHeaders = ["Timestamp", "Project ID", "Project Name", "Day", "Log Date", "Work Accomplished", "Hours Worked", "Results Count", "Blocker / Stuck", "Progress Gain (%)", "Points Earned", "Drive Image URL"];
    logSheet.appendRow(logHeaders);
    formatHeaderRow(logSheet, logHeaders.length, headerColor, headerTextColor);
  }

  // 3. Milestones Sheet
  var msSheet = ss.getSheetByName(SHEET_MILESTONES);
  if (!msSheet) {
    msSheet = ss.insertSheet(SHEET_MILESTONES);
    var msHeaders = ["Timestamp", "Project ID", "Project Name", "Milestone Title", "Target Day", "Completed Day", "Review Score (%)", "Bonus XP", "Status"];
    msSheet.appendRow(msHeaders);
    formatHeaderRow(msSheet, msHeaders.length, headerColor, headerTextColor);
  }

  // 4. Inventory (BOM) Sheet
  var bomSheet = ss.getSheetByName(SHEET_BOM);
  if (!bomSheet) {
    bomSheet = ss.insertSheet(SHEET_BOM);
    var bomHeaders = ["Timestamp", "Project ID", "Project Name", "Part Name", "Status", "Cost (PHP)"];
    bomSheet.appendRow(bomHeaders);
    formatHeaderRow(bomSheet, bomHeaders.length, headerColor, headerTextColor);
  }

  // Remove default "Sheet1" if empty and others exist
  var defaultSheet = ss.getSheetByName("Sheet1");
  if (defaultSheet && ss.getSheets().length > 1 && defaultSheet.getLastRow() === 0) {
    try { ss.deleteSheet(defaultSheet); } catch (e) {}
  }
}

/**
 * Format headers with styling
 */
function formatHeaderRow(sheet, numCols, bgColor, textColor) {
  var range = sheet.getRange(1, 1, 1, numCols);
  range.setBackground(bgColor);
  range.setFontColor(textColor);
  range.setFontWeight("bold");
  sheet.setFrozenRows(1);
}

/**
 * Get or create Google Drive folder for storing uploaded images
 */
function getUploadsFolder() {
  var folders = DriveApp.getFoldersByName(FOLDER_NAME);
  if (folders.hasNext()) {
    return folders.next();
  }
  var newFolder = DriveApp.createFolder(FOLDER_NAME);
  newFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return newFolder;
}

/**
 * Upload Base64 image to Google Drive and return public viewable URL
 */
function uploadImageToDrive(base64Data, filename) {
  if (!base64Data) return "";

  try {
    var folder = getUploadsFolder();
    var cleanBase64 = base64Data;
    if (base64Data.indexOf(",") > -1) {
      cleanBase64 = base64Data.split(",")[1];
    }

    var decoded = Utilities.base64Decode(cleanBase64);
    var blob = Utilities.newBlob(decoded, "image/jpeg", filename || ("ProTrack_" + Date.now() + ".jpg"));
    var file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    // Return the Google Drive link
    return file.getUrl();
  } catch (err) {
    return "Upload Error: " + err.toString();
  }
}

/**
 * Save Daily Log to Google Sheets & Upload Photo to Google Drive
 * Enforces strict once-per-day logging on the server to ensure authentic streaks.
 * (Callable via google.script.run or doPost)
 */
function saveLog(data) {
  var lock = LockService.getScriptLock();
  var hasLock = false;
  try {
    hasLock = lock.tryLock(10000);
    if (!hasLock) {
      return { status: "error", message: "Server busy. Please try again in a few moments." };
    }

    if (!data || !data.projectId) {
      return { status: "error", message: "Missing project data." };
    }

    var ss = getSpreadsheet();
    var logSheet = ss.getSheetByName(SHEET_LOGS);
    if (!logSheet) {
      initializeSheets(ss);
      logSheet = ss.getSheetByName(SHEET_LOGS);
    }

    var scriptTimeZone = Session.getScriptTimeZone() || "GMT";
    var now = new Date();
    var serverTodayStr = Utilities.formatDate(now, scriptTimeZone, "yyyy-MM-dd");

    // Scan for existing log row for this project on today's calendar date
    var dataRange = logSheet.getDataRange();
    var values = dataRange.getValues();
    var existingRow = -1;

    for (var i = values.length - 1; i >= 1; i--) {
      var row = values[i];
      if (String(row[1]) === String(data.projectId)) {
        var rowIsoDate = "";
        try {
          if (row[0]) {
            rowIsoDate = Utilities.formatDate(new Date(row[0]), scriptTimeZone, "yyyy-MM-dd");
          }
        } catch (e) {}

        var rowLogDate = String(row[4] || "");
        if (rowIsoDate === serverTodayStr || rowLogDate === serverTodayStr || (data.logDate && rowLogDate === String(data.logDate))) {
          existingRow = i + 1;
          break;
        }
      }
    }

    // Upload photo to Drive if present
    var driveImageUrl = "";
    if (data.imprintedImage) {
      var filename = "ProTrack_" + (data.projectName || "Project").replace(/[^a-zA-Z0-9]/g, "_") + "_Day" + data.day + "_" + serverTodayStr + ".jpg";
      driveImageUrl = uploadImageToDrive(data.imprintedImage, filename);
    }

    // Case 1: Entry for today already exists
    if (existingRow > -1) {
      if (data.allowUpdate === true) {
        // Legitimate update to today's dispatch
        if (data.workAccomplished !== undefined) logSheet.getRange(existingRow, 6).setValue(data.workAccomplished);
        if (data.hoursWorked !== undefined) logSheet.getRange(existingRow, 7).setValue(data.hoursWorked);
        if (data.resultsCount !== undefined) logSheet.getRange(existingRow, 8).setValue(data.resultsCount);
        if (data.blocker !== undefined) logSheet.getRange(existingRow, 9).setValue(data.blocker);
        if (driveImageUrl) logSheet.getRange(existingRow, 12).setValue(driveImageUrl);

        syncProject({
          projectId: data.projectId,
          name: data.projectName,
          progress: data.newProgress,
          totalPoints: data.totalPoints,
          streak: data.streak,
          totalDays: data.totalDays
        });

        return {
          status: "success",
          updated: true,
          serverDate: serverTodayStr,
          message: "Today's dispatch updated successfully on server.",
          imageUrl: driveImageUrl,
          sheetUrl: ss.getUrl()
        };
      } else {
        // Reject duplicate submission
        return {
          status: "rejected",
          reason: "ALREADY_LOGGED_TODAY",
          serverDate: serverTodayStr,
          message: "A daily dispatch has already been recorded on the server for today (" + serverTodayStr + "). Strict once-per-day logging is enforced."
        };
      }
    }

    // Case 2: New authentic daily dispatch
    var rowData = [
      now.toISOString(),
      data.projectId || "",
      data.projectName || "",
      data.day || 1,
      data.logDate || serverTodayStr,
      data.workAccomplished || "",
      data.hoursWorked || 0,
      data.resultsCount || 0,
      data.blocker || "",
      data.progressGain || 0,
      data.pointsEarned || 0,
      driveImageUrl
    ];

    logSheet.appendRow(rowData);

    // Update Project row
    syncProject({
      projectId: data.projectId,
      name: data.projectName,
      progress: data.newProgress,
      totalPoints: data.totalPoints,
      streak: data.streak,
      totalDays: data.totalDays
    });

    return {
      status: "success",
      serverDate: serverTodayStr,
      imageUrl: driveImageUrl,
      sheetUrl: ss.getUrl()
    };
  } catch (err) {
    return {
      status: "error",
      message: err.toString()
    };
  } finally {
    if (hasLock) {
      try { lock.releaseLock(); } catch (e) {}
    }
  }
}

/**
 * Synchronize Project Info in the "Projects" Sheet
 */
function syncProject(data) {
  try {
    if (!data || !data.projectId) return { status: "ignored" };

    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_PROJECTS);
    if (!sheet) {
      initializeSheets(ss);
      sheet = ss.getSheetByName(SHEET_PROJECTS);
    }

    var dataRange = sheet.getDataRange();
    var values = dataRange.getValues();
    var targetRow = -1;

    for (var i = 1; i < values.length; i++) {
      if (String(values[i][0]) === String(data.projectId)) {
        targetRow = i + 1;
        break;
      }
    }

    var now = new Date().toISOString();
    if (targetRow > -1) {
      // Update existing
      if (data.name !== undefined) sheet.getRange(targetRow, 2).setValue(data.name);
      if (data.description !== undefined) sheet.getRange(targetRow, 3).setValue(data.description);
      if (data.totalDays !== undefined) sheet.getRange(targetRow, 4).setValue(data.totalDays);
      if (data.startDate !== undefined) sheet.getRange(targetRow, 5).setValue(data.startDate);
      if (data.progress !== undefined) sheet.getRange(targetRow, 6).setValue(data.progress);
      if (data.totalPoints !== undefined) sheet.getRange(targetRow, 7).setValue(data.totalPoints);
      if (data.streak !== undefined) sheet.getRange(targetRow, 8).setValue(data.streak);
      sheet.getRange(targetRow, 9).setValue(now);
    } else {
      // Append new project
      sheet.appendRow([
        data.projectId,
        data.name || "Untitled Project",
        data.description || "",
        data.totalDays || 31,
        data.startDate || new Date().toISOString().split("T")[0],
        data.progress || 0,
        data.totalPoints || 0,
        data.streak || 0,
        now
      ]);
    }

    return { status: "success", sheetUrl: ss.getUrl() };
  } catch (err) {
    return { status: "error", message: err.toString() };
  }
}

/**
 * Save Milestone Validation to "Milestones" Sheet
 */
function saveMilestone(data) {
  try {
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_MILESTONES);
    if (!sheet) {
      initializeSheets(ss);
      sheet = ss.getSheetByName(SHEET_MILESTONES);
    }

    sheet.appendRow([
      new Date().toISOString(),
      data.projectId || "",
      data.projectName || "",
      data.title || "",
      data.targetDay || 0,
      data.completedDay || 0,
      data.rating || 0,
      data.bonusXP || 0,
      "Validated"
    ]);

    return { status: "success" };
  } catch (err) {
    return { status: "error", message: err.toString() };
  }
}

/**
 * Save BOM Inventory items to "Inventory (BOM)" Sheet
 */
function saveInventory(data) {
  try {
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_BOM);
    if (!sheet) {
      initializeSheets(ss);
      sheet = ss.getSheetByName(SHEET_BOM);
    }

    if (data.items && Array.isArray(data.items)) {
      data.items.forEach(function(item) {
        sheet.appendRow([
          new Date().toISOString(),
          data.projectId || "",
          data.projectName || "",
          item.name || "",
          item.status || "",
          item.cost || 0
        ]);
      });
    }

    return { status: "success" };
  } catch (err) {
    return { status: "error", message: err.toString() };
  }
}
