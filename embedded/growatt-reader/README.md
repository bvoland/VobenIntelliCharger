# Growatt Inverter Reader

Kleiner Python-Webserver fuer den Growatt-Wechselrichter hinter einem
`usr-dr302` Serial Device Server. Im Hauptprojekt wird dieser Reader
automatisch vom Node-Prozess gestartet und ueber `http://127.0.0.1:5001`
angesprochen.

## Funktionen

- Weboberflaeche fuer Verbindungstest und Diagnose
- Zieladresse per Umgebung oder ueber die Haupt-App konfigurierbar
- API-Endpoint fuer automatisierte Probe des Serial Device Servers
- Modbus-Diagnose fuer Register-Lesezugriffe ueber den DR302
- Live-Overview fuer PV-, Batterie-, Netz- und Leistungswerte
- Logger mit lokaler SQLite-Historie
- Job-Endpoints fuer Modbus-Read, Unit-ID-Scan und Register-Discovery
- Konfiguration ueber Umgebungsvariablen

## Start

1. Abhaengigkeiten installieren:

   ```powershell
   pip install -r requirements.txt
   ```

2. Optional Zieladresse anpassen:

   ```powershell
   $env:SERIAL_SERVER_HOST="192.168.0.143"
   $env:SERIAL_SERVER_PORT="8899"
   $env:SERIAL_SERVER_TIMEOUT="3.0"
   $env:MODBUS_UNIT_ID="1"
   ```

3. Webserver starten:

   ```powershell
   python app.py
   ```

4. Im Browser oeffnen:

   `http://127.0.0.1:5000`

Im Hauptprojekt wird der Reader automatisch auf Port `5001` gestartet. Ein
separater Start ist dort normalerweise nicht noetig.

## API

- `GET /api/health`
- `GET /api/serial-server/probe`
- `GET /api/modbus/read`
- `GET /api/modbus/scan`
- `GET /api/modbus/discovery`
- `GET /api/growatt/overview`
- `GET /api/growatt/register-explorer`
- `GET /api/logger/status`
- `POST /api/logger/start`
- `POST /api/logger/stop`
- `POST /api/logger/config`
- `GET /api/logger/recent`
- `GET /api/logger/history`
- `POST /api/jobs/modbus-read`
- `POST /api/jobs/modbus-scan`
- `POST /api/jobs/discovery`
- `GET /api/jobs/<job_id>`
- `POST /api/jobs/<job_id>/stop`

## Dokumentation

- [REGISTER_NOTES.md](REGISTER_NOTES.md)
  enthaelt die aktuell verifizierten und vermuteten Registerzuordnungen
  inklusive Beobachtungen zu Batterie-, Netz- und Leistungswerten.

## Hinweise

- Der Hauptcontroller speichert die vom Reader gelieferten Overview-Daten in der lokalen SQLite-Datenbank.
- Wenn der Reader im Hauptprojekt eingebettet laeuft, zeigt `DATABASE_PATH` auf `data/growatt-reader.db`.
