let dashboardRefreshTimer = null;
let currentLanguage = window.localStorage.getItem("pvcc-language") || "de";
const languageLocales = { de: "de-DE", en: "en-US" };
const viewLabelTranslations = {
  de: { home: "Start", config: "Konfiguration", login: "Logins", debug: "Diagnose" },
  en: { home: "Home", config: "Configuration", login: "Logins", debug: "Diagnostics" }
};
const viewLabels = viewLabelTranslations.de;
const HISTORY_CHART_MAX_POWER_W = 15000;
const translations = {
  en: {
    "Start": "Home",
    "Bedienen": "Control",
    "Konfiguration": "Configuration",
    "Regeln & Geräte": "Rules & devices",
    "Logins": "Logins",
    "Easee & MG": "Easee & MG",
    "Diagnose": "Diagnostics",
    "Rohdaten": "Raw data",
    "Menü": "Menu",
    "Sprache": "Language",
    "Status laden": "Load status",
    "Automatik pausieren": "Pause automation",
    "Automatik fortsetzen": "Resume automation",
    "Charger deaktivieren": "Disable charger",
    "Charger aktivieren": "Enable charger",
    "Polling neu starten": "Restart polling",
    "Polling stoppen": "Stop polling",
    "Jetzt laden": "Charge now",
    "Laden beenden": "Stop charging",
    "Manuelles Laden ist nicht aktiv.": "Manual charging is not active.",
    "Manuelles Laden beendet.": "Manual charging stopped.",
    "Ladestrom (A)": "Charging current (A)",
    "Entspricht (3-phasig)": "Equivalent (3-phase)",
    "Ziel-Fahrzeug-SOC (%)": "Target vehicle SOC (%)",
    "Live Übersicht": "Live overview",
    "Regelentscheidung": "Control decision",
    "Automatikstatus": "Automation status",
    "Letzter Eingriff": "Last action",
    "Haltezeit bis": "Hold until",
    "Letzte Auswertung": "Last evaluation",
    "Sonne & Wetter": "Sun & weather",
    "Regel-Diagnose": "Control diagnostics",
    "Growatt Grundkonfiguration": "Growatt base configuration",
    "Integrierte Growatt API": "Integrated Growatt API",
    "Logger Adapter IP": "Logger adapter IP",
    "Logger Adapter Port": "Logger adapter port",
    "Wechselrichter Unit-ID": "Inverter unit ID",
    "Growatt Poll-Intervall (s)": "Growatt poll interval (s)",
    "Einstellungen laden": "Load settings",
    "Einstellungen speichern": "Save settings",
    "Growatt testen": "Test Growatt",
    "Easee Grundkonfiguration": "Easee base configuration",
    "Easee Charger-ID": "Easee charger ID",
    "Easee Poll-Intervall (s)": "Easee poll interval (s)",
    "Safe Mode": "Safe mode",
    "Inaktiv": "Inactive",
    "Aktiv": "Active",
    "Benutzername": "Username",
    "Passwort": "Password",
    "Charger-ID speichern": "Save charger ID",
    "Easee verbinden": "Connect Easee",
    "Charger erkennen": "Detect charger",
    "Easee Status laden": "Load Easee status",
    "Noch keine aktive Limit-Warnung.": "No active limit warning yet.",
    "Automatische Ladung": "Automatic charging",
    "Automatik aktiv": "Automation active",
    "Lademodus": "Charging mode",
    "PV-optimiert": "PV optimized",
    "Manueller Override": "Manual override",
    "Phasenstrategie": "Phase strategy",
    "Auto": "Auto",
    "1 Phase bevorzugen": "Prefer 1 phase",
    "3 Phasen bevorzugen": "Prefer 3 phases",
    "Minimaler Batterie-SOC (%)": "Minimum battery SOC (%)",
    "Max. Batterie-Entladung (W)": "Max. battery discharge (W)",
    "Max. Netzbezug (W)": "Max. grid import (W)",
    "Max. Ladeleistung (W)": "Max. charging power (W)",
    "Minimaler Ladestrom (A)": "Minimum current (A)",
    "Maximaler Ladestrom (A)": "Maximum current (A)",
    "Hochregeln pro Schritt (A)": "Increase per step (A)",
    "Runterregeln pro Schritt (A)": "Decrease per step (A)",
    "Regelintervall (s)": "Control interval (s)",
    "Haltezeit nach Anpassung (s)": "Hold time after adjustment (s)",
    "Manueller Override aktiv": "Manual override active",
    "Override-Ladestrom (A)": "Override current (A)",
    "Automatik speichern": "Save automation",
    "Regelung jetzt auswerten": "Evaluate now",
    "MG Fahrzeug": "MG vehicle",
    "MG-Integration aktiv": "MG integration active",
    "MG API intern": "Internal MG API",
    "Vehicle-ID / VIN": "Vehicle ID / VIN",
    "MG speichern": "Save MG",
    "MG verbinden": "Connect MG",
    "MG Status laden": "Load MG status",
    "MG ist noch nicht verbunden.": "MG is not connected yet.",
    "Standort & Wetter": "Location & weather",
    "Breitengrad (lat)": "Latitude (lat)",
    "Längengrad (lon)": "Longitude (lon)",
    "Open-Meteo Vorhersage aktiv": "Open-Meteo forecast active",
    "Batterie-Ziel-SOC bis Sonnenuntergang (%)": "Battery target SOC by sunset (%)",
    "Vorladen ab X min vor Sonnenuntergang": "Preload from X minutes before sunset",
    "Standort & Wetter speichern": "Save location & weather",
    "Wallbox Steuerung": "Wallbox control",
    "Dynamischer Strom (A)": "Dynamic current (A)",
    "Dauer (Minuten)": "Duration (minutes)",
    "Phasenmodus": "Phase mode",
    "1 Phase": "1 phase",
    "3 Phasen": "3 phases",
    "Laden starten": "Start charging",
    "Laden pausieren": "Pause charging",
    "Laden stoppen": "Stop charging",
    "Strom setzen": "Set current",
    "Phasen setzen": "Set phases",
    "Noch kein Wallbox-Befehl gesendet.": "No wallbox command sent yet.",
    "Verlauf": "History",
    "PV-Leistung": "PV power",
    "Ladeleistung": "Charging power",
    "Batterie-SOC": "Battery SOC",
    "Bat. Laden": "Battery charge",
    "Bat. Entladen": "Battery discharge",
    "Von": "From",
    "Bis": "To",
    "Zeitraum laden": "Load range",
    "Systemstatus": "System status",
    "Letzte Snapshots": "Latest snapshots",
    "Growatt laden": "Load Growatt",
    "Easee laden": "Load Easee",
    "MG laden": "Load MG",
    "Regelung testen": "Test control",
    "Warte auf Daten...": "Waiting for data...",
    "Polling": "Polling",
    "Charger Freigabe": "Charger enabled",
    "Automatik": "Automation",
    "Regelmodus": "Control mode",
    "Growatt Adapter": "Growatt adapter",
    "Growatt Unit-ID": "Growatt unit ID",
    "Growatt Poll": "Growatt poll",
    "Easee Charger": "Easee charger",
    "Easee Poll": "Easee poll",
    "Letzter Growatt-Poll": "Last Growatt poll",
    "Letzter Easee-Poll": "Last Easee poll",
    "Letzter Fehler": "Last error",
    "aktiv": "active",
    "gestoppt": "stopped",
    "deaktiviert": "disabled",
    "Ja": "Yes",
    "Nein": "No",
    "Soll laden": "Should charge",
    "Soll nicht laden": "Should not charge",
    "Schutz aktiv": "Protection active",
    "Schutz frei": "Protection clear",
    "Kein Stromvorschlag": "No current suggestion",
    "Keine Hinweise.": "No notes.",
    "Automatik-Loop aktiv": "Automation loop active",
    "Automatik-Loop gestoppt": "Automation loop stopped",
    "Noch keine Soll-Entscheidung": "No target decision yet",
    "Soll pausieren": "Should pause",
    "Kein Zielstrom": "No target current",
    "Keine Zielphase": "No target phase",
    "Kein Automatikfehler": "No automation error",
    "Noch keine historischen Daten vorhanden.": "No historical data yet.",
    "Lade…": "Loading...",
    "Bitte Von- und Bis-Datum auswählen.": "Please select both from and to dates.",
    "Aktion wird ausgeführt...": "Action is running...",
    "Befehl wird übermittelt…": "Sending command...",
    "Wallbox-Befehl wird gesendet. Bitte nicht erneut klicken…": "Sending wallbox command. Please do not click again...",
    "Befehl wird an die Wallbox gesendet...": "Sending command to wallbox...",
    "Live-Daten folgen mit dem nächsten Poll.": "Live data will follow with the next poll.",
    "Keine Charger im Easee-Account gefunden.": "No chargers found in the Easee account.",
    "Charger automatisch ausgewählt.": "Charger selected automatically."
    ,
    "Kein Standort konfiguriert — bitte Breitengrad und Längengrad eintragen und speichern.": "No location configured. Please enter latitude and longitude and save.",
    "Sonnenaufgang": "Sunrise",
    "Sonnenhöchststand": "Solar noon",
    "Sonnenuntergang": "Sunset",
    "Zeit bis Sonnenuntergang": "Time until sunset",
    "Sonne bereits untergegangen": "Sun has already set",
    "Strahlung jetzt": "Current irradiance",
    "Kalibrierungsfaktor": "Calibration factor",
    "Kalibrierung": "Calibration",
    "Optimales Ladefenster": "Optimal charging window",
    "Batterie-Vorladen aktiv": "Battery preloading active",
    "Open-Meteo nicht erreichbar": "Open-Meteo unavailable",
    "Sonnenzeiten funktionieren trotzdem.": "Sun times still work.",
    "PV-Fenster aktiv.": "PV window active.",
    "Nacht": "Night",
    "kein PV-Fenster aktiv.": "no PV window active.",
    "MG ist angemeldet, aber der Zugriff auf das Fahrzeug ist abgelaufen oder wurde widerrufen. Bitte das Fahrzeug in der MG-App neu autorisieren und danach hier erneut verbinden.": "MG login is valid, but vehicle access has expired or was revoked. Please re-authorize the vehicle in the MG app and reconnect here afterwards.",
    "MG ist verbunden, liefert im Moment aber keine verwertbaren Fahrzeugdaten. Bitte Rohdaten pruefen und den Abruf erneut versuchen.": "MG is connected but currently provides no usable vehicle data. Please check the raw output and try the request again.",
    "MG-Abruf fehlgeschlagen:": "MG request failed:",
    "MG zeigt den letzten bekannten Status. Ein neuer Abruf ist fehlgeschlagen:": "MG is showing the last known status. A fresh request failed:",
    "MG verbunden. Fahrzeugdaten zuletzt aktualisiert:": "MG connected. Vehicle data last updated:",
    "MG ist aktiviert. Fahrzeugdaten werden gerade geladen.": "MG is enabled. Vehicle data is being loaded.",
    "PV System": "PV system",
    "Hauslast": "House load",
    "AC Gesamt": "AC total",
    "Letzte Daten": "Latest data",
    "PV liefert": "PV producing",
    "Keine PV-Leistung": "No PV power",
    "Batterie": "Battery",
    "Batterieleistung": "Battery power",
    "Laden": "Charging",
    "Entladen": "Discharging",
    "Kein Flow-State": "No flow state",
    "Netz": "Grid",
    "Import": "Import",
    "Export": "Export",
    "Regelgrenze": "Control limit",
    "Netzbezug": "Grid import",
    "Einspeisung": "Exporting",
    "Nahe Null": "Near zero",
    "Wallbox": "Wallbox",
    "Ausgangsstrom": "Output current",
    "Session": "Session",
    "Online": "Online",
    "Offline": "Offline",
    "Freigegeben": "Enabled",
    "Deaktiviert": "Disabled",
    "Lädt": "Charging",
    "Lädt nicht": "Not charging",
    "Reichweite": "Range",
    "Ziel-SOC": "Target SOC",
    "Letzter Status": "Last status",
    "MG Fehler": "MG error",
    "Status bereit": "Status ready",
    "Regler-Ziel": "Controller target",
    "An Easee gesetzt": "Sent to Easee",
    "Von Easee signalisiert": "Reported by Easee",
    "Vom Fahrzeug gezogen": "Drawn by vehicle",
    "Site-/Circuit-Limit": "Site/circuit limit",
    "Letzter Regler-Eingriff": "Last controller action",
    "Reglerstatus": "Controller status",
    "Noch nicht genug Daten für eine klare Diagnose.": "Not enough data yet for a clear diagnosis.",
    "Die Regelung ist noch nicht am Zielwert angekommen.": "The controller has not yet reached the target value.",
    "Die Regelung funktioniert bis zur Wallbox:": "The controller is working up to the wallbox:",
    "Die Regelung funktioniert technisch.": "The controller is working technically.",
    "Die Regelung sendet korrekt, wird aber von einem externen Limit ausgebremst:": "The controller is sending correct values but is limited by an external limit:",
    "Die Regelung sendet korrekt": "The controller is sending correct values",
    "Kein offensichtliches externes Stromlimit erkannt.": "No obvious external current limit detected.",
    "Status": "Status",
    "Hinweis": "Note",
    "Leistung": "Power",
    "Strom": "Current",
    "Dynamischer Strom": "Dynamic current",
    "Aktive Phase(n)": "Active phase(s)",
    "Kein Strom wegen": "No current because",
    "Lifetime": "Lifetime",
    "Letzter Fahrzeug-Puls": "Last vehicle pulse",
    "Neu verbinden erforderlich": "Reconnect required",
    "Noch keine Easee-Login-Rohdaten.": "No Easee login raw data yet.",
    "Noch keine MG-Login-Rohdaten.": "No MG login raw data yet.",
    "Ladevorgang gestartet.": "Charging started.",
    "Ladevorgang pausiert.": "Charging paused.",
    "Ladevorgang gestoppt.": "Charging stopped.",
    "Dynamischer Ladestrom gesetzt.": "Dynamic charging current set.",
    "Phasenmodus gesetzt.": "Phase mode set.",
    "Manuelles Laden aktiv:": "Manual charging active:"
  }
};
const originalTextNodes = new WeakMap();

