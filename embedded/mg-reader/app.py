"""
MG iSmart Reader — lokaler HTTP-Proxy für die SAIC iSmart EU Cloud API.
Verwendet saic-python-client-ng für ASN.1-Kodierung/Dekodierung.

Endpunkte:
  GET  /api/health           Liveness-Check
  POST /api/auth             Login mit Credentials
  GET  /api/vehicle/status   Aktueller Fahrzeugstatus (gecacht, TTL 5 min)
"""

import asyncio
import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Optional

from flask import Flask, jsonify, request
from waitress import serve

logging.basicConfig(level=logging.INFO, format="[mg-reader] %(levelname)s %(message)s")
log = logging.getLogger(__name__)

app = Flask(__name__)

# ---------------------------------------------------------------------------
# Globaler Zustand
# ---------------------------------------------------------------------------
_api = None          # SaicApi-Instanz nach erfolgreichem Login
_vin: str = ""       # aktives Fahrzeug-VIN / vehicleId
_cached: Optional[dict] = None
_cached_at: Optional[datetime] = None
_auth_error: Optional[str] = None
_auth_warning: Optional[str] = None
CACHE_TTL_SECONDS = int(os.environ.get("CACHE_TTL_SECONDS", "300"))


def run_async(coro):
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


def _safe(obj, *keys, default=None):
    for key in keys:
        obj = getattr(obj, key, None)
        if obj is None:
            return default
    return obj


def _range_to_km(raw_range) -> Optional[float]:
    if raw_range is None or raw_range <= 0 or raw_range >= 20460:
        return None
    return round(raw_range / 10.0, 1)


def _direct_range_km(raw_range) -> Optional[float]:
    if raw_range is None or raw_range <= 0 or raw_range >= 2046:
        return None
    return float(raw_range)


def _soc_percent(raw_soc, divisor=1.0) -> Optional[float]:
    if raw_soc is None:
        return None
    soc = float(raw_soc) / divisor
    if 0 <= soc <= 100:
        return soc
    return None


def _first_valid(*values):
    for value in values:
        if value is not None:
            return value
    return None


