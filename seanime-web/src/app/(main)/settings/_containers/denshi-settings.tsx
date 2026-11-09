import { SettingsCard } from "@/app/(main)/settings/_components/settings-card"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { TextInput } from "@/components/ui/text-input"
import React from "react"
import { RiSettings3Fill } from "react-icons/ri"
import { toast } from "sonner"

export function DenshiSettings() {

    const [settings, setSettings] = React.useState<DenshiSettings | null>(null)
    const settingsRef = React.useRef<DenshiSettings | null>(null)
    const [loading, setLoading] = React.useState(true)
    const [serverUrlInput, setServerUrlInput] = React.useState("")
    const [testingConnection, setTestingConnection] = React.useState(false)

    React.useEffect(() => {
        if (window.electron?.denshiSettings) {
            window.electron.denshiSettings.get().then((s) => {
                setSettings(s)
                settingsRef.current = s
                setServerUrlInput(s.serverUrl || "http://127.0.0.1:43211")
                setLoading(false)
            })
        }
    }, [])

    function updateSetting(key: keyof DenshiSettings, value: boolean | string) {
        if (!settingsRef.current || !window.electron?.denshiSettings) return

        const newSettings = { ...settingsRef.current, [key]: value }
        settingsRef.current = newSettings
        setSettings(newSettings)
        window.electron.denshiSettings.set(newSettings)
    }

    async function handleTestConnection() {
        if (!window.electron?.server?.testConnection) return
        setTestingConnection(true)
        try {
            const ok = await window.electron.server.testConnection(serverUrlInput)
            if (ok) {
                toast.success(`Successfully reached Seanime server at ${serverUrlInput}`)
            } else {
                toast.error(`Could not reach server at ${serverUrlInput}. Please check the URL, firewall, or port.`)
            }
        } catch {
            toast.error("Connection test failed")
        } finally {
            setTestingConnection(false)
        }
    }

    async function handleSaveServerUrl() {
        if (!serverUrlInput.trim()) return
        updateSetting("serverUrl", serverUrlInput.trim())
        if (typeof window !== "undefined") {
            window.localStorage.setItem("sea-remote-server-url", serverUrlInput.trim())
        }
        if (window.electron?.server?.setUrl) {
            await window.electron.server.setUrl(serverUrlInput.trim())
        }
        toast.success("Server address saved! Reloading client...")
        setTimeout(() => {
            window.location.reload()
        }, 800)
    }

    if (loading || !settings) {
        return null
    }

    return (
        <div className="space-y-4">
            <SettingsCard title="Server Connection">
                <div className="space-y-3">
                    <p className="text-sm text-gray-500">
                        Configure the Seanime instance this desktop client connects to.
                    </p>
                    <div className="flex gap-2 items-center">
                        <div className="flex-1">
                            <TextInput
                                label="Server Address"
                                value={serverUrlInput}
                                onChange={(e) => setServerUrlInput(e.target.value)}
                                placeholder="e.g. http://192.168.1.100:43211"
                            />
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            intent="primary"
                            size="sm"
                            onClick={handleSaveServerUrl}
                        >
                            Save & Reconnect
                        </Button>
                        <Button
                            intent="gray-outline"
                            size="sm"
                            loading={testingConnection}
                            onClick={handleTestConnection}
                        >
                            Test Connection
                        </Button>
                    </div>
                </div>
            </SettingsCard>

            <SettingsCard title="Player Options">
                <Switch
                    side="right"
                    value={settings.useExternalMpv ?? false}
                    onValueChange={(v) => updateSetting("useExternalMpv", v)}
                    label="Use system MPV (from $PATH)"
                    help="When enabled, launches your system's /usr/bin/mpv externally instead of using the embedded libmpv player."
                />
                {settings.useExternalMpv && (
                    <div className="pt-2">
                        <TextInput
                            label="MPV Command / Path"
                            value={settings.externalMpvPath || "mpv"}
                            onChange={(e) => updateSetting("externalMpvPath", e.target.value)}
                            placeholder="mpv"
                        />
                    </div>
                )}
            </SettingsCard>

            <SettingsCard title="Window">
                <Switch
                    side="right"
                    value={settings.minimizeToTray}
                    onValueChange={(v) => updateSetting("minimizeToTray", v)}
                    label="Minimize to tray on close"
                    help="When enabled, closing the window will minimize the app to the system tray instead of quitting."
                />
                <Switch
                    side="right"
                    value={settings.openInBackground}
                    onValueChange={(v) => updateSetting("openInBackground", v)}
                    label="Open in background"
                    help="When enabled, the app will start hidden. You can show it from the system tray."
                />
            </SettingsCard>

            <SettingsCard title="System">
                <Switch
                    side="right"
                    value={settings.openAtLaunch}
                    onValueChange={(v) => updateSetting("openAtLaunch", v)}
                    label="Open at launch"
                    help={window.electron?.platform === "linux"
                        ? "This feature is not supported on Linux."
                        : "When enabled, the app will start automatically when you log in to your computer."}
                    disabled={window.electron?.platform === "linux"}
                />
            </SettingsCard>

            <div className="flex items-center gap-2 text-sm text-gray-500 bg-gray-50 dark:bg-gray-900/30 rounded-lg p-3 border border-gray-200 dark:border-gray-800 border-dashed">
                <RiSettings3Fill className="text-base" />
                <span>Denshi Client settings are saved automatically to your user profile.</span>
            </div>
        </div>
    )
}