function t(value) {
  if (currentLanguage === "de" || typeof value !== "string") {
    return value;
  }
  return translations[currentLanguage]?.[value] || value;
}

function translatePhrase(value) {
  if (currentLanguage === "de" || typeof value !== "string") {
    return value;
  }
  let result = translations[currentLanguage]?.[value] || value;
  const phrases = translations[currentLanguage] || {};
  for (const [source, target] of Object.entries(phrases)) {
    if (source.length > 4 && result.includes(source)) {
      result = result.replaceAll(source, target);
    }
  }
  return result;
}

function getLocale() {
  return languageLocales[currentLanguage] || "de-DE";
}

function translateTextNodes(root = document.body) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent || ["SCRIPT", "STYLE", "PRE", "TEXTAREA"].includes(parent.tagName)) {
        return NodeFilter.FILTER_REJECT;
      }
      return node.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    }
  });
  const nodes = [];
  while (walker.nextNode()) {
    nodes.push(walker.currentNode);
  }
  for (const node of nodes) {
    if (!originalTextNodes.has(node)) {
      originalTextNodes.set(node, node.nodeValue);
    }
    const sourceValue = originalTextNodes.get(node);
    const original = sourceValue.trim();
    const translated = currentLanguage === "de" ? original : t(original);
    if (translated !== original) {
      node.nodeValue = sourceValue.replace(original, translated);
    } else {
      node.nodeValue = sourceValue;
    }
  }
}

function applyLanguageToDocument() {
  document.documentElement.lang = currentLanguage;
  const select = document.getElementById("language-select");
  if (select) {
    select.value = currentLanguage;
  }
  translateTextNodes();
  const title = document.getElementById("current-view-title");
  const active = window.localStorage.getItem("pvcc-active-view") || "home";
  if (title) {
    title.textContent = viewLabelTranslations[currentLanguage]?.[active] || viewLabelTranslations.de[active] || "Start";
  }
}

function setLanguage(language) {
  currentLanguage = language === "en" ? "en" : "de";
  window.localStorage.setItem("pvcc-language", currentLanguage);
  applyLanguageToDocument();
  refreshDashboard().catch(() => undefined);
  loadHistory().catch(() => undefined);
}

async function api(path, options) {
  const response = await fetch(path, {
    cache: "no-store",
    ...options
  });
  const raw = await response.text();
  let data;
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    data = { message: raw || `HTTP ${response.status}` };
  }
  if (!response.ok) {
    throw new Error(data.message || `HTTP ${response.status}`);
  }
  return data;
}

function setOutput(value) {
  document.getElementById("output").textContent = typeof value === "string" ? value : JSON.stringify(value, null, 2);
}

function setPanelOutput(id, value) {
  const element = document.getElementById(id);
  if (!element) {
    return;
  }
  element.textContent = typeof value === "string" ? value : JSON.stringify(value, null, 2);
}

function setFeedback(id, tone, message) {
  const element = document.getElementById(id);
  element.className = `feedback ${tone}`.trim();
  element.textContent = translatePhrase(message);
}

function formatNumber(value, digits = 0) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "-";
  }
  return new Intl.NumberFormat(getLocale(), { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value);
}

function formatWatts(value) {
  return typeof value === "number" ? `${formatNumber(value, 0)} W` : "-";
}

function formatAmps(value, digits = 1) {
  return typeof value === "number" && !Number.isNaN(value) ? `${formatNumber(value, digits)} A` : "-";
}

function formatKwh(value) {
  return typeof value === "number" ? `${formatNumber(value, 2)} kWh` : "-";
}

function formatPercent(value) {
  return typeof value === "number" ? `${formatNumber(value, 1)} %` : "-";
}

function formatTimestamp(value) {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString(getLocale());
}

function setActiveView(viewName) {
  const view = viewLabelTranslations.de[viewName] ? viewName : "home";
  const radio = document.getElementById(`view-${view}`);
  if (radio) {
    radio.checked = true;
  }
  document.querySelectorAll("[data-view]").forEach((panel) => {
    panel.hidden = panel.dataset.view !== view;
  });
  document.querySelectorAll("[data-view-target]").forEach((button) => {
    button.classList.toggle("active", button.dataset.viewTarget === view);
  });
  const title = document.getElementById("current-view-title");
  if (title) {
    title.textContent = viewLabelTranslations[currentLanguage]?.[view] || viewLabelTranslations.de[view];
  }
  window.localStorage.setItem("pvcc-active-view", view);
}

function closeDrawer() {
  document.getElementById("app-drawer")?.classList.remove("open");
  document.getElementById("nav-backdrop")?.classList.remove("open");
  document.getElementById("menu-toggle")?.setAttribute("aria-expanded", "false");
  const navOpen = document.getElementById("nav-open");
  if (navOpen) {
    navOpen.checked = false;
  }
}

function openDrawer() {
  document.getElementById("app-drawer")?.classList.add("open");
  document.getElementById("nav-backdrop")?.classList.add("open");
  document.getElementById("menu-toggle")?.setAttribute("aria-expanded", "true");
  const navOpen = document.getElementById("nav-open");
  if (navOpen) {
    navOpen.checked = true;
  }
}

