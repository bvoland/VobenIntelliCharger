import path from "node:path";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";

export class EmbeddedGrowattService {
  private child: ChildProcessWithoutNullStreams | null = null;
  private readonly host = "127.0.0.1";
  private readonly port = 5001;
  private readonly pythonBin = process.env.PYTHON_BIN ?? "python";

  constructor(private readonly baseDir: string) {}

  getBaseUrl(): string {
    return `http://${this.host}:${this.port}`;
  }

  async start(): Promise<void> {
    if (await this.isHealthy()) {
      return;
    }

    if (this.child) {
      throw new Error("Eingebetteter Growatt-Reader startet bereits.");
    }

    const readerDir = path.join(this.baseDir, "embedded", "growatt-reader");
    const dataDir = path.join(this.baseDir, "data");
    const stdoutLog = path.join(this.baseDir, "run.stdout.log");
    const stderrLog = path.join(this.baseDir, "run.stderr.log");

    this.child = spawn(this.pythonBin, ["app.py"], {
      cwd: readerDir,
      env: {
        ...process.env,
        APP_HOST: this.host,
        APP_PORT: String(this.port),
        APP_DEBUG: "false",
        LOGGER_AUTOSTART: "false",
        DATABASE_PATH: path.join(dataDir, "growatt-reader.db"),
      },
      stdio: "pipe",
      windowsHide: true,
    });

    this.child.stdout.on("data", (chunk) => {
      process.stdout.write(`[growatt-reader] ${chunk}`);
    });
    this.child.stderr.on("data", (chunk) => {
      process.stderr.write(`[growatt-reader] ${chunk}`);
    });
    this.child.on("exit", () => {
      this.child = null;
    });
    this.child.on("error", (error) => {
      process.stderr.write(`[growatt-reader] ${String(error)}\n`);
    });

    await this.waitForHealth();
  }

  stop(): void {
    if (!this.child) {
      return;
    }

    this.child.kill();
    this.child = null;
  }

  private async isHealthy(): Promise<boolean> {
    try {
      const response = await fetch(`${this.getBaseUrl()}/api/health`);
      return response.ok;
    } catch {
      return false;
    }
  }

  private async waitForHealth(): Promise<void> {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      if (await this.isHealthy()) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    this.stop();
    throw new Error(
      `Eingebetteter Growatt-Reader konnte nicht unter ${this.getBaseUrl()} gestartet werden.`
    );
  }
}