def _extract_status(vehicle_status, charging_status=None, charging_mgmt=None) -> dict:
    """Normalisiert die SAIC-Antworten auf ein einfaches Dict."""
    bvs = (
        getattr(vehicle_status, "basicVehicleStatus", None) or
        getattr(vehicle_status, "basic_vehicle_status", None)
    ) if vehicle_status else None

    ext = getattr(bvs, "extendedData", None) or getattr(bvs, "extended_data", None) or {}
    charge = getattr(charging_status, "chargingStatus", None) or getattr(charging_status, "charging_status", None)
    mgmt = getattr(charging_mgmt, "chrgMgmtData", None) or getattr(charging_mgmt, "chrg_mgmt_data", None)

    if bvs is None and charge is None and mgmt is None:
        raise ValueError("Keine verwertbaren Fahrzeugdaten in der API-Antwort")

    soc = _first_valid(
        _soc_percent(_safe(mgmt, "bmsPackSOCDsp"), divisor=10.0),
        _soc_percent(_safe(charge, "powerLevelPrc")),
        _soc_percent(_safe(bvs, "extendedData1")),
        _soc_percent(_safe(bvs, "extended_data1")),
        _soc_percent(_safe(ext, "soc")),
        _soc_percent(_safe(ext, "soc_percentage")),
        _soc_percent(_safe(ext, "socBms")),
        _soc_percent(_safe(bvs, "socBms")),
        _soc_percent(_safe(bvs, "soc_bms"))
    )

    # Reichweite aus der App-Anzeige: fuelRangeElec ist in 100m-Einheiten,
    # imcuVehElecRng ist bereits in km. bmsEstdElecRng weicht je nach Modell ab.
    range_km = _first_valid(
        _range_to_km(_safe(bvs, "fuelRangeElec")),
        _range_to_km(_safe(bvs, "fuel_range_elec")),
        _range_to_km(_safe(charge, "fuelRangeElec")),
        _direct_range_km(_safe(mgmt, "imcuVehElecRng")),
        _direct_range_km(_safe(mgmt, "clstrElecRngToEPT")),
        _direct_range_km(_safe(mgmt, "bmsEstdElecRng")),
    )

    is_charging = bool(
        _safe(mgmt, "is_bms_charging") or
        _safe(charge, "chargingState") in (1, 3, 10, 12) or
        _safe(bvs, "isChargingAc") or _safe(bvs, "is_charging_ac") or
        _safe(bvs, "isChargingDc") or _safe(bvs, "is_charging_dc") or
        _safe(bvs, "chargingStatus") in (1, 2)
    )

    return {
        "vin": _vin,
        "socPercent": soc,
        "isCharging": is_charging,
        "rangeKm": range_km,
        "updatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    }


def _vehicle_status_has_soc(vehicle_status) -> bool:
    if vehicle_status is None:
        return False
    bvs = (
        getattr(vehicle_status, "basicVehicleStatus", None) or
        getattr(vehicle_status, "basic_vehicle_status", None)
    )
    return _soc_percent(_safe(bvs, "extendedData1")) is not None


def _extract_vin(vehicle_list) -> str:
    """Liest die erste VIN aus unterschiedlichen saic-client Response-Formaten."""
    vins = getattr(vehicle_list, "vinList", []) or []
    if not vins:
        return ""

    first = vins[0]
    direct_vin = getattr(first, "vin", None)
    if direct_vin:
        return direct_vin

    wrapped = getattr(first, "vinInfo", None) or getattr(first, "vin_info", None)
    return getattr(wrapped, "vin", "") or ""


# ---------------------------------------------------------------------------
# Endpunkte
# ---------------------------------------------------------------------------

@app.get("/api/health")
def health():
    return jsonify({
        "status": "ok",
        "authenticated": _api is not None,
        "vinConfigured": bool(_vin),
    })


@app.post("/api/auth")
def auth():
    global _api, _vin, _cached, _cached_at, _auth_error, _auth_warning

    data = request.get_json(silent=True) or {}
    username = data.get("username", "").strip()
    password = data.get("password", "").strip()
    vin = data.get("vehicleId", "").strip()

    if not username or not password:
        return jsonify({"success": False, "error": "username und password erforderlich"}), 400

    try:
        from saic_ismart_client_ng import SaicApi
        from saic_ismart_client_ng.model import SaicApiConfiguration

        config = SaicApiConfiguration(
            username=username,
            password=password,
            region="eu",
        )
        api = SaicApi(config)
        run_async(api.login())

        warning = None

        # Fahrzeugliste - falls kein VIN angegeben, erstes Fahrzeug nehmen.
        # Manche MG/SAIC Accounts liefern hier sporadisch 500; der Login selbst
        # bleibt dann gueltig und kann mit manuell hinterlegter VIN genutzt werden.
        if not vin:
            try:
                vehicle_list = run_async(api.vehicle_list())
                vin = _extract_vin(vehicle_list)
            except Exception as exc:
                warning = f"Login erfolgreich, Fahrzeugliste konnte nicht geladen werden: {exc}"

        if not vin:
            warning = warning or "Login erfolgreich, aber keine VIN gefunden. Bitte VIN manuell eintragen."

        _api = api
        _vin = vin
        _cached = None
        _cached_at = None
        _auth_error = None
        _auth_warning = warning
        log.info("Login erfolgreich, VIN=%s", vin or "-")
        return jsonify({"success": True, "vin": vin, "warning": warning})

    except Exception as exc:
        _api = None
        _auth_error = str(exc)
        _auth_warning = None
        log.error("Login fehlgeschlagen: %s", exc)
        return jsonify({"success": False, "error": str(exc)}), 400


@app.get("/api/vehicle/status")
def vehicle_status():
    global _cached, _cached_at

    if _api is None:
        return jsonify({
            "configured": False,
            "error": _auth_error or "Noch nicht angemeldet"
        }), 503

    if not _vin:
        return jsonify({
            "configured": False,
            "error": _auth_warning or "Keine VIN konfiguriert. Bitte Fahrzeug-ID/VIN eintragen."
        }), 400

    now = datetime.now()
    cache_stale = _cached_at is None or (now - _cached_at).total_seconds() > CACHE_TTL_SECONDS

    if cache_stale:
        try:
            vehicle_status = None
            charging_status = None
            charging_mgmt = None
            fetch_warnings = []

            try:
                vehicle_status = run_async(_api.get_vehicle_status(_vin))
            except Exception as exc:
                fetch_warnings.append(f"Vehicle-Status nicht geladen: {exc}")

            if not _vehicle_status_has_soc(vehicle_status):
                try:
                    charging_mgmt = run_async(_api.get_vehicle_charging_management_data(_vin))
                except Exception as exc:
                    fetch_warnings.append(f"Charging-Management nicht geladen: {exc}")

                if charging_mgmt is None:
                    try:
                        charging_status = run_async(_api.get_vehicle_charging_status(_vin))
                    except Exception as exc:
                        fetch_warnings.append(f"Charging-Status nicht geladen: {exc}")

            _cached = _extract_status(vehicle_status, charging_status, charging_mgmt)
            if fetch_warnings:
                _cached["fetchWarnings"] = fetch_warnings
            _cached_at = now
            log.info("Status geladen: SOC=%s%%", _cached.get("socPercent"))
        except Exception as exc:
            log.error("Status-Abruf fehlgeschlagen: %s", exc)
            if _cached:
                # Letzten Cache zurückgeben, aber Fehler markieren
                return jsonify({"configured": True, "status": _cached, "fetchError": str(exc)})
            return jsonify({"configured": True, "error": str(exc)}), 500

    return jsonify({"configured": True, "status": _cached})


# ---------------------------------------------------------------------------
# Start
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    host = os.environ.get("APP_HOST", "127.0.0.1")
    port = int(os.environ.get("APP_PORT", "5002"))
    log.info("MG-Reader startet auf http://%s:%s", host, port)
    serve(app, host=host, port=port)