function initNavigation() {
  document.getElementById("language-select")?.addEventListener("change", (event) => {
    setLanguage(event.target.value);
  });
  document.getElementById("menu-toggle")?.addEventListener("click", openDrawer);
  document.getElementById("drawer-close")?.addEventListener("click", closeDrawer);
  document.getElementById("nav-backdrop")?.addEventListener("click", closeDrawer);
  document.querySelectorAll("[data-view-target]").forEach((button) => {
    button.addEventListener("click", () => {
      setActiveView(button.dataset.viewTarget);
      closeDrawer();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });
  setActiveView(window.localStorage.getItem("pvcc-active-view") || "home");
  applyLanguageToDocument();
}

function formatMgTimestamp(value) {
  if (!value) {
    return "-";
  }
  const normalized = typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value) && !/[zZ]|[+-]\d{2}:\d{2}$/.test(value)
    ? `${value}Z`
    : value;
  return formatTimestamp(normalized);
}

function renderStatus(status, settings) {
  const grid = document.getElementById("status-grid");
  grid.innerHTML = [
    { label: "Polling", value: status.running ? "aktiv" : "gestoppt" },
    { label: "Charger Freigabe", value: settings.easee.chargerEnabled ? "aktiv" : "deaktiviert" },
    { label: "Automatik", value: settings.rules.enabled ? "aktiv" : "deaktiviert" },
    { label: "Regelmodus", value: settings.rules.mode === "pv_optimized" ? "PV-optimiert" : "Manueller Override" },
    { label: "Growatt Adapter", value: `${settings.growatt.inverterHost}:${settings.growatt.inverterPort}` },
    { label: "Growatt Unit-ID", value: settings.growatt.unitId },
    { label: "Growatt Poll", value: `${settings.growatt.pollIntervalSeconds}s` },
    { label: "Easee Charger", value: settings.easee.chargerId || "-" },
    { label: "Easee Poll", value: `${settings.easee.pollIntervalSeconds}s` },
    { label: "Letzter Growatt-Poll", value: formatTimestamp(status.lastGrowatt) },
    { label: "Letzter Easee-Poll", value: formatTimestamp(status.lastEasee) },
    { label: "Letzter Fehler", value: status.lastError || "-" }
  ].map((item) => `<article class="stat"><strong>${item.label}</strong><span>${item.value}</span></article>`).join("");

  const toggleAutomation = document.getElementById("toggle-automation");
  const automationActive = settings.rules.enabled;
  toggleAutomation.textContent = automationActive ? "Automatik pausieren" : "Automatik fortsetzen";
  toggleAutomation.className = automationActive ? "warn" : "";

  const toggleButton = document.getElementById("toggle-charger");
  toggleButton.textContent = settings.easee.chargerEnabled ? "Charger deaktivieren" : "Charger aktivieren";
  toggleButton.className = settings.easee.chargerEnabled ? "warn" : "";
}

function chargerModeLabel(modeCode) {
  const mapping = {
    0: "Offline",
    1: "Wartet",
    2: "Bereit",
    3: "Lädt",
    4: "Abgeschlossen",
    5: "Fehler"
  };
  return mapping[modeCode] || (modeCode == null ? "-" : `Modus ${modeCode}`);
}

function reasonForNoCurrentLabel(code) {
  const mapping = {
    0: "Kein Sperrgrund",
    1: "Stromlimit im Lastmanagement zu niedrig",
    2: "Dynamisches Stromlimit zu niedrig",
    3: "Offline-Fallback-Stromlimit zu niedrig",
    4: "Sicherung oder Circuit-Limit zu niedrig",
    5: "Wartet in der Lade-Warteschlange",
    6: "Wartet in der Vollgeladen-Warteschlange",
    10: "Equalizer liefert zu wenig Strom frei",
    11: "Phase nicht verbunden",
    24: "Ladevorgang wird vorbereitet",
    25: "Durch Circuit-Fuse limitiert",
    26: "Durch max. Circuit-Strom limitiert",
    50: "Kein Fahrzeug verbunden",
    52: "Max. Dynamic Charger Current ist zu niedrig",
    54: "Ladung wird durch Wallbox-Regeln oder externen Modus gebremst",
    55: "Autorisierung oder Startfreigabe fehlt",
    77: "Lädt aktiv oder Fahrzeug nimmt aktuell Strom an",
    78: "Fahrzeug begrenzt den Strom selbst (z.B. Akku fast voll)",
    80: "Durch lokale Anpassung limitiert"
  };
  return mapping[code] || (code == null ? "-" : `Code ${code}`);
}

function outputPhaseLabel(value) {
  const mapping = {
    0: "Keine aktive Phase",
    1: "Phase 1",
    2: "Phase 2",
    4: "Phase 3",
    3: "Phase 1 + 2",
    5: "Phase 1 + 3",
    6: "Phase 2 + 3",
    7: "3 Phasen",
    14: "1 Phase aktiv"
  };
  return mapping[value] || (value == null ? "-" : `Phasen-Code ${value}`);
}

function allocatedCurrentLabel(raw) {
  const values = [
    Number(raw?.circuitTotalAllocatedPhaseConductorCurrentL1),
    Number(raw?.circuitTotalAllocatedPhaseConductorCurrentL2),
    Number(raw?.circuitTotalAllocatedPhaseConductorCurrentL3)
  ].filter((value) => Number.isFinite(value) && value > 0);

  if (!values.length) {
    return "-";
  }

  return `${formatNumber(Math.max(...values), 1)} A`;
}

function maxAvailableCurrent(raw) {
  const values = [
    Number(raw?.eqAvailableCurrentP1),
    Number(raw?.eqAvailableCurrentP2),
    Number(raw?.eqAvailableCurrentP3),
    Number(raw?.circuitTotalAllocatedPhaseConductorCurrentL1),
    Number(raw?.circuitTotalAllocatedPhaseConductorCurrentL2),
    Number(raw?.circuitTotalAllocatedPhaseConductorCurrentL3)
  ].filter((value) => Number.isFinite(value) && value > 0);

  return values.length ? Math.max(...values) : null;
}

function actualVehicleCurrent(raw) {
  const values = [
    Number(raw?.circuitTotalPhaseConductorCurrentL1),
    Number(raw?.circuitTotalPhaseConductorCurrentL2),
    Number(raw?.circuitTotalPhaseConductorCurrentL3),
    Number(raw?.inCurrentT2),
    Number(raw?.inCurrentT3),
    Number(raw?.inCurrentT4),
    Number(raw?.inCurrentT5)
  ].filter((value) => Number.isFinite(value) && value > 0.1);

  return values.length ? Math.max(...values) : null;
}

function deriveLimitWarning(easee) {
  const requestedCurrent = typeof easee.dynamicChargerCurrentAmp === "number" ? easee.dynamicChargerCurrentAmp : null;
  const actualCurrent = actualVehicleCurrent(easee.raw) ?? (typeof easee.outputCurrentAmp === "number" ? easee.outputCurrentAmp : null);
  const availableCurrent = maxAvailableCurrent(easee.raw);

  if (requestedCurrent == null || actualCurrent == null) {
    return null;
  }

  if (requestedCurrent - actualCurrent < 1) {
    return null;
  }

  if (availableCurrent != null && requestedCurrent - availableCurrent >= 1) {
    return {
      tone: "error",
      message: `Controller fordert ${formatAmps(requestedCurrent)}, aber Easee/Circuit gibt aktuell nur ${formatAmps(availableCurrent)} frei. Das deutet auf ein Site-, Circuit- oder Equalizer-Limit hin.`
    };
  }

  return {
    tone: "busy",
    message: `Controller fordert ${formatAmps(requestedCurrent)}, aber Fahrzeug oder Wallbox zieht aktuell nur ${formatAmps(actualCurrent)}. Bitte Fahrzeuglimit oder Ladeprofil prüfen.`
  };
}

function buildForecastSvg(forecast, minChargingW) {
  const dayPoints = forecast.filter((p) => p.hour >= 5 && p.hour <= 21);
  if (!dayPoints.length) return "";

  const vw = 900, vh = 200;
  const pl = 58, pr = 16, pt = 14, pb = 32;
  const cw = vw - pl - pr, ch = vh - pt - pb;

  const maxPv = Math.max(
    ...dayPoints.map((p) => p.predictedPvW ?? p.irradianceWm2 * 12),
    minChargingW * 1.3,
    500
  );

  const xOf = (hour) => pl + ((hour - 5) / 16) * cw;
  const yOf = (w) => pt + ch * (1 - w / maxPv);
  const nowH = new Date().getHours() + new Date().getMinutes() / 60;

  // Charging window rectangles
  let rects = "";
  let winStart = null;
  for (const p of [...dayPoints, { hour: 22, isChargingWindow: false }]) {
    if (p.isChargingWindow && winStart == null) { winStart = p.hour; }
    else if (!p.isChargingWindow && winStart != null) {
      const x1 = xOf(winStart), x2 = xOf(p.hour);
      rects += `<rect x="${x1.toFixed(1)}" y="${pt}" width="${(x2 - x1).toFixed(1)}" height="${ch}" fill="rgba(45,123,82,.13)" rx="2"/>`;
      winStart = null;
    }
  }

  // Irradiance reference (scaled, light gray — visible even without calibration)
  const irrFactor = maxPv / Math.max(...dayPoints.map((p) => p.irradianceWm2), 1);
  const irrPts = dayPoints.map((p) => `${xOf(p.hour).toFixed(1)},${yOf(p.irradianceWm2 * irrFactor).toFixed(1)}`).join(" ");

  // Predicted PV (calibrated, orange)
  const pvPts = dayPoints.filter((p) => p.predictedPvW != null)
    .map((p) => `${xOf(p.hour).toFixed(1)},${yOf(p.predictedPvW).toFixed(1)}`).join(" ");

  const thY = yOf(minChargingW).toFixed(1);
  const nowX = xOf(Math.min(21, Math.max(5, nowH))).toFixed(1);

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => {
    const w = f * maxPv;
    const y = yOf(w).toFixed(1);
    const lbl = w >= 1000 ? `${(w / 1000).toFixed(1)} kW` : `${Math.round(w)} W`;
    return `<line x1="${pl}" y1="${y}" x2="${pl + cw}" y2="${y}" stroke="#ddd0c4" stroke-width=".6"/>
            <text x="${(pl - 5).toFixed(0)}" y="${(Number(y) + 4).toFixed(0)}" text-anchor="end" font-size="11" fill="#68757a">${lbl}</text>`;
  }).join("");

  const xLabels = [6, 8, 10, 12, 14, 16, 18, 20].map((h) =>
    `<text x="${xOf(h).toFixed(1)}" y="${pt + ch + 20}" text-anchor="middle" font-size="11" fill="#68757a">${h}:00</text>`
  ).join("");

  return `<svg viewBox="0 0 ${vw} ${vh}" style="width:100%;max-height:220px;display:block" xmlns="http://www.w3.org/2000/svg">
    ${rects}
    <polyline points="${irrPts}" fill="none" stroke="#ccc" stroke-width="1.5" stroke-dasharray="4,3"/>
    ${pvPts ? `<polyline points="${pvPts}" fill="none" stroke="#c65d2e" stroke-width="2.5" stroke-linejoin="round"/>` : ""}
    <line x1="${pl}" y1="${thY}" x2="${pl + cw}" y2="${thY}" stroke="#2d7b52" stroke-width="1.2" stroke-dasharray="5,4"/>
    <line x1="${nowX}" y1="${pt}" x2="${nowX}" y2="${pt + ch}" stroke="#b4432c" stroke-width="1.5" stroke-dasharray="4,3" opacity=".85"/>
    ${yTicks}
    ${xLabels}
    <line x1="${pl}" y1="${pt}" x2="${pl}" y2="${pt + ch}" stroke="#aaa" stroke-width="1"/>
    <line x1="${pl}" y1="${pt + ch}" x2="${pl + cw}" y2="${pt + ch}" stroke="#aaa" stroke-width="1"/>
    <g font-size="10" fill="#68757a">
      <line x1="${pl + cw - 120}" y1="${pt + 8}" x2="${pl + cw - 106}" y2="${pt + 8}" stroke="#ccc" stroke-width="1.5" stroke-dasharray="4,3"/>
      <text x="${pl + cw - 102}" y="${pt + 12}">Strahlung (skaliert)</text>
      <line x1="${pl + cw - 120}" y1="${pt + 22}" x2="${pl + cw - 106}" y2="${pt + 22}" stroke="#c65d2e" stroke-width="2.5"/>
      <text x="${pl + cw - 102}" y="${pt + 26}">Erwartete PV</text>
      <line x1="${pl + cw - 120}" y1="${pt + 36}" x2="${pl + cw - 106}" y2="${pt + 36}" stroke="#2d7b52" stroke-width="1.2" stroke-dasharray="5,4"/>
      <text x="${pl + cw - 102}" y="${pt + 40}">Min. Ladegrenze</text>
    </g>
  </svg>`;
}

