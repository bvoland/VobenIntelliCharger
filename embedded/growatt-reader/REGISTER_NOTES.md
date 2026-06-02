# Register Notes

Diese Datei ist die zentrale Arbeitsliste fuer bekannte und noch
unbekannte Register des Growatt `MID 25KTL3-XH` am `USR-DR302`.

Ziel:

- bekannte Register mit aktueller Dekodierung dokumentieren
- unbekannte, aber belegte Register mit Beispielwerten festhalten
- Beobachtungen zu Lade-, Entlade- und Zero-Export-Faellen nachhalten

## Status

- Gateway: `192.168.0.143:8899`
- `Unit-ID 1`
- Snapshot-Logging aktiv
- letzte Auswertung dieser Datei basiert auf einem aktuellen Logger-Snapshot
  vom `2026-05-21 09:25:34` sowie den direkt davor liegenden Snapshots

## Legende

- `u16 / 10` bedeutet: 16-Bit unsigned, dann durch `10` teilen
- `u32 / 10` bedeutet: 32-Bit unsigned aus zwei Registern, dann durch `10`
- `s16 / 10` bedeutet: 16-Bit signed, dann durch `10`
- `s32 / 10` bedeutet: 32-Bit signed aus zwei Registern, dann durch `10`
- `Kandidat` bedeutet: plausibel, aber noch nicht endgueltig bestaetigt

## Bekannte Input Register

### Grundstatus und PV

| Adresse | Breite | Name | Dekodierung | Status |
| --- | --- | --- | --- | --- |
| `0` | `1` | Inverter-Status | `u16` | verifiziert |
| `1-2` | `2` | PV-Gesamtleistung | `u32 / 10` | verifiziert |
| `3` | `1` | PV1 Spannung | `u16 / 10` | verifiziert |
| `4` | `1` | PV1 Strom | `u16 / 10` | verifiziert |
| `5-6` | `2` | PV1 Leistung | `u32 / 10` | verifiziert |
| `7` | `1` | PV2 Spannung | `u16 / 10` | verifiziert |
| `8` | `1` | PV2 Strom | `u16 / 10` | verifiziert |
| `9-10` | `2` | PV2 Leistung | `u32 / 10` | verifiziert |
| `11` | `1` | PV3 Spannung | `u16 / 10` | verifiziert |
| `12` | `1` | PV3 Strom | `u16 / 10` | verifiziert |
| `13-14` | `2` | PV3 Leistung | `u32 / 10` | verifiziert |
| `15-34` | variabel | PV4-PV8 Felder | derzeit meist `0` | bekannt, ungenutzt |

### AC, Netz und Energie

| Adresse | Breite | Name | Dekodierung | Status |
| --- | --- | --- | --- | --- |
| `35-36` | `2` | AC-Gesamtleistung | `u32 / 10` | verifiziert |
| `37` | `1` | Netzfrequenz | `u16 / 100` | verifiziert |
| `38` | `1` | Phase 1 Spannung | `u16 / 10` | verifiziert |
| `39` | `1` | Phase 1 Strom | `u16 / 10` | verifiziert |
| `40-41` | `2` | Phase 1 Leistung | `u32 / 10` | verifiziert |
| `42` | `1` | Phase 2 Spannung | `u16 / 10` | verifiziert |
| `43` | `1` | Phase 2 Strom | `u16 / 10` | verifiziert |
| `44-45` | `2` | Phase 2 Leistung | `u32 / 10` | verifiziert |
| `46` | `1` | Phase 3 Spannung | `u16 / 10` | verifiziert |
| `47` | `1` | Phase 3 Strom | `u16 / 10` | verifiziert |
| `48-49` | `2` | Phase 3 Leistung | `u32 / 10` | verifiziert |
| `50` | `1` | Leiterspannung `RS` | `u16 / 10` | verifiziert |
| `51` | `1` | Leiterspannung `ST` | `u16 / 10` | verifiziert |
| `52` | `1` | Leiterspannung `TR` | `u16 / 10` | verifiziert |
| `53-54` | `2` | Tagesertrag | `u32 / 10` | verifiziert |
| `55-56` | `2` | Gesamtertrag | `u32 / 10` | verifiziert |
| `57-58` | `2` | Laufzeit gesamt | `u32 / 2` | Kandidat, plausibel |
| `59-60` | `2` | PV1 Tagesertrag | `u32 / 10` | Kandidat, plausibel |
| `61-62` | `2` | PV1 Gesamtertrag | `u32 / 10` | Kandidat, plausibel |
| `63-64` | `2` | PV2 Tagesertrag | `u32 / 10` | Kandidat, plausibel |
| `65-66` | `2` | PV2 Gesamtertrag | `u32 / 10` | Kandidat, plausibel |
| `67-68` | `2` | PV3 Tagesertrag | `u32 / 10` | Kandidat, plausibel |
| `69-70` | `2` | PV3 Gesamtertrag | `u32 / 10` | Kandidat, plausibel |

