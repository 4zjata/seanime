import { getServerBaseUrl } from "@/api/client/server-url"
import { serverAuthTokenAtom } from "@/app/(main)/_atoms/server-status.atoms"
import { isUpdateInstalledAtom, isUpdatingAtom } from "@/app/(main)/_electron/electron-update-modal"
import { websocketConnectedAtom, websocketConnectionErrorCountAtom } from "@/app/websocket-provider"
import { LuffyError } from "@/components/shared/luffy-error"
import { Button } from "@/components/ui/button"
import { Modal } from "@/components/ui/modal"
import { TextInput } from "@/components/ui/text-input"
import { useAtomValue } from "jotai/react"
import React from "react"
import { toast } from "sonner"

export function ElectronRestartServerPrompt() {

    type ServerReachability = "unknown" | "reachable" | "unreachable"

    const [hasRendered, setHasRendered] = React.useState(false)

    const isConnected = useAtomValue(websocketConnectedAtom)
    const connectionErrorCount = useAtomValue(websocketConnectionErrorCountAtom)
    const [hasClickedRestarted, setHasClickedRestarted] = React.useState(false)
    const isUpdatedInstalled = useAtomValue(isUpdateInstalledAtom)
    const isUpdating = useAtomValue(isUpdatingAtom)

    // Check if the server requires a password (no router dependency)
    const [serverHasPassword, setServerHasPassword] = React.useState(false)
    const [serverReachability, setServerReachability] = React.useState<ServerReachability>("unknown")
    const [failedProbeCount, setFailedProbeCount] = React.useState(0)
    const [serverUrlInput, setServerUrlInput] = React.useState("")
    const [testingConnection, setTestingConnection] = React.useState(false)
    const [isSaving, setIsSaving] = React.useState(false)
    const serverAuthToken = useAtomValue(serverAuthTokenAtom)

    React.useEffect(() => {
        if (window.electron?.server?.getUrl) {
            window.electron.server.getUrl().then((url: string) => {
                if (url) setServerUrlInput(url)
            })
        } else {
            setServerUrlInput(getServerBaseUrl())
        }
    }, [])

    const probeServerHealth = React.useCallback(async () => {
        try {
            const headers: Record<string, string> = {}
            if (serverAuthToken) {
                headers["X-Seanime-Token"] = serverAuthToken
            }

            const res = await fetch(`${getServerBaseUrl()}/api/v1/status`, {
                headers,
                cache: "no-store",
            })

            if (!res.ok) {
                setServerReachability("unreachable")
                setFailedProbeCount(c => c + 1)
                return false
            }

            const json = await res.json() as { data?: { serverHasPassword?: boolean } }
            setServerHasPassword(!!json?.data?.serverHasPassword)
            setServerReachability("reachable")
            setFailedProbeCount(0)
            return true
        }
        catch {
            setServerReachability("unreachable")
            setFailedProbeCount(c => c + 1)
            return false
        }
    }, [serverAuthToken])

    React.useEffect(() => {
        probeServerHealth()
    }, [probeServerHealth])

    React.useEffect(() => {
        (async () => {
            if (window.electron) {
                setHasRendered(true)
            }
        })()
    }, [])

    React.useEffect(() => {
        if (isConnected || !hasRendered) {
            if (isConnected) {
                setServerReachability("reachable")
            }
            return
        }

        probeServerHealth()

        const interval = setInterval(() => {
            probeServerHealth()
        }, 2000)

        return () => {
            clearInterval(interval)
        }
    }, [hasRendered, isConnected, probeServerHealth])

    const handleRestart = async () => {
        if (import.meta.env.MODE === "development") return toast.warning("Dev mode: Not restarting server")

        setHasClickedRestarted(true)
        toast.info("Restarting server...")
        if (window.electron) {
            window.electron.emit("restart-server")
            React.startTransition(() => {
                setTimeout(() => {
                    setHasClickedRestarted(false)
                }, 5000)
            })
        }
    }

    const handleTestConnection = async () => {
        if (!serverUrlInput) return
        setTestingConnection(true)
        try {
            let target = serverUrlInput.trim()
            if (!target.startsWith("http://") && !target.startsWith("https://")) {
                target = "http://" + target
            }
            target = target.replace(/\/+$/, "")

            if (window.electron?.server?.testConnection) {
                const ok = await window.electron.server.testConnection(target)
                if (ok) {
                    toast.success("Server is reachable!")
                } else {
                    toast.error("Could not reach " + target)
                }
            } else {
                const res = await fetch(`${target}/api/v1/status`)
                if (res.ok) {
                    toast.success("Server is reachable!")
                } else {
                    toast.error("Could not reach " + target)
                }
            }
        } catch {
            toast.error("Connection test failed")
        } finally {
            setTestingConnection(false)
        }
    }

    const handleSaveAndConnect = async () => {
        if (!serverUrlInput) return
        setIsSaving(true)
        try {
            let target = serverUrlInput.trim()
            if (!target.startsWith("http://") && !target.startsWith("https://")) {
                target = "http://" + target
            }
            target = target.replace(/\/+$/, "")

            if (window.electron?.server?.setUrl) {
                await window.electron.server.setUrl(target)
            }
            if (typeof window !== "undefined" && window.localStorage) {
                window.localStorage.setItem("sea-remote-server-url", target)
            }
            toast.success("Connecting to " + target)
            setTimeout(() => {
                window.location.reload()
            }, 300)
        } catch {
            toast.error("Failed to save server URL")
            setIsSaving(false)
        }
    }

    const isServerUnavailable = serverReachability === "unreachable"
    const isUnauthenticated = !isServerUnavailable && ((serverHasPassword && !serverAuthToken) || import.meta.env.MODE === "development")

    React.useEffect(() => {
        if (isConnected) {
            setHasClickedRestarted(false)
        }
    }, [isConnected])

    if (!hasRendered || isUnauthenticated) return null

    const isPromptOpen = !isConnected && isServerUnavailable && (connectionErrorCount >= 2 || failedProbeCount >= 2) && !isUpdatedInstalled && !isUpdating

    return (
        <>
            {(!isConnected && isServerUnavailable && !isPromptOpen && !isUpdating && !isUpdatedInstalled) && (
                <div className="fixed top-4 left-1/2 z-[9999] -translate-x-1/2 rounded-full border bg-orange-950/85 px-4 py-2 text-sm text-gray-200 shadow-lg backdrop-blur-sm">
                    Connecting to Seanime server...
                </div>
            )}

            <Modal
                open={isPromptOpen}
                onOpenChange={() => {}}
                hideCloseButton
                contentClass="max-w-2xl"
            >
                <LuffyError title="Cannot connect to server">
                    <div className="space-y-4 flex flex-col items-center w-full">
                        <p className="text-base text-center max-w-md text-gray-300">
                            Unable to reach the Seanime server at:
                            <br />
                            <code className="text-xs bg-black/60 px-2.5 py-1 rounded text-orange-300 font-mono mt-1.5 inline-block border border-orange-500/20">
                                {getServerBaseUrl()}
                            </code>
                        </p>

                        <div className="w-full max-w-md space-y-2 text-left bg-black/40 p-4 rounded-xl border border-white/10">
                            <label className="text-xs font-semibold text-gray-300">Server Address</label>
                            <TextInput
                                value={serverUrlInput}
                                onValueChange={setServerUrlInput}
                                placeholder="http://192.168.1.164:43211"
                                className="w-full"
                            />
                            <p className="text-[11px] text-[--muted]">
                                Enter your Seanime server IP/domain and port (e.g. http://192.168.1.164:43211).
                            </p>
                            <div className="flex justify-end gap-2 pt-2">
                                <Button
                                    onClick={handleTestConnection}
                                    loading={testingConnection}
                                    intent="gray-outline"
                                    size="sm"
                                    className="rounded-lg"
                                >
                                    Test Connection
                                </Button>
                                <Button
                                    onClick={handleSaveAndConnect}
                                    loading={isSaving}
                                    intent="primary"
                                    size="sm"
                                    className="rounded-lg"
                                >
                                    Save & Connect
                                </Button>
                            </div>
                        </div>

                        <div className="pt-2 flex items-center gap-2">
                            <Button
                                onClick={handleRestart}
                                loading={hasClickedRestarted}
                                intent="gray-subtle"
                                size="sm"
                                className="rounded-full text-xs text-gray-400"
                            >
                                Restart local sidecar
                            </Button>
                        </div>
                    </div>
                </LuffyError>
            </Modal>
        </>
    )
}