function renderWeather(data) {
  const w = data.weather;
  const grid = document.getElementById("weather-grid");

  if (!w) {
    grid.innerHTML = "";
    setFeedback("weather-feedback", "busy", "Kein Standort konfiguriert — bitte Breitengrad und Längengrad eintragen und speichern.");
    document.getElementById("forecast-chart").innerHTML = "";
    return;
  }

  const sun = w.sunTimes;
  const minutesToSunset = sun ? Math.round(sun.minutesToSunset) : null;
  const hoursToSunset = minutesToSunset != null
    ? `${Math.floor(minutesToSunset / 60)} h ${minutesToSunset % 60} min`
    : "-";

  const minAmps = data.settings?.rules?.minAmps ?? 7;
  const phaseCount = data.settings?.rules?.phaseMode === "three" ? 3 : 1;
  const minChargingW = minAmps * 230 * phaseCount;

  const calibLabel = w.calibrationSamples >= 20
    ? `${w.calibrationSamples} Messungen (gut)`
    : w.calibrationSamples >= 5
      ? `${w.calibrationSamples} Messungen (aufbauend)`
      : w.calibrationSamples > 0
        ? `${w.calibrationSamples} Messungen (zu wenig)`
        : "Noch keine Daten — Kalibrierung startet beim Laden";

  const optimalWindow = (w.dailyForecast ?? []).filter((p) => p.isChargingWindow);
  const windowText = optimalWindow.length
    ? `${optimalWindow[0].hour}:00 – ${optimalWindow[optimalWindow.length - 1].hour + 1}:00 Uhr`
    : "Kein optimales Ladefenster heute";

  grid.innerHTML = [
    { label: "Sonnenaufgang", value: sun ? formatTimestamp(sun.sunrise) : "-" },
    { label: "Sonnenhöchststand", value: sun ? formatTimestamp(sun.solarNoon) : "-" },
    { label: "Sonnenuntergang", value: sun ? formatTimestamp(sun.sunset) : "-" },
    { label: "Zeit bis Sonnenuntergang", value: minutesToSunset != null && minutesToSunset > 0 ? hoursToSunset : (sun ? "Sonne bereits untergegangen" : "-") },
    { label: "Strahlung jetzt", value: w.currentIrradianceWm2 != null ? `${formatNumber(w.currentIrradianceWm2, 0)} W/m²` : "-" },
    { label: "Kalibrierungsfaktor", value: w.calibrationFactor != null ? `${formatNumber(w.calibrationFactor, 1)} W pro W/m²` : "-" },
    { label: "Kalibrierung", value: calibLabel },
    { label: "Optimales Ladefenster", value: windowText }
  ].map((item) => `<article class="stat"><strong>${item.label}</strong><span>${item.value}</span></article>`).join("");

  document.getElementById("forecast-chart").innerHTML =
    buildForecastSvg(w.dailyForecast ?? [], minChargingW);

  const targetSoc = data.settings?.weather?.targetBatterySocAtSunsetPercent;
  const batterySoc = typeof data.growatt?.battery?.bms_soc_percent === "number"
    ? data.growatt.battery.bms_soc_percent * 100
    : null;
  const preloadActive = data.decision?.reason === "Batterie-Vorladen vor Sonnenuntergang";

  if (preloadActive) {
    const missing = targetSoc != null && batterySoc != null
      ? `${(targetSoc - batterySoc).toFixed(1)} % fehlen noch.`
      : "";
    setFeedback("weather-feedback", "busy", `Batterie-Vorladen aktiv: ${missing} EV-Laden pausiert bis Batterie ${targetSoc} % erreicht.`);
  } else if (w.fetchError) {
    setFeedback("weather-feedback", "warn", `Open-Meteo nicht erreichbar: ${w.fetchError} — Sonnenzeiten funktionieren trotzdem.`);
  } else if (sun?.isDay) {
    setFeedback("weather-feedback", "ok", `PV-Fenster aktiv. Sonnenuntergang in ${hoursToSunset}.`);
  } else {
    setFeedback("weather-feedback", "", sun ? "Nacht — kein PV-Fenster aktiv." : "-");
  }
}

function renderMgSummary(data) {
  const mg = data.mg || {};
  const status = mg.status || null;
  const settings = data.settings || {};
  const mgErrorText = `${mg.error || ""} ${mg.fetchError || ""}`.toLowerCase();
  const mgAuthRevoked = mgErrorText.includes("1100003") || mgErrorText.includes("revoked") || mgErrorText.includes("widerrufen");
  const mgNoUsableData = mgErrorText.includes("keine verwertbaren fahrzeugdaten");
  const badges = [
    { label: settings.mg?.enabled ? "MG aktiv" : "MG inaktiv", tone: settings.mg?.enabled ? "ok" : "neutral" },
    { label: status?.vin || settings.mg?.vehicleId || "Keine VIN", tone: status?.vin || settings.mg?.vehicleId ? "ok" : "warn" },
    { label: status?.socPercent == null ? "SOC unbekannt" : `SOC ${formatPercent(status.socPercent)}`, tone: status?.socPercent == null ? "warn" : "ok" },
    { label: status?.isCharging ? "Fahrzeug lädt" : "Fahrzeug lädt nicht", tone: status?.isCharging ? "ok" : "neutral" }
  ];

  document.getElementById("mg-status-summary").innerHTML =
    badges.map((badge) => `<span class="badge ${badge.tone}">${badge.label}</span>`).join("");

  if (!settings.mg?.enabled) {
    setFeedback("mg-feedback", "", "MG-Integration ist deaktiviert.");
  } else if (mgAuthRevoked) {
    setFeedback("mg-feedback", "warn", "MG ist angemeldet, aber der Zugriff auf das Fahrzeug ist abgelaufen oder wurde widerrufen. Bitte das Fahrzeug in der MG-App neu autorisieren und danach hier erneut verbinden.");
  } else if (mg.error && mgNoUsableData) {
    setFeedback("mg-feedback", "warn", "MG ist verbunden, liefert im Moment aber keine verwertbaren Fahrzeugdaten. Bitte Rohdaten pruefen und den Abruf erneut versuchen.");
  } else if (mg.error) {
    setFeedback("mg-feedback", "error", `MG-Abruf fehlgeschlagen: ${mg.error}`);
  } else if (mg.fetchError) {
    setFeedback("mg-feedback", "warn", `MG zeigt den letzten bekannten Status. Ein neuer Abruf ist fehlgeschlagen: ${mg.fetchError}`);
  } else if (status) {
    setFeedback("mg-feedback", "ok", `MG verbunden. Fahrzeugdaten zuletzt aktualisiert: ${formatMgTimestamp(status.updatedAt)}.`);
  } else {
    setFeedback("mg-feedback", "busy", "MG ist aktiviert. Fahrzeugdaten werden gerade geladen.");
  }
}

const historySeriesVisible = { pv: true, charge: true, soc: true, batCharge: true, batDischarge: true };

function applySeriesVisibility() {
  const map = { pv: "hs-pv", charge: "hs-charge", soc: "hs-soc", batCharge: "hs-bat-charge", batDischarge: "hs-bat-discharge" };
  for (const [key, id] of Object.entries(map)) {
    const el = document.getElementById(id);
    if (el) el.style.display = historySeriesVisible[key] ? "" : "none";
  }
  document.querySelectorAll("[data-series-key]").forEach((btn) => {
    const on = historySeriesVisible[btn.dataset.seriesKey];
    btn.style.opacity = on ? "1" : "0.35";
    btn.style.textDecoration = on ? "" : "line-through";
  });
}

function buildHistoryChart(data) {
  const n = data?.pvPowerW?.length;
  if (!n) return '<p class="muted" style="padding:.5rem">Noch keine historischen Daten vorhanden.</p>';

  const { pvPowerW, chargingPowerW, batteryChargeW, batteryDischargeW, socPercent, timeRange } = data;
  const hours = timeRange?.hours ?? 12;

  const vw = 900, vh = 240;
  const pl = 60, pr = 50, pt = 10, pb = 32;
  const cw = vw - pl - pr, ch = vh - pt - pb;

  const allPow = [...pvPowerW, ...chargingPowerW, ...batteryChargeW, ...batteryDischargeW]
    .map((p) => p.v).filter((v) => v != null && v > 0);
  const plausiblePow = allPow.filter((value) => value <= HISTORY_CHART_MAX_POWER_W);
  const maxPlausiblePow = plausiblePow.length ? Math.max(...plausiblePow) : Math.min(Math.max(...allPow, 0), HISTORY_CHART_MAX_POWER_W);
  const maxPow = Math.max(1000, Math.ceil(maxPlausiblePow * 1.1));

  const xOf = (i) => pl + (i / (n - 1)) * cw;
  const yPow = (w) => pt + ch * (1 - Math.min(maxPow, HISTORY_CHART_MAX_POWER_W, Math.max(0, w)) / maxPow);
  const ySoc = (s) => pt + ch * (1 - Math.max(0, Math.min(100, s)) / 100);

  const segments = (series, yFn, stroke, width, dash = "") => {
    if (!series?.length) return "";
    const segs = []; let cur = [];
    for (let i = 0; i < series.length; i++) {
      const p = series[i];
      if (p.v != null && p.v >= 0) { cur.push(`${xOf(i).toFixed(1)},${yFn(p.v).toFixed(1)}`); }
      else if (cur.length > 1) { segs.push(cur.join(" ")); cur = []; }
      else { cur = []; }
    }
    if (cur.length > 1) segs.push(cur.join(" "));
    const da = dash ? ` stroke-dasharray="${dash}"` : "";
    return segs.map((pts) =>
      `<polyline points="${pts}" fill="none" stroke="${stroke}" stroke-width="${width}"${da} stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>`
    ).join("");
  };

  const yGridLeft = [0, 0.25, 0.5, 0.75, 1].map((f) => {
    const w = f * maxPow;
    const y = yPow(w).toFixed(1);
    const lbl = w >= 1000 ? `${(w / 1000).toFixed(1)}kW` : `${Math.round(w)}W`;
    return `<line x1="${pl}" y1="${y}" x2="${pl + cw}" y2="${y}" stroke="#e8ddd4" stroke-width=".6"/>
            <text x="${pl - 5}" y="${(Number(y) + 4).toFixed(0)}" text-anchor="end" font-size="11" fill="#68757a">${lbl}</text>`;
  }).join("");

  const yRight = [0, 25, 50, 75, 100].map((pct) => {
    const y = ySoc(pct).toFixed(1);
    return `<text x="${pl + cw + 6}" y="${(Number(y) + 4).toFixed(0)}" font-size="11" fill="#2c6a9a">${pct}%</text>`;
  }).join("");

  const from = new Date(timeRange?.from ?? 0).getTime();
  const to = new Date(timeRange?.to ?? Date.now()).getTime();
  const tickCount = 7;
  const xLabels = Array.from({ length: tickCount }, (_, k) => {
    const frac = k / (tickCount - 1);
    const ts = new Date(from + frac * (to - from));
    const x = (pl + frac * cw).toFixed(1);
    let lbl;
    if (hours <= 48) {
      lbl = ts.toLocaleTimeString(getLocale(), { hour: "2-digit", minute: "2-digit" });
    } else if (hours <= 168) {
      lbl = ts.toLocaleDateString(getLocale(), { weekday: "short", day: "numeric" });
    } else {
      lbl = ts.toLocaleDateString(getLocale(), { day: "numeric", month: "numeric" });
    }
    return `<text x="${x}" y="${pt + ch + 22}" text-anchor="middle" font-size="11" fill="#68757a">${lbl}</text>`;
  }).join("");

  return `<svg viewBox="0 0 ${vw} ${vh}" style="width:100%;max-height:260px;display:block" xmlns="http://www.w3.org/2000/svg">
    ${yGridLeft}${yRight}${xLabels}
    <line x1="${pl}" y1="${pt}" x2="${pl}" y2="${pt + ch}" stroke="#aaa" stroke-width="1"/>
    <line x1="${pl + cw}" y1="${pt}" x2="${pl + cw}" y2="${pt + ch}" stroke="#aaa" stroke-width="1"/>
    <line x1="${pl}" y1="${pt + ch}" x2="${pl + cw}" y2="${pt + ch}" stroke="#aaa" stroke-width="1"/>
    <g id="hs-pv">${segments(pvPowerW, yPow, "#c65d2e", "2")}</g>
    <g id="hs-charge">${segments(chargingPowerW, yPow, "#1a6640", "2.5")}</g>
    <g id="hs-bat-charge">${segments(batteryChargeW, yPow, "#5a7fa0", "1.5", "4,3")}</g>
    <g id="hs-bat-discharge">${segments(batteryDischargeW, yPow, "#9a7030", "1.5", "4,3")}</g>
    <g id="hs-soc">${segments(socPercent, ySoc, "#2c6a9a", "2")}</g>
  </svg>`;
}

