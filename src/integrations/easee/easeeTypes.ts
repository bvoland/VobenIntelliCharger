export const EASEE_BASE_URL = "https://api.easee.com/api";

export interface EaseeConfig {
  userName: string;
  refreshToken: string;
  accessToken?: string;
  accessTokenExpiresAt?: string;
  authInvalid?: boolean;
  safeMode?: boolean;
  cooldownUntil?: string;
  lastRequestAt?: string;
  consecutiveFailures?: number;
  lastErrorStatus?: number;
  lastValidatedAt?: string;
}

export interface EaseeLoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn?: number;
}

export interface EaseeStateResponse {
  smartCharging?: boolean;
  cableLocked?: boolean;
  chargerOpMode?: number;
  totalPower?: number;
  sessionEnergy?: number;
  energyPerHour?: number;
  outputCurrent?: number;
  dynamicChargerCurrent?: number;
  voltage?: number;
  isOnline?: boolean;
  connectedToCloud?: boolean;
  reasonForNoCurrent?: number;
  lifetimeEnergy?: number;
  [key: string]: unknown;
}

export interface EaseeChargerSummary {
  id: string;
  name?: string;
  siteId?: number | string;
  [key: string]: unknown;
}

export interface EaseeOngoingSession {
  chargerId?: string;
  sessionEnergy?: number;
  sessionStart?: string;
  energyPerHour?: number;
  outputCurrent?: number;
}