### Temperaturen und Laufzeit-/Limitfelder

| Adresse | Breite | Name | Dekodierung | Status |
| --- | --- | --- | --- | --- |
| `92` | `2` | Fault-/Statuscode-Kandidat | `u32` | unsicher |
| `93` | `1` | Temperatur | `u16 / 10` | plausibel |
| `94` | `1` | IPM-Temperatur | `u16 / 10` | plausibel |
| `95` | `1` | Boost-Temperatur | `u16 / 10` | plausibel |
| `96` | `1` | P-Bus-Spannung-Kandidat | `u16 / 10` | unsicher |
| `97` | `1` | N-Bus-Spannung-Kandidat | `u16 / 10` | unsicher |
| `98` | `1` | Bus-Spannung-Kandidat | `u16 / 10` | unsicher |
| `100` | `1` | `real_output_percent` | `u16 / 100` | Kandidat |
| `102-103` | `2` | Laufzeit-Leistungsgrenze | `u32 / 10` | Kandidat |
| `104` | `1` | Derating-Mode-Kandidat | `u16` | unsicher |
| `113` | `1` | Safety Country | `u16` | Kandidat |
| `114` | `1` | Work Mode | `u16` | Kandidat |

## Bekannte Holding Register

| Adresse | Breite | Name | Dekodierung | Status |
| --- | --- | --- | --- | --- |
| `3` | `1` | `Active P Rate` | `%` | verifiziert |
| `6-7` | `2` | Nennleistung | `u32 / 10` | verifiziert |
| `22` | `1` | Modbus Baudrate | `u16` | Kandidat |
| `23` | `1` | Protokollversion | `u16` | Kandidat |

## Bekannte Batterie-/Hybrid-Register

Diese Register kommen aus den zusaetzlich gelesenen hohen Input-Adressen.

| Adresse | Breite | Name | Dekodierung | Status |
| --- | --- | --- | --- | --- |
| `3166` | `1` | Battery Priority / Hybrid-Mode-Kandidat | `u16` | unsicher |
| `3171` | `1` | BMS SoC | `%` | plausibel |
| `3172` | `1` | Batterie-Spannung | `u16 / 10` | plausibel |
| `3173` | `1` | Batterie-Strom | `s16 / 10` | Kandidat |
| `3178-3179` | `2` | Batterie-Entladeleistung | sehr wahrscheinlich `u32 / 10` oder `s32 / 10` | starker Kandidat |
| `3180-3181` | `2` | Batterie-Ladeleistung | sehr wahrscheinlich `u32 / 10` oder `s32 / 10` | starker Kandidat |
| `3182-3183` | `2` | weiterer Entlade-/Hybrid-Kandidat | `s32 / 10` | bisher nicht bestaetigt |
| `3184-3185` | `2` | Grid-to-Load-Kandidat | `s32 / 10` | bisher nicht bestaetigt |
| `3212` | `1` | BMS-Status | `u16` | plausibel |

## Aktuelle Skalenannahmen

Diese Register lassen sich inzwischen nicht nur qualitativ, sondern auch
quantitativ einordnen:

- `3178-3179`
  - staerkster Kandidat fuer Batterie-Entladeleistung
  - beobachtete Werte:
    - `51600 -> 5160.0 W` im klaren Entladefall
    - `50 -> 5.0 W` direkt am Voll-Lade-Uebergang
  - aktuelle Arbeitsannahme: Leistungswert mit Skala `/ 10`