let historyHours = 12;
let historyCustomRange = null;
let lastHistoryData = null;

async function loadHistory() {
  let url;
  if (historyCustomRange) {
    url = `/api/history?from=${encodeURIComponent(historyCustomRange.from)}&to=${encodeURIComponent(historyCustomRange.to)}`;
  } else {
    url = `/api/history?hours=${historyHours}`;
  }
  const data = await api(url);
  lastHistoryData = data;
  document.getElementById("history-chart").innerHTML = buildHistoryChart(data);
  applySeriesVisibility();
  setupHistoryChartInteraction();
  applyLanguageToDocument();
}

function setupHistoryChartInteraction() {
  const data = lastHistoryData;
  if (!data?.pvPowerW?.length) return;
  const svg = document.querySelector("#history-chart svg");
  if (!svg) return;

  const n = data.pvPowerW.length;
  // Must match constants in buildHistoryChart
  const pl = 60, pt = 10, pb = 32, vw = 900, vh = 240, pr = 50;
  const cw = vw - pl - pr, ch = vh - pt - pb;

  // Inject crosshair line into SVG
  const NS = "http://www.w3.org/2000/svg";
  const xhair = document.createElementNS(NS, "line");
  xhair.setAttribute("y1", String(pt));
  xhair.setAttribute("y2", String(pt + ch));
  xhair.setAttribute("stroke", "#68757a");
  xhair.setAttribute("stroke-width", "1");
  xhair.setAttribute("stroke-dasharray", "4,3");
  xhair.style.display = "none";
  xhair.style.pointerEvents = "none";
  svg.appendChild(xhair);

  const tooltip = document.getElementById("history-tooltip");

  const fmtPow = (v) => v == null ? "—" : v >= 1000 ? `${(v / 1000).toFixed(2)} kW` : `${Math.round(v)} W`;
  const fmtPct = (v) => v == null ? "—" : `${v.toFixed(1)} %`;

  svg.addEventListener("mousemove", (e) => {
    const rect = svg.getBoundingClientRect();
    const svgX = (e.clientX - rect.left) / rect.width * vw;

    if (svgX < pl || svgX > pl + cw) {
      xhair.style.display = "none";
      tooltip.style.display = "none";
      return;
    }

    const idx = Math.min(n - 1, Math.max(0, Math.round((svgX - pl) / cw * (n - 1))));
    const xPos = pl + (idx / (n - 1)) * cw;
    xhair.setAttribute("x1", String(xPos));
    xhair.setAttribute("x2", String(xPos));
    xhair.style.display = "";

    const ts = new Date(data.pvPowerW[idx]?.t ?? 0);
    const hours = data.timeRange?.hours ?? 12;
    const timeStr = hours <= 48
      ? ts.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })
      : ts.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" }) +
        " " + ts.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });

    const rows = [
      { key: "pv",          color: "#c65d2e", label: "PV-Leistung",   val: fmtPow(data.pvPowerW[idx]?.v) },
      { key: "charge",      color: "#1a6640", label: "Ladeleistung",  val: fmtPow(data.chargingPowerW[idx]?.v) },
      { key: "soc",         color: "#2c6a9a", label: "Batterie-SOC",  val: fmtPct(data.socPercent[idx]?.v) },
      { key: "batCharge",   color: "#5a7fa0", label: "Bat. Laden",    val: fmtPow(data.batteryChargeW[idx]?.v) },
      { key: "batDischarge",color: "#9a7030", label: "Bat. Entladen", val: fmtPow(data.batteryDischargeW[idx]?.v) }
    ].filter((r) => historySeriesVisible[r.key]);

    tooltip.innerHTML =
      `<div style="font-size:.78rem;color:#aaa;margin-bottom:.35rem;padding-bottom:.3rem;border-bottom:1px solid #444">${timeStr}</div>` +
      rows.map((r) =>
        `<div style="display:flex;justify-content:space-between;gap:1.5rem">` +
        `<span style="color:${r.color}">● ${r.label}</span>` +
        `<span style="font-weight:700">${r.val}</span></div>`
      ).join("");

    // Position: right of cursor unless close to right edge
    const wrap = svg.closest("[style*='position:relative']") ?? svg.parentElement;
    const wrapRect = wrap.getBoundingClientRect();
    const curX = e.clientX - wrapRect.left;
    const curY = e.clientY - wrapRect.top;
    const showLeft = curX > wrapRect.width * 0.58;

    tooltip.style.display = "block";
    tooltip.style.top = `${Math.max(4, curY - 24)}px`;
    if (showLeft) {
      tooltip.style.left = "";
      tooltip.style.right = `${wrapRect.width - curX + 14}px`;
    } else {
      tooltip.style.right = "";
      tooltip.style.left = `${curX + 14}px`;
    }
  });

  svg.addEventListener("mouseleave", () => {
    xhair.style.display = "none";
    tooltip.style.display = "none";
  });
}

function renderDiagnostics(data) {
  const easee = data.easee || {};
  const decision = data.decision || {};
  const automation = data.automation || {};
  const raw = easee.raw || {};
  const requestedCurrent = typeof easee.dynamicChargerCurrentAmp === "number" ? easee.dynamicChargerCurrentAmp : null;
  const outputCurrent = typeof easee.outputCurrentAmp === "number" ? easee.outputCurrentAmp : null;
  const measuredCurrent = actualVehicleCurrent(raw);
  const availableCurrent = maxAvailableCurrent(raw);
  const diagnosticGrid = document.getElementById("diagnostic-grid");
  const diagnosticSummary = document.getElementById("diagnostic-summary");

  diagnosticGrid.innerHTML = [
    { label: "Regler-Ziel", value: decision.suggestedAmps == null ? "-" : formatAmps(decision.suggestedAmps, 0) },
    { label: "An Easee gesetzt", value: formatAmps(requestedCurrent) },
    { label: "Von Easee signalisiert", value: formatAmps(outputCurrent) },
    { label: "Vom Fahrzeug gezogen", value: formatAmps(measuredCurrent) },
    { label: "Site-/Circuit-Limit", value: formatAmps(availableCurrent) },
    { label: "Letzter Regler-Eingriff", value: automation.lastAction || "-" },
    { label: "Reglerstatus", value: automation.state || "-" }
  ].map((item) => `<article class="stat"><strong>${item.label}</strong><span>${item.value}</span></article>`).join("");

  if (decision.suggestedAmps == null || requestedCurrent == null || outputCurrent == null) {
    setFeedback("diagnostic-summary", "", "Noch nicht genug Daten für eine klare Diagnose.");
    return;
  }

  if (requestedCurrent < decision.suggestedAmps) {
    setFeedback(
      "diagnostic-summary",
      "error",
      `Die Regelung ist noch nicht am Zielwert angekommen. Gewünscht sind ${formatAmps(decision.suggestedAmps, 0)}, aktuell an Easee gesetzt sind aber nur ${formatAmps(requestedCurrent)}.`
    );
    return;
  }

  if (outputCurrent >= requestedCurrent - 0.5) {
    if (measuredCurrent != null && measuredCurrent < requestedCurrent - 1) {
      setFeedback(
        "diagnostic-summary",
      "busy",
      `Die Regelung funktioniert bis zur Wallbox: gesetzt sind ${formatAmps(requestedCurrent)}, Easee signalisiert auch ${formatAmps(outputCurrent)} und das externe Site-/Circuit-Limit liegt bei ${formatAmps(availableCurrent)}. Das Fahrzeug zieht jedoch real nur ${formatAmps(measuredCurrent)}.`
      );
      return;
    }

    setFeedback(
      "diagnostic-summary",
      "ok",
      `Die Regelung funktioniert technisch. Easee signalisiert dem Fahrzeug bereits etwa ${formatAmps(outputCurrent)} und folgt damit dem gesetzten Zielwert.`
    );
    return;
  }

  if (availableCurrent != null && availableCurrent <= outputCurrent + 0.5) {
    setFeedback(
      "diagnostic-summary",
      "error",
      `Die Regelung sendet korrekt, wird aber von einem externen Limit ausgebremst: gesetzt sind ${formatAmps(requestedCurrent)}, das Site-/Circuit-Limit liegt jedoch nur bei ${formatAmps(availableCurrent)} und deshalb bleibt der reale Ladestrom bei ${formatAmps(outputCurrent)}.`
    );
    return;
  }

  setFeedback(
    "diagnostic-summary",
    "busy",
    `Die Regelung sendet korrekt ${formatAmps(requestedCurrent)}, aber das Fahrzeug zieht aktuell nur ${formatAmps(outputCurrent)}. In diesem Fall liegt die Begrenzung eher am Fahrzeug oder an einem lokalen Wallbox-Profil.`
  );
}

