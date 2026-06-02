import { ConfigStore } from "../../config/configStore";
import { EASEE_BASE_URL, EaseeConfig, EaseeLoginResponse } from "./easeeTypes";

const CONFIG_PATH = "easee.json";

function buildExpiry(expiresIn?: number): string | undefined {
  return expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : undefined;
}

export async function authenticateEasee(
  configStore: ConfigStore,
  input: { userName: string; password: string; safeMode?: boolean }
): Promise<void> {
  const response = await fetch(`${EASEE_BASE_URL}/accounts/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userName: input.userName,
      password: input.password
    })
  });

  if (!response.ok) {
    throw new Error(`Easee Login fehlgeschlagen (${response.status}).`);
  }

  const data = (await response.json()) as EaseeLoginResponse;
  const config: EaseeConfig = {
    userName: input.userName,
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    accessTokenExpiresAt: buildExpiry(data.expiresIn),
    authInvalid: false,
    safeMode: input.safeMode === true,
    consecutiveFailures: 0,
    lastValidatedAt: new Date().toISOString()
  };

  await configStore.writeJson(CONFIG_PATH, config);
}

export async function readEaseeConfig(configStore: ConfigStore): Promise<EaseeConfig | null> {
  return configStore.readJson<EaseeConfig | null>(CONFIG_PATH, null);
}