- `3180-3181`
  - staerkster Kandidat fuer Batterie-Ladeleistung
  - beobachtete Werte:
    - `38500 -> 3850.0 W` im Ladefall
    - `1650 -> 165.0 W` kurz vor `SOC 100 %`
    - `0 -> 0.0 W` direkt bei voll
  - aktuelle Arbeitsannahme: Leistungswert mit Skala `/ 10`
- `3166`
  - bisher nur `257` und `513`
  - in Hex: `0x0101` und `0x0201`
  - aktuelle Arbeitsannahme: Statuswort / Bitmaske, kein Prozentwert
- `3212`
  - bisher nur `1` und `4`
  - aktuelle Arbeitsannahme: BMS-/Freigabestatus, kein Prozentwert
- `201-203`
  - bisher keine belastbare physikalische Skala
  - Wertebereiche im ausgewerteten Fenster:
    - `201: 0..633`
    - `202: 0..471`
    - `203: 0..892`
  - aktuelle Arbeitsannahme: interne Freigabe-/Abregelungs- oder
    Leistungszustandswerte
- `231`
  - moeglicher Leistungskandidat
  - Beispiele:
    - `18481` koennte als `/ 10` etwa `1848.1 W` bedeuten
    - das liegt nahe an AC-/Lastwerten im selben Zeitraum
  - Mehrfachvergleich mit Logger-Daten:
    - bei `Battery idle` starke Korrelation zu `PV` und `AC`
    - bei `Battery discharging` sehr starke Korrelation zu `AC`
  - aktuelle Arbeitsannahme:
    `231 / 10` ist ein leistungsnaher interner Soll-/Freigabe- oder
    Output-Wert
- `233`
  - korreliert sichtbar mit dem Betriebszustand
  - Skala weiterhin offen

## Mehrfeldvergleich fuer Register 231

Ausgewertetes Fenster:

- Snapshots `723-832`
- Zeitraum `2026-05-21 13:07` bis `13:18` lokal

Korrelationen fuer `231 / 10`:

- im Zustand `Battery idle`:
  - zu `PV`: `r = 0.8733`
  - zu `AC`: `r = 0.8468`
- im Zustand `Battery discharging`:
  - zu `AC`: `r = 0.9911`
  - zu `PV`: nur `r = -0.1935`

Beispiele im Zustand `Battery idle`:

- `12897 -> 1289.7 W` bei `PV 1274.3 W`, `AC 1287.5 W`
- `15126 -> 1512.6 W` bei `PV 1501.5 W`, `AC 1508.2 W`
- `17171 -> 1717.1 W` bei `PV 1726.3 W`, `AC 1714.5 W`
- `15813 -> 1581.3 W` bei `PV 1576.3 W`, `AC 1580.7 W`

Beispiele im Zustand `Battery discharging`:

- `29518 -> 2951.8 W` bei `PV 7354.0 W`, `AC 9585.2 W`
- `43190 -> 4319.0 W` bei `PV 8841.0 W`, `AC 10872.1 W`
- `41438 -> 4143.8 W` bei `PV 8049.8 W`, `AC 10697.2 W`

Interpretation:

- `231 / 10` ist im einfachen Zustand `Batterie voll + idle` fast
  deckungsgleich mit der aktuell freigegebenen bzw. abgegebenen Leistung
- bei aktiver Batterie bleibt der Wert klar leistungsnah, ist aber nicht
  einfach identisch zu `PV` oder `AC`
- aktueller Status:
  starker Kandidat fuer einen internen Leistungs-Sollwert oder
  Freigabewert, aber kein klarer Prozentwert

## Beobachtungen bei anderen Herstellern

Online-Vergleich mit Dokumentation anderer Hersteller, insbesondere aus
asiatischen Maerkten:

- Solis dokumentiert die Wirkleistungsbegrenzung explizit als
  Prozentwert bezogen auf die Nennleistung:
  `desired active power limit / nominal power`
  Quelle:
  [Solis - Control Maximum Active Power Generation](https://solis-service.solisinverters.com/en/support/solutions/articles/44002032572-control-maximum-active-power-generation)
- GoodWe beschreibt ebenfalls eine `Export Power Limit`-Loesung mit
  konfigurierbarem Grenzwert `zero or designated value`, also ebenfalls
  eher als Sollwert-/Grenzkonzept und nicht zwingend als einzelnes
  Runtime-Prozentregister.
  Quelle:
  [GoodWe Export Power Limit Solution](https://pl.goodwe.com/export-power-limit-solution)
- Deye stellt auf der offiziellen Download-Seite zahlreiche Handbuecher
  fuer String- und Hybridwechselrichter bereit; die oeffentliche
  Registerdokumentation ist dort aber weniger direkt auffindbar.
  Quelle:
  [Deye Product Manuals](https://pl.deyeinverter.com/download/product-manual/)

Arbeitsfazit aus dem Vergleich:

- Es ist herstelleruebergreifend plausibel, dass
  - ein konfigurierter Prozent-/Leistungsgrenzwert existiert
  - und daneben ein interner laufender Leistungs-Sollwert oder
    Freigabewert verwendet wird
- Unser Growatt `231` passt fachlich eher in die zweite Kategorie:
  kein offensichtlicher Prozentwert, sondern eine leistungsnahe
  Runtime-Groesse

## Beobachteter Entladefall

Klarer Entladefall aus den letzten Logger-Snapshots:

- Beispiel Snapshot `238`
- Zeit: `2026-05-21 09:23:31`
- `PV gesamt = 3450.9 W`
- `AC gesamt = 8344.9 W`
- `Battery power = 5160.0 W`
- `SOC = 94 %`

Rohregister:

- `3171 = 94`
- `3172 = 6168`
- `3173 = 3073`
- `3178 = 0`
- `3179 = 51600`
- `3212 = 2`

Aktuelle Arbeitsannahme:

- `3178-3179` ist sehr wahrscheinlich die Batterie-Leistung
- im bestaetigten Entladefall ist der dekodierte Wert positiv
- aktuelle Richtung daher:
  `positiv = Entladung`, `negativ = Ladung`

## Beobachteter Ladefall

Pause der Auto-Ladung, Growatt-App-Screenshot lokale Zeit etwa
`2026-05-21 11:29`:

- `Ppv = 3.97 kW`
- `SOC = 90 %`
- `Charging Power = 3.63 kW`
- `Load power = 0.34 kW`
- `Export to Grid = 0 kW`
- Betriebsart: `On-Grid mode (Load First)`

Plausibilitaet:

- `3.97 kW PV - 0.34 kW Load = 3.63 kW`
- das passt exakt zur in der App angezeigten Ladeleistung

Passender Logger-Snapshot direkt danach:

- Snapshot `244`
- Zeit: `2026-05-21 09:29:40` UTC in der Datenbank
- `PV gesamt = 4157.9 W`
- `AC gesamt = 91.4 W`
- `SOC = 90 %`
- bisheriger Entlade-Kandidat `3178-3179 = 0`

Rohregister:

- `3166 = 257`
- `3171 = 90`
- `3172 = 6299`
- `3173 = 3156`
- `3178 = 0`
- `3179 = 0`
- `3180 = 0`
- `3181 = 38500`
- `3212 = 1`

Interpretation:

- `3178-3179` scheint im Ladefall nicht negativ zu werden, sondern faellt
  auf `0`
- `3180-3181` wird gleichzeitig deutlich aktiv und ist damit der aktuell
  staerkste Kandidat fuer `Charging Power`
- `3181 = 38500` entspricht als `u32 / 10` bzw. `s32 / 10` etwa
  `3850.0 W` und liegt damit nahe am App-Wert `3.63 kW`
- die Abweichung ist plausibel durch leicht unterschiedlichen
  Messzeitpunkt zwischen App und Logger

## Voll-Lade-Uebergang

Sauberster beobachteter Uebergang auf voll:

- Snapshots `546 -> 547`
- lokale Zeit `2026-05-21 12:52:36 -> 12:52:40`

Vorher `ID 546`:

- `SOC = 99 %`
- `PV gesamt = 2296.7 W`
- `AC gesamt = 1846.8 W`
- `Batterie laedt = 165.0 W`
- `3178 = 0`
- `3179 = 0`
- `3180 = 0`
- `3181 = 1650`
- `3166 = 257`
- `3212 = 1`
- `201/202/203 = 97 / 39 / 672`

Nachher `ID 547`:

- `SOC = 100 %`
- `PV gesamt = 1831.6 W`
- `AC gesamt = 1846.0 W`
- `Batterie laedt = 0.0 W`
- `Batterie entlaedt = 5.0 W`
- `3178 = 0`
- `3179 = 50`
- `3180 = 0`
- `3181 = 0`
- `3166 = 513`
- `3212 = 4`
- `201/202/203 = 0 / 0 / 0`

Interpretation:

- `3180-3181` ist der staerkste Kandidat fuer die noch erlaubte
  Batterieladeleistung
- `3166` und `3212` markieren sehr wahrscheinlich den Statuswechsel auf
  `Batterie voll / keine weitere Ladefreigabe`
- `201-203` koennten die momentane Leistungsfreigabe oder einen internen
  Abregelungszustand widerspiegeln
- `100-104` aendern sich an diesem Uebergang nicht und sind damit aktuell
  kein guter Kandidat fuer eine live gemeldete `% Abregelung`

## Abgleich mit Growatt-App

Vom Benutzer bereitgestellter App-Screenshot, lokale Zeit etwa
`2026-05-21 11:27`:

- `Ppv = 3.46 kW`
- `SOC = 92 %`
- `Discharging Power = 5.16 kW`
- `Load power = 10.9 kW`
- `Import = 2.27 kW`
- Betriebsart: `On-Grid mode (Load First)`

Energiefluss-Plausibilitaet:

- `3.46 + 5.16 + 2.27 = 10.89 kW`
- das passt praktisch exakt zu `Load power 10.9 kW`

Bedeutung fuer die Registerarbeit:

- die App bestaetigt den klaren Entladefall
- `3178-3179` wird als Entlade-Kandidat deutlich staerker
- `3180-3181` wird als Lade-Kandidat deutlich staerker
- die aktuell im Web-UI abgeleiteten Werte fuer
  `Load Power` und `Import from Grid` sind in diesem Fall fachlich
  stimmig
- `Load First` sollte als zusaetzlicher Kontext fuer kuenftige
  Beobachtungen mit notiert werden

## Beobachteter Idle-Fall

Fruehere Snapshots mit Batterie vorhanden, aber ohne erkennbaren
Batterie-Leistungsfluss:

- Beispiel Snapshots `6-10`
- `3178 = 0`
- `3179 = 0`
- `3212 = 1`

Interpretation:

- `3178-3179` unterscheidet sich deutlich zwischen `0` und aktivem
  Batteriefluss
- `3212` scheint einen Betriebszustand des BMS oder Hybrid-Systems
  zu kennzeichnen

## Unbekannte, aber belegte Input Register

Diese Register waren im letzten ausgewerteten Snapshot ungleich `0`,
sind aber noch nicht sicher zugeordnet.

| Adresse | Rohwert | Vermutung |
| --- | --- | --- |
| `99` | `3095` | Bus-/Zwischenkreis-Kandidat |
| `142` | `3298` | unbekannt |
| `143` | `23` | unbekannt |
| `144` | `3298` | unbekannt |
| `145` | `2` | unbekannt |
| `146` | `3407` | unbekannt |
| `147` | `23` | unbekannt |
| `148` | `3407` | unbekannt |
| `149` | `4` | unbekannt |
| `150` | `3465` | unbekannt |
| `151` | `20` | unbekannt |
| `152` | `3465` | unbekannt |
| `153` | `26` | unbekannt |
| `200` | `65530` | signed Status-/Offset-Kandidat |
| `201` | `11` | unbekannt |
| `202` | `81` | unbekannt |
| `203` | `717` | unbekannt |
| `205` | `1` | Flag-Kandidat |
| `230` | `1` | Flag-Kandidat |
| `231` | `17620` | unbekannt |
| `233` | `612` | unbekannt |
| `234` | `1` | Flag-Kandidat |
| `235` | `55557` | unbekannt |

## Unbekannte, aber belegte Holding Register

Diese Register waren im letzten ausgewerteten Snapshot ungleich `0`,
sind aber noch nicht sauber benannt. Viele davon duerften Konfiguration,
Grenzwerte, Zeitfenster oder Herstellerspezifika sein.

### Holding `0-21`

`0=1`, `1=509`, `5=10000`, `8=1600`, `9=17486`, `10=12590`, `11=12288`,
`12=23106`, `13=17475`, `14=14`, `15=2`, `17=2000`, `18=60`, `19=60`,
`20=90`, `21=90`

### Holding `30-41`

`30=1`, `31=100`, `34=8264`, `35=31074`, `36=29289`, `37=25632`,
`38=18798`, `39=30309`, `40=29300`, `41=25970`

### Holding `43-81`

`43=5400`, `44=2051`, `45=2026`, `46=5`, `47=21`, `48=11`, `49=25`,
`50=24`, `51=4`, `52=3187`, `53=4980`, `54=4750`, `55=5150`, `56=1793`,
`57=4980`, `58=4750`, `59=5150`, `60=1793`, `61=4980`, `62=4750`,
`63=5150`, `64=3386`, `65=4382`, `66=4765`, `67=5010`, `68=152`,
`69=3`, `70=17`, `71=3`, `72=3`, `73=3`, `74=3`, `75=3`, `76=17`,
`77=3`, `78=3`, `79=3`, `80=4382`, `81=3`

### Holding `82-123`

`82=17486`, `83=16961`, `84=12342`, `85=13617`, `86=12337`, `87=12596`,
`88=1332`, `90=2`, `91=5020`, `92=50`, `93=4103`, `94=4263`, `95=3864`,
`96=3705`, `97=20`, `98=5`, `99=4183`, `100=3984`, `101=9882`,
`102=9882`, `103=9736`, `104=10196`, `105=10196`, `106=10289`,
`107=10`, `109=484`, `110=255`, `111=20000`, `112=255`, `113=20000`,
`114=255`, `115=20000`, `116=255`, `117=20000`, `118=1801`, `119=6`,
`120=3841`, `121=250`, `122=1`, `123=2`

### Holding `125-155`

`125=20566`, `126=8224`, `127=8272`, `128=12336`, `129=12320`,
`130=8224`, `131=8224`, `132=8192`, `142=4980`, `143=5020`, `145=1`,
`146=3187`, `147=4581`, `148=4382`, `149=4382`, `150=3`, `151=4980`,
`153=4800`, `155=5200`

### Holding `161-235`

`161=10`, `171=4382`, `176=50`, `177=5010`, `180=1`, `184=1`, `185=2`,
`192=34`, `196=32768`, `206=1`, `209=19278`, `210=20025`, `211=17969`,
`212=20784`, `213=12629`, `227=25`, `228=25`, `229=10`, `232=1`,
`235=1`

## Unbekannte, aber belegte Batterie-/Hybrid-Register

Im letzten ausgewerteten Snapshot waren zusaetzlich diese hohen
Input-Register ungleich `0`, ohne dass ihre Bedeutung bereits klar ist.

| Adresse | Rohwert | Vermutung |
| --- | --- | --- |
| `3169` | `6189` | Hybrid-/Batteriespannungs-Kandidat |
| `3170` | `65453` | signed Strom-/Offset-Kandidat |
| `3174` | `136` | unbekannt |
| `3175` | `6` | unbekannt |
| `3176` | `469` | unbekannt |
| `3177` | `375` | unbekannt |
| `3187` | `3` | Status-/Mode-Flag |
| `3188` | `3105` | unbekannt |
| `3189` | `1` | Flag-Kandidat |
| `3190` | `23` | unbekannt |

## Aktuelle Ableitungen im Web-UI

Diese Werte werden derzeit noch nicht aus einem bestaetigten einzelnen
Register gelesen, sondern aus bekannten Leistungswerten abgeleitet:

- `Import from Grid`
- `Export to Grid`
- `Load Power`

Diese drei Punkte bleiben offen, bis echte Register oder eine belastbare
Registerkombination dafuer bestaetigt ist.

## Noch offen

- echtes Register fuer `Import from Grid`
- echtes Register fuer `Export to Grid`
- echtes Register fuer `Load Power`
- endgueltige Dekodierung von `3173`, `3182-3185` und `3166`
- Bedeutung der Input-Bloecke `142-153`, `200-205`, `230-235`
- Bedeutung der vielen belegten Holding-Register
- Zero-Export-/Abregelungs-Register oder belastbare Registerkombination

## Pflegehinweis

Neue Beobachtungen bitte immer mit diesen Angaben ergaenzen:

- Zeit / Snapshot-ID
- `PV gesamt`
- `AC gesamt`
- `SOC`
- ob Batterie laedt, entlaedt oder neutral ist
- relevante Rohregister, besonders:
  `3171`, `3172`, `3173`, `3178`, `3179`, `3212`