function deriveEaseeStatus(data) {
  const easee = data.easee || {};
  const runtime = data.easeeRuntime || {};
  const settings = data.settings || {};

  if (!settings.easee.chargerId) {
    return { title: "Kein Charger ausgewählt", detail: "Bitte zuerst einen Easee-Charger wählen.", tone: "warn" };
  }

  if (runtime.authInvalid) {
    return {
      title: "Easee neu verbinden",
      detail: "Die Sitzung ist abgelaufen oder widerrufen. Bitte Benutzername und Passwort erneut eingeben und verbinden.",
      tone: "bad"
    };
  }

  if (!settings.easee.chargerEnabled) {
    return { title: "Wallbox deaktiviert", detail: "Die Freigabe im Controller ist ausgeschaltet.", tone: "bad" };
  }

  if (runtime.cooldownUntil) {
    return {
      title: "Easee-Cooldown aktiv",
      detail: `Neue Befehle besser erst wieder ab ${formatTimestamp(runtime.cooldownUntil)} senden.`,
      tone: "warn"
    };
  }

  if (!easee.online) {
    return { title: "Wallbox offline", detail: "Es liegen derzeit keine frischen Live-Daten vor.", tone: "bad" };
  }

  if (easee.charging) {
    return {
      title: "Lädt aktiv",
      detail: `${formatWatts(easee.totalPowerWatts)} bei ${typeof easee.outputCurrentAmp === "number" ? `${formatNumber(easee.outputCurrentAmp, 1)} A` : "-"} auf ${outputPhaseLabel(easee.raw?.outputPhase)}.`,
      tone: "ok"
    };
  }

  if (easee.chargerModeCode === 2) {
    if (easee.reasonForNoCurrent === 52 || easee.reasonForNoCurrent === 25 || easee.reasonForNoCurrent === 26 || easee.reasonForNoCurrent === 1 || easee.reasonForNoCurrent === 2 || easee.reasonForNoCurrent === 3 || easee.reasonForNoCurrent === 4 || easee.reasonForNoCurrent === 10 || easee.reasonForNoCurrent === 80) {
      return { title: "Durch Stromlimit blockiert", detail: reasonForNoCurrentLabel(easee.reasonForNoCurrent), tone: "warn" };
    }
    if (easee.reasonForNoCurrent === 55) {
      return { title: "Wartet auf Freigabe", detail: reasonForNoCurrentLabel(easee.reasonForNoCurrent), tone: "warn" };
    }
    if (easee.reasonForNoCurrent === 24) {
      return { title: "Start wird vorbereitet", detail: "Die Wallbox bereitet den Ladevorgang gerade vor.", tone: "neutral" };
    }
    return { title: "Bereit zum Laden", detail: reasonForNoCurrentLabel(easee.reasonForNoCurrent), tone: "neutral" };
  }

  if (easee.chargerModeCode === 1) {
    return { title: "Kein Fahrzeug verbunden", detail: "Die Wallbox meldet aktuell kein angeschlossenes Fahrzeug.", tone: "neutral" };
  }

  if (easee.chargerModeCode === 0) {
    return { title: "Wallbox offline", detail: "Die Wallbox ist nicht mit der Cloud verbunden.", tone: "bad" };
  }

  return { title: chargerModeLabel(easee.chargerModeCode), detail: reasonForNoCurrentLabel(easee.reasonForNoCurrent), tone: "neutral" };
}

function renderEaseeSummary(data) {
  const easee = data.easee || {};
  const settings = data.settings || {};
  const runtime = data.easeeRuntime || {};
  const derived = deriveEaseeStatus(data);
  const limitWarning = deriveLimitWarning(easee);
  const summary = document.getElementById("easee-status-summary");
  const badges = [
    { label: settings.easee.chargerId ? `Charger ${settings.easee.chargerId}` : "Kein Charger ausgewaehlt", tone: settings.easee.chargerId ? "ok" : "warn" },
    { label: easee.online ? "Online" : "Offline/keine Live-Daten", tone: easee.online ? "ok" : "bad" },
    { label: chargerModeLabel(easee.chargerModeCode), tone: easee.charging ? "ok" : "neutral" },
    { label: settings.easee.chargerEnabled ? "Freigegeben" : "Deaktiviert", tone: settings.easee.chargerEnabled ? "ok" : "bad" },
    { label: runtime.safeMode ? "Safe Mode aktiv" : "Safe Mode aus", tone: runtime.safeMode ? "warn" : "ok" }
  ];

  if (runtime.cooldownUntil) {
    badges.push({
      label: `Safe Mode bis ${formatTimestamp(runtime.cooldownUntil)}`,
      tone: "warn"
    });
  }

  if (runtime.authInvalid) {
    badges.push({
      label: "Neu verbinden erforderlich",
      tone: "bad"
    });
  }

  if (runtime.lastErrorStatus != null) {
    badges.push({
      label: `Letzter API-Status ${runtime.lastErrorStatus}`,
      tone: "warn"
    });
  }

  summary.innerHTML = badges.map((badge) => `<span class="badge ${badge.tone}">${badge.label}</span>`).join("");

  if (limitWarning) {
    setFeedback("easee-limit-warning", limitWarning.tone, limitWarning.message);
  } else {
    setFeedback("easee-limit-warning", "", "Kein offensichtliches externes Stromlimit erkannt.");
  }

  document.getElementById("charger-control-grid").innerHTML = [
    { label: "Status", value: derived.title },
    { label: "Hinweis", value: derived.detail },
    { label: "Leistung", value: formatWatts(easee.totalPowerWatts) },
    { label: "Strom", value: formatAmps(easee.outputCurrentAmp) },
    { label: "Dynamischer Strom", value: formatAmps(easee.dynamicChargerCurrentAmp) },
    { label: "Site-/Circuit-Limit", value: allocatedCurrentLabel(easee.raw) },
    { label: "Aktive Phase(n)", value: outputPhaseLabel(easee.raw?.outputPhase) },
    { label: "Kein Strom wegen", value: reasonForNoCurrentLabel(easee.reasonForNoCurrent) },
    { label: "Session", value: formatKwh(easee.sessionEnergyKwh) },
    { label: "Lifetime", value: formatKwh(easee.lifetimeEnergyKwh) },
    { label: "Letzter Fahrzeug-Puls", value: formatTimestamp(easee.raw?.latestPulse) }
  ].map((item) => `<article class="stat"><strong>${item.label}</strong><span>${item.value}</span></article>`).join("");
}

function setSelectValue(id, value) {
  document.getElementById(id).value = String(value);
}

async function loadSettings() {
  const settings = await api("/api/settings");
  document.getElementById("growatt-logger-url").value = "http://127.0.0.1:5001";
  document.getElementById("growatt-host").value = settings.growatt.inverterHost;
  document.getElementById("growatt-port").value = settings.growatt.inverterPort;
  document.getElementById("growatt-unit-id").value = settings.growatt.unitId;
  document.getElementById("growatt-poll-interval").value = settings.growatt.pollIntervalSeconds;
  document.getElementById("easee-charger-id").value = settings.easee.chargerId;
  document.getElementById("easee-poll-interval").value = settings.easee.pollIntervalSeconds;
  setSelectValue("easee-safe-mode", settings.easee.safeMode === true);
  setSelectValue("rules-enabled", settings.rules.enabled);
  setSelectValue("rules-mode", settings.rules.mode);
  setSelectValue("rules-phase-mode", settings.rules.phaseMode);
  document.getElementById("rules-target-vehicle-soc").value = settings.rules.targetVehicleSocPercent ?? "";
  document.getElementById("rules-min-soc").value = settings.rules.minSocPercent;
  document.getElementById("rules-max-battery-discharge").value = settings.rules.maxBatteryDischargeWatts;
  document.getElementById("rules-max-grid-import").value = settings.rules.maxGridImportWatts;
  document.getElementById("rules-max-charge-power").value = settings.rules.maxChargePowerWatts;
  document.getElementById("rules-min-amps").value = settings.rules.minAmps;
  document.getElementById("rules-max-amps").value = settings.rules.maxAmps;
  document.getElementById("rules-up-step-amps").value = settings.rules.upStepAmps;
  document.getElementById("rules-down-step-amps").value = settings.rules.downStepAmps;
  document.getElementById("rules-regulation-interval").value = settings.rules.regulationIntervalSeconds;
  document.getElementById("rules-hold-seconds").value = settings.rules.holdSecondsAfterAdjustment;
  setSelectValue("rules-manual-override-enabled", settings.rules.manualOverrideEnabled);
  document.getElementById("rules-manual-override-amps").value = settings.rules.manualOverrideAmps;
  document.getElementById("location-lat").value = settings.location?.lat ?? 0;
  document.getElementById("location-lon").value = settings.location?.lon ?? 0;
  setSelectValue("weather-enabled", settings.weather?.enabled !== false);
  document.getElementById("weather-target-soc").value = settings.weather?.targetBatterySocAtSunsetPercent ?? 90;
  document.getElementById("weather-preload-window").value = settings.weather?.sunsetPreloadWindowMinutes ?? 120;
  setSelectValue("mg-enabled", settings.mg?.enabled === true);
  document.getElementById("mg-api-base-url").value = settings.mg?.apiBaseUrl || "http://127.0.0.1:5002";
  document.getElementById("mg-username").value = settings.mg?.username || "";
  document.getElementById("mg-password").value = "";
  document.getElementById("mg-vehicle-id").value = settings.mg?.vehicleId || "";
  return settings;
}

function overviewCard(title, value, rows, badges) {
  return `
    <article class="overview-card">
      <h3>${title}</h3>
      <div class="overview-kpi">${value}</div>
      <div class="overview-list">
        ${rows.map((row) => `<div class="overview-row"><strong>${row.label}</strong><span>${row.value}</span></div>`).join("")}
      </div>
      <div class="badge-row">
        ${badges.map((badge) => `<span class="badge ${badge.tone}">${badge.label}</span>`).join("")}
      </div>
    </article>
  `;
}

