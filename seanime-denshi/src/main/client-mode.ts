import { app, ipcMain, net } from "electron"
import { spawn, ChildProcess } from "node:child_process"
import { loadDenshiSettings, saveDenshiSettings } from "./denshi-settings"
import { log } from "./logging"

let cachedServerUrl: string | null = null
let activeExternalMpvProcess: ChildProcess | null = null

export function normalizeServerUrl(rawUrl: string): string {
    let clean = (rawUrl || "").trim()
    if (!clean) return "http://127.0.0.1:43211"
    if (!clean.startsWith("http://") && !clean.startsWith("https://")) {
        clean = "http://" + clean
    }
    return clean.replace(/\/+$/, "")
}

export function parseServerUrlFromArgs(argv: string[]): string | null {
    if (!argv || !Array.isArray(argv)) return null
    for (let i = 0; i < argv.length; i++) {
        if (argv[i].startsWith("--server=")) {
            return normalizeServerUrl(argv[i].split("=")[1])
        }
        if (argv[i] === "--server" && i + 1 < argv.length) {
            return normalizeServerUrl(argv[i + 1])
        }
    }
    return null
}

export function resolveServerUrl(): string {
    if (cachedServerUrl) return cachedServerUrl

    // 1. Check command line arguments: --server <url> or --server=<url>
    const fromArgs = parseServerUrlFromArgs(process.argv)
    if (fromArgs) {
        setServerUrl(fromArgs)
        return fromArgs
    }

    // 2. Check environment variable
    if (process.env.SEANIME_SERVER_URL) {
        const fromEnv = normalizeServerUrl(process.env.SEANIME_SERVER_URL)
        setServerUrl(fromEnv)
        return fromEnv
    }

    // 3. Check denshi settings
    const settings = loadDenshiSettings()
    if (settings.serverUrl && settings.serverUrl.trim()) {
        cachedServerUrl = normalizeServerUrl(settings.serverUrl)
        return cachedServerUrl
    }

    // 4. Default fallback
    cachedServerUrl = "http://127.0.0.1:43211"
    return cachedServerUrl
}

export function setServerUrl(url: string): void {
    const normalized = normalizeServerUrl(url)
    cachedServerUrl = normalized
    const settings = loadDenshiSettings()
    saveDenshiSettings({ ...settings, serverUrl: normalized })
    log.info("[ClientMode] Server URL updated to:", normalized)
}

export function isClientMode(): boolean {
    if (process.argv.includes("--client") || process.argv.includes("-no-binary") || process.env.SEANIME_CLIENT_MODE === "true") {
        return true
    }
    const settings = loadDenshiSettings()
    return settings.clientOnlyMode !== false
}

export async function isServerReachable(url?: string, timeoutMs = 2500): Promise<boolean> {
    const targetUrl = url ? normalizeServerUrl(url) : resolveServerUrl()
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
    try {
        const response = await net.fetch(`${targetUrl}/api/v1/status`, {
            signal: controller.signal,
        })
        return response.ok
    }
    catch {
        return false
    }
    finally {
        clearTimeout(timeoutId)
    }
}

export function launchExternalMpv(streamUrl: string, title?: string): boolean {
    try {
        const settings = loadDenshiSettings()
        const mpvBin = settings.externalMpvPath || "mpv"

        if (activeExternalMpvProcess && !activeExternalMpvProcess.killed) {
            try {
                activeExternalMpvProcess.kill()
            } catch {
                // ignore
            }
        }

        const args = [
            streamUrl,
            title ? `--title=${title}` : "--title=Seanime Stream",
            "--input-ipc-server=/tmp/seanime-mpv.sock",
            "--force-window=yes",
        ]

        log.info("[ClientMode] Launching external MPV:", mpvBin, args)
        const proc = spawn(mpvBin, args, {
            detached: true,
            stdio: "ignore",
        })

        proc.unref()
        activeExternalMpvProcess = proc
        return true
    } catch (err) {
        log.error("[ClientMode] Failed to launch external MPV:", err)
        return false
    }
}

export function registerClientModeIpc(): void {
    ipcMain.on("denshi:get-server-url-sync", (event) => {
        event.returnValue = resolveServerUrl()
    })

    ipcMain.handle("denshi:get-server-url", () => {
        return resolveServerUrl()
    })

    ipcMain.handle("denshi:set-server-url", (_, url: string) => {
        setServerUrl(url)
        return true
    })

    ipcMain.handle("denshi:test-connection", async (_, url: string) => {
        return await isServerReachable(url)
    })

    ipcMain.handle("denshi:launch-external-mpv", (_, streamUrl: string, title?: string) => {
        return launchExternalMpv(streamUrl, title)
    })
}