function renderOverview(data) {
  const growatt = data.growatt || {};
  const easee = data.easee || {};
  const mgStatus = data.mg?.status || {};
  const live = growatt.live || {};
  const battery = growatt.battery || {};
  const decision = data.decision || {};
  const automation = data.automation || {};

  const pvPower = live.pv_total_power_w;
  const loadPower = live.estimated_load_power_w;
  const gridImport = live.estimated_import_from_grid_w;
  const gridExport = live.estimated_export_to_grid_w;
  const batteryPower = battery.battery_power_w;
  const batterySoc = typeof battery.bms_soc_percent === "number" ? battery.bms_soc_percent * 100 : undefined;

  document.getElementById("overview-grid").innerHTML = [
    overviewCard("PV System", formatWatts(pvPower), [
      { label: "Hauslast", value: formatWatts(loadPower) },
      { label: "AC Gesamt", value: formatWatts(live.ac_total_power_w) },
      { label: "Letzte Daten", value: formatTimestamp(growatt.captured_at_local || growatt.captured_at) }
    ], [
      { label: pvPower > 0 ? "PV liefert" : "Keine PV-Leistung", tone: pvPower > 0 ? "ok" : "neutral" }
    ]),
    overviewCard("Batterie", formatPercent(batterySoc), [
      { label: "Batterieleistung", value: formatWatts(batteryPower) },
      { label: "Laden", value: formatWatts(battery.charge_power_w) },
      { label: "Entladen", value: formatWatts(battery.discharge_power_w) }
    ], [
      { label: battery.flow_state || "Kein Flow-State", tone: battery.flow_state ? "ok" : "neutral" }
    ]),
    overviewCard("Netz", formatWatts(gridImport || gridExport || 0), [
      { label: "Import", value: formatWatts(gridImport) },
      { label: "Export", value: formatWatts(gridExport) },
      { label: "Regelgrenze", value: `${formatNumber(data.settings.rules.maxGridImportWatts, 0)} W` }
    ], [
      { label: (gridImport || 0) > 0 ? "Netzbezug" : (gridExport || 0) > 0 ? "Einspeisung" : "Nahe Null", tone: (gridImport || 0) > 0 ? "warn" : "ok" }
    ]),
    overviewCard("Wallbox", formatWatts(easee.totalPowerWatts), [
      { label: "Ausgangsstrom", value: typeof easee.outputCurrentAmp === "number" ? `${formatNumber(easee.outputCurrentAmp, 1)} A` : "-" },
      { label: "Dynamischer Strom", value: typeof easee.dynamicChargerCurrentAmp === "number" ? `${formatNumber(easee.dynamicChargerCurrentAmp, 1)} A` : "-" },
      { label: "Session", value: formatKwh(easee.sessionEnergyKwh) }
    ], [
      { label: easee.online ? "Online" : "Offline", tone: easee.online ? "ok" : "bad" },
      { label: data.settings.easee.chargerEnabled ? "Freigegeben" : "Deaktiviert", tone: data.settings.easee.chargerEnabled ? "ok" : "bad" },
      { label: easee.charging ? "Lädt" : "Lädt nicht", tone: easee.charging ? "ok" : "neutral" }
    ]),
    overviewCard("MG Fahrzeug", formatPercent(mgStatus.socPercent), [
      { label: "Reichweite", value: typeof mgStatus.rangeKm === "number" ? `${formatNumber(mgStatus.rangeKm, 1)} km` : "-" },
      { label: "Ziel-SOC", value: formatPercent(data.settings.rules.targetVehicleSocPercent) },
      { label: "Letzter Status", value: formatMgTimestamp(mgStatus.updatedAt) }
    ], [
      { label: data.settings.mg.enabled ? "MG aktiv" : "MG inaktiv", tone: data.settings.mg.enabled ? "ok" : "neutral" },
      { label: mgStatus.isCharging ? "Fahrzeug lädt" : "Fahrzeug lädt nicht", tone: mgStatus.isCharging ? "ok" : "neutral" },
      { label: data.mg?.error ? "MG Fehler" : "Status bereit", tone: data.mg?.error ? "bad" : mgStatus.socPercent == null ? "warn" : "ok" }
    ])
  ].join("");

  document.getElementById("decision-reason").textContent = decision.reason || "-";
  document.getElementById("decision-notes").innerHTML = (decision.notes || ["Keine Hinweise."])
    .map((note) => `<div class="overview-row"><span>${note}</span></div>`)
    .join("");
  document.getElementById("decision-badges").innerHTML = [
    { label: decision.shouldCharge ? "Soll laden" : "Soll nicht laden", tone: decision.shouldCharge ? "ok" : "warn" },
    { label: decision.guardActive ? "Schutz aktiv" : "Schutz frei", tone: decision.guardActive ? "warn" : "ok" },
    { label: decision.suggestedAmps == null ? "Kein Stromvorschlag" : `${decision.suggestedAmps} A`, tone: "neutral" }
  ].map((badge) => `<span class="badge ${badge.tone}">${badge.label}</span>`).join("");

  document.getElementById("automation-state").textContent = automation.state || "-";
  document.getElementById("automation-last-action").textContent = automation.lastAction || "-";
  document.getElementById("automation-hold-until").textContent = formatTimestamp(automation.holdUntil);
  document.getElementById("automation-last-evaluated").textContent = formatTimestamp(automation.lastEvaluatedAt);
  document.getElementById("automation-badges").innerHTML = [
    { label: automation.running ? "Automatik-Loop aktiv" : "Automatik-Loop gestoppt", tone: automation.running ? "ok" : "warn" },
    { label: automation.shouldCharge == null ? "Noch keine Soll-Entscheidung" : automation.shouldCharge ? "Soll laden" : "Soll pausieren", tone: automation.shouldCharge ? "ok" : "neutral" },
    { label: automation.desiredAmps == null ? "Kein Zielstrom" : `Zielstrom ${automation.desiredAmps} A`, tone: "neutral" },
    { label: automation.desiredPhaseMode ? `Zielphase ${automation.desiredPhaseMode}` : "Keine Zielphase", tone: "neutral" },
    { label: automation.lastError ? `Letzter Fehler: ${automation.lastError}` : "Kein Automatikfehler", tone: automation.lastError ? "bad" : "ok" }
  ].map((badge) => `<span class="badge ${badge.tone}">${badge.label}</span>`).join("");
}

function renderManualCharge(data) {
  const override = data.settings?.rules?.manualOverrideEnabled;
  const amps = data.settings?.rules?.manualOverrideAmps;
  const targetSoc = data.settings?.rules?.targetVehicleSocPercent;
  if (override) {
    const kw = amps ? (amps * 230 * 3 / 1000).toFixed(1) : "-";
    setFeedback(
      "manual-charge-feedback",
      "busy",
      `Manuelles Laden aktiv: ${amps} A · ${kw} kW · Ziel ${targetSoc} % Fahrzeug-SOC.`
    );
  }
}

async function saveSettings() {
  const current = await api("/api/settings");
  current.growatt.loggerBaseUrl = "http://127.0.0.1:5001";
  current.growatt.inverterHost = document.getElementById("growatt-host").value.trim();
  current.growatt.inverterPort = Number(document.getElementById("growatt-port").value);
  current.growatt.unitId = Number(document.getElementById("growatt-unit-id").value);
  current.growatt.pollIntervalSeconds = Number(document.getElementById("growatt-poll-interval").value);
  current.easee.chargerId = document.getElementById("easee-charger-id").value.trim();
  current.easee.pollIntervalSeconds = Number(document.getElementById("easee-poll-interval").value);
  current.easee.safeMode = document.getElementById("easee-safe-mode").value === "true";
  current.easee.chargerEnabled = current.easee.chargerEnabled !== false;
  current.rules.enabled = document.getElementById("rules-enabled").value === "true";
  current.rules.mode = document.getElementById("rules-mode").value;
  current.rules.phaseMode = document.getElementById("rules-phase-mode").value;
  current.rules.targetVehicleSocPercent = document.getElementById("rules-target-vehicle-soc").value === "" ? null : Number(document.getElementById("rules-target-vehicle-soc").value);
  current.rules.minSocPercent = Number(document.getElementById("rules-min-soc").value);
  current.rules.maxBatteryDischargeWatts = Number(document.getElementById("rules-max-battery-discharge").value);
  current.rules.maxGridImportWatts = Number(document.getElementById("rules-max-grid-import").value);
  current.rules.maxChargePowerWatts = Number(document.getElementById("rules-max-charge-power").value);
  current.rules.minAmps = Number(document.getElementById("rules-min-amps").value);
  current.rules.maxAmps = Number(document.getElementById("rules-max-amps").value);
  current.rules.upStepAmps = Number(document.getElementById("rules-up-step-amps").value);
  current.rules.downStepAmps = Number(document.getElementById("rules-down-step-amps").value);
  current.rules.regulationIntervalSeconds = Number(document.getElementById("rules-regulation-interval").value);
  current.rules.holdSecondsAfterAdjustment = Number(document.getElementById("rules-hold-seconds").value);
  current.rules.manualOverrideEnabled = document.getElementById("rules-manual-override-enabled").value === "true";
  current.rules.manualOverrideAmps = Number(document.getElementById("rules-manual-override-amps").value);
  current.location = {
    lat: Number(document.getElementById("location-lat").value),
    lon: Number(document.getElementById("location-lon").value)
  };
  current.weather = {
    enabled: document.getElementById("weather-enabled").value === "true",
    targetBatterySocAtSunsetPercent: Number(document.getElementById("weather-target-soc").value),
    sunsetPreloadWindowMinutes: Number(document.getElementById("weather-preload-window").value)
  };
  current.mg = {
    enabled: document.getElementById("mg-enabled").value === "true",
    apiBaseUrl: document.getElementById("mg-api-base-url").value.trim() || "http://127.0.0.1:5002",
    username: document.getElementById("mg-username").value.trim(),
    password: document.getElementById("mg-password").value || current.mg?.password || "",
    vehicleId: document.getElementById("mg-vehicle-id").value.trim()
  };
  const result = await api("/api/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(current)
  });
  setOutput(result);
  scheduleDashboardRefresh(result.settings);
  await refreshDashboard();
}

async function refreshDashboard() {
  const data = await api("/api/dashboard");
  renderStatus(data.status, data.settings);
  renderOverview(data);
  renderWeather(data);
  renderMgSummary(data);
  renderEaseeSummary(data);
  renderDiagnostics(data);
  renderManualCharge(data);
  applyLanguageToDocument();
  return data;
}

function resolveDashboardRefreshInterval(settings) {
  const growattSeconds = Number(settings?.growatt?.pollIntervalSeconds);
  const easeeSeconds = Number(settings?.easee?.pollIntervalSeconds);
  const candidates = [growattSeconds, easeeSeconds].filter((value) => Number.isFinite(value) && value > 0);
  const intervalSeconds = candidates.length ? Math.min(...candidates) : 15;
  return Math.max(5, intervalSeconds) * 1000;
}

function scheduleDashboardRefresh(settings) {
  if (dashboardRefreshTimer) {
    window.clearInterval(dashboardRefreshTimer);
  }

  const intervalMs = resolveDashboardRefreshInterval(settings);
  dashboardRefreshTimer = window.setInterval(() => {
    refreshDashboard().catch((error) => {
      setOutput({ message: error instanceof Error ? error.message : String(error) });
    });
  }, intervalMs);
}

async function discoverEaseeChargers() {
  const payload = await api("/api/integrations/easee/chargers");
  if (payload.selectedChargerId) {
    document.getElementById("easee-charger-id").value = payload.selectedChargerId;
  }

  if (!payload.chargers.length) {
    setOutput({ message: "Keine Charger im Easee-Account gefunden." });
    return;
  }

  if (!payload.selectedChargerId && payload.chargers.length === 1) {
    const chargerId = payload.chargers[0].id;
    await api("/api/integrations/easee/select-charger", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chargerId })
    });
    document.getElementById("easee-charger-id").value = chargerId;
    setOutput({ success: true, chargerId, message: "Charger automatisch ausgewählt." });
    await refreshDashboard();
    return;
  }

  setOutput(payload);
}

async function runEaseeCommand(payload, message) {
  setFeedback("easee-action-feedback", "busy", "Befehl wird an die Wallbox gesendet...");
  const response = await api("/api/easee/command", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  setOutput({ ...response, message });
  setFeedback("easee-action-feedback", "ok", `${message} Live-Daten folgen mit dem nächsten Poll.`);
}

async function toggleChargerEnabled() {
  const settings = await api("/api/settings");
  const nextEnabled = !settings.easee.chargerEnabled;
  const response = await api("/api/charger/enabled", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enabled: nextEnabled })
  });
  setOutput({
    success: true,
    chargerEnabled: response.chargerEnabled,
    message: response.chargerEnabled ? "Charger wurde aktiviert." : "Charger wurde deaktiviert."
  });
  await refreshDashboard();
}

function bindAction(id, action) {
  const element = document.getElementById(id);
  element.addEventListener("click", async () => {
    element.disabled = true;
    try {
      await action();
    } catch (error) {
      setOutput({ message: error instanceof Error ? error.message : String(error) });
    } finally {
      element.disabled = false;
    }
  });
}

function bindActionGroup(ids, action, options = {}) {
  const buttons = ids.map((id) => document.getElementById(id));
  const busyMessage = options.busyMessage || "Aktion wird ausgeführt...";
  const feedbackId = options.feedbackId || null;

  for (const button of buttons) {
    button.addEventListener("click", async () => {
      if (buttons.some((entry) => entry.disabled)) {
        return;
      }

      for (const entry of buttons) {
        entry.disabled = true;
      }

      const row = button.closest(".button-row");
      if (row) {
        row.classList.add("busy");
      }

      if (feedbackId) {
        setFeedback(feedbackId, "busy", busyMessage);
      }

      try {
        await action(button.id);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setOutput({ message });
        if (feedbackId) {
          setFeedback(feedbackId, "error", message);
        }
      } finally {
        for (const entry of buttons) {
          entry.disabled = false;
        }
        if (row) {
          row.classList.remove("busy");
        }
      }
    });
  }
}

bindAction("load-settings", async () => setOutput(await loadSettings()));
bindAction("save-settings", async () => saveSettings());
bindAction("save-rules-settings", async () => saveSettings());
bindAction("save-weather-settings", async () => saveSettings());
bindAction("save-mg-settings", async () => saveSettings());

function updateManualChargePreview() {
  const amps = Number(document.getElementById("manual-charge-amps").value);
  const kw = (amps * 230 * 3 / 1000).toFixed(1);
  document.getElementById("manual-charge-kw").textContent = `${kw} kW`;
}
document.getElementById("manual-charge-amps").addEventListener("input", updateManualChargePreview);
updateManualChargePreview();

bindActionGroup(
  ["manual-charge-start", "manual-charge-stop"],
  async (buttonId) => {
    if (buttonId === "manual-charge-start") {
      const amps = Number(document.getElementById("manual-charge-amps").value);
      const targetSocPercent = Number(document.getElementById("manual-charge-soc").value);
      await api("/api/control/manual-charge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amps, targetSocPercent })
      });
      const kw = (amps * 230 * 3 / 1000).toFixed(1);
      setFeedback("manual-charge-feedback", "busy", `Manuelles Laden aktiv: ${amps} A · ${kw} kW · Ziel ${targetSocPercent} % Fahrzeug-SOC.`);
    } else {
      await api("/api/control/manual-charge/stop", { method: "POST" });
      setFeedback("manual-charge-feedback", "", "Manuelles Laden beendet.");
    }
    await refreshDashboard();
  },
  { feedbackId: "manual-charge-feedback", busyMessage: "Befehl wird übermittelt…" }
);
bindAction("refresh-status", async () => setOutput(await refreshDashboard()));
bindAction("toggle-automation", async () => {
  const settings = await api("/api/settings");
  await api("/api/automation/enabled", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enabled: !settings.rules.enabled })
  });
  await refreshDashboard();
});
bindAction("toggle-charger", async () => toggleChargerEnabled());
bindAction("start-polling", async () => {
  setOutput(await api("/api/polling/start", { method: "POST" }));
  await refreshDashboard();
});
bindAction("stop-polling", async () => {
  setOutput(await api("/api/polling/stop", { method: "POST" }));
  await refreshDashboard();
});
bindAction("save-easee-settings", async () => saveSettings());
bindAction("easee-auth", async () => {
  await saveSettings();
  const result = await api("/api/integrations/easee/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userName: document.getElementById("easee-user").value.trim(),
      password: document.getElementById("easee-password").value,
      safeMode: document.getElementById("easee-safe-mode").value === "true"
    })
  });
  if (result.selectedChargerId) {
    document.getElementById("easee-charger-id").value = result.selectedChargerId;
  }
  setPanelOutput("easee-login-output", result);
  setOutput(result);
  await refreshDashboard();
});
bindAction("easee-status", async () => {
  const result = await api("/api/integrations/easee/status");
  setPanelOutput("easee-login-output", result);
  setOutput(result);
});
bindAction("easee-discover", async () => discoverEaseeChargers());
bindAction("mg-auth", async () => {
  const current = await api("/api/settings");
  await saveSettings();
  const payload = {
    enabled: document.getElementById("mg-enabled").value === "true",
    apiBaseUrl: document.getElementById("mg-api-base-url").value.trim() || "http://127.0.0.1:5002",
    username: document.getElementById("mg-username").value.trim(),
    password: document.getElementById("mg-password").value || current.mg?.password || "",
    vehicleId: document.getElementById("mg-vehicle-id").value.trim()
  };
  const result = await api("/api/integrations/mg/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (result.vin) {
    document.getElementById("mg-vehicle-id").value = result.vin;
  }
  if (result.warning) {
    setFeedback("mg-feedback", "warn", result.warning);
  }
  setPanelOutput("mg-login-output", result);
  setOutput(result);
  await refreshDashboard();
});
bindAction("mg-status", async () => {
  const result = await api("/api/integrations/mg/status");
  setPanelOutput("mg-login-output", result);
  setOutput(result);
});
bindAction("growatt-test", async () => setOutput(await api("/api/integrations/growatt/test")));
bindAction("evaluate-control", async () => setOutput(await api("/api/control/evaluate", { method: "POST" })));
bindAction("evaluate-control-verbose", async () => setOutput(await api("/api/control/evaluate", { method: "POST" })));
bindAction("load-growatt-snapshots", async () => setOutput(await api("/api/snapshots?source=growatt&limit=10")));
bindAction("load-easee-snapshots", async () => setOutput(await api("/api/snapshots?source=easee&limit=10")));
bindAction("load-mg-status", async () => setOutput(await api("/api/integrations/mg/status")));
bindActionGroup(
  ["easee-start", "easee-pause", "easee-stop", "easee-set-current", "easee-set-phase"],
  async (buttonId) => {
    if (buttonId === "easee-start") {
      await runEaseeCommand({ type: "start" }, "Ladevorgang gestartet.");
      return;
    }
    if (buttonId === "easee-pause") {
      await runEaseeCommand({ type: "pause" }, "Ladevorgang pausiert.");
      return;
    }
    if (buttonId === "easee-stop") {
      await runEaseeCommand({ type: "stop" }, "Ladevorgang gestoppt.");
      return;
    }
    if (buttonId === "easee-set-current") {
      await runEaseeCommand({
        type: "setDynamicCurrent",
        amps: Number(document.getElementById("easee-amps").value),
        minutes: Number(document.getElementById("easee-minutes").value)
      }, "Dynamischer Ladestrom gesetzt.");
      return;
    }
    if (buttonId === "easee-set-phase") {
      await runEaseeCommand({
        type: "setPhaseMode",
        phaseMode: Number(document.getElementById("easee-phase-mode").value)
      }, "Phasenmodus gesetzt.");
    }
  },
  {
    feedbackId: "easee-action-feedback",
    busyMessage: "Wallbox-Befehl wird gesendet. Bitte nicht erneut klicken…"
  }
);

document.querySelectorAll(".history-range").forEach((btn) => {
  btn.addEventListener("click", async () => {
    document.querySelectorAll(".history-range").forEach((b) => b.classList.remove("active-range"));
    btn.classList.add("active-range");
    historyHours = Number(btn.dataset.hours);
    historyCustomRange = null;
    document.getElementById("history-chart").innerHTML = '<p class="muted" style="padding:.5rem">Lade…</p>';
    await loadHistory();
  });
});

document.querySelectorAll("[data-series-key]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const key = btn.dataset.seriesKey;
    historySeriesVisible[key] = !historySeriesVisible[key];
    applySeriesVisibility();
  });
});

bindAction("history-custom-load", async () => {
  const fromVal = document.getElementById("history-from").value;
  const toVal = document.getElementById("history-to").value;
  if (!fromVal || !toVal) { setOutput({ message: "Bitte Von- und Bis-Datum auswählen." }); return; }
  historyCustomRange = {
    from: new Date(fromVal).toISOString(),
    to: new Date(toVal).toISOString()
  };
  document.querySelectorAll(".history-range").forEach((b) => b.classList.remove("active-range"));
  document.getElementById("history-chart").innerHTML = '<p class="muted" style="padding:.5rem">Lade…</p>';
  await loadHistory();
});

async function bootstrap() {
  initNavigation();
  let settings = null;

  try {
    settings = await loadSettings();
  } catch (error) {
    setOutput({ message: error instanceof Error ? error.message : String(error) });
  }

  try {
    const data = await refreshDashboard();
    scheduleDashboardRefresh(data.settings || settings);
  } catch (error) {
    setOutput({ message: error instanceof Error ? error.message : String(error) });
    if (settings) {
      scheduleDashboardRefresh(settings);
    }
  }

  // History chart: load once on startup, then every 2 minutes
  await loadHistory().catch(() => {});
  setInterval(() => loadHistory().catch(() => {}), 2 * 60 * 1000);
}

void bootstrap();
