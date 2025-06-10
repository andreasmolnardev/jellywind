"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@radix-ui/react-label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"


import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowRight, faCheck, faWarning } from "@fortawesome/free-solid-svg-icons";


export default function AuthForm() {
    const [loading, setLoading] = useState(false);

    const router = useRouter();
    const [useQuickConnect, setUseQuickConnect] = useState(false);

    useEffect(() => {
        const token = localStorage.getItem("jellyfin_token");
        if (token) {
            // Token exists, consider user authenticated
            router.push("/reports");
        }
    }, [router]);

    const [alert, setAlert] = useState<{
        type: "success" | "error" | null;
        title: string;
        description?: string;
    }>({ type: null, title: "" });

    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);

        const formData = new FormData(e.currentTarget);
        const serverUrl = formData.get("serverurl")?.toString().trim();
        const username = formData.get("username")?.toString().trim();
        const password = formData.get("password")?.toString();

        if (!useQuickConnect && !serverUrl) {
            setAlert({ type: "error", title: "Server URL is required unless using Quick Connect." });
            setLoading(false);
            return;
        }

        try {
            const res = await fetch(`${serverUrl}/Users/AuthenticateByName`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Emby-Authorization":
                        'MediaBrowser Client="Jellywind", Device="WebClient", DeviceId="web-123", Version="1.0.0"'

                },
                body: JSON.stringify({
                    Username: username,
                    Pw: password,
                }),
            });

            if (!res.ok) {
                throw new Error("Login failed");
            }

            const data = await res.json();

            localStorage.setItem("jellyfin_token", data.AccessToken);
            localStorage.setItem("jellyfin_user_id", data.User.Id);
            localStorage.setItem("jellyfin_server_url", serverUrl!);

            router.push("/reports");
        } catch (err) {
            console.error("Auth error:", err);
            setAlert({ type: "error", title: "Login failed. Check your credentials and server URL." });
        } finally {
            setLoading(false);
        }
    };


    return (
        <>
            {alert.type === "success" && (
                <Alert>
                    <FontAwesomeIcon icon={faCheck} />
                    <AlertTitle>{alert.title}</AlertTitle>
                    {alert.description && (
                        <AlertDescription>{alert.description}</AlertDescription>
                    )}
                </Alert>
            )}
            {alert.type === "error" && (
                <Alert variant="destructive">
                    <FontAwesomeIcon icon={faWarning} />
                    <AlertTitle>{alert.title}</AlertTitle>
                    {alert.description && (
                        <AlertDescription>{alert.description}</AlertDescription>
                    )}
                </Alert>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col items-center w-full gap-4">
                <div className="grid w-full max-w-sm items-center gap-1">
                    <Label htmlFor="serverurl">Server URL</Label>
                    <Input
                        type="text"
                        name="serverurl"
                        id="serverurl"
                        placeholder="https://demo.jellyfin.com"
                        required={!useQuickConnect}
                    />
                </div>

                <div className="grid w-full max-w-sm items-center gap-1">
                    <Label htmlFor="username">Username</Label>
                    <Input
                        type="text"
                        name="username"
                        id="username"
                        placeholder="e.g. jellyfinuser"
                        required
                    />
                </div>


                <div className="grid w-full max-w-sm items-center gap-1">
                    <Label htmlFor="password">Password</Label>
                    <Input
                        type="password"
                        name="password"
                        id="password"
                        placeholder="SecurePassword123"
                        required
                    />
                </div>

                <div className="flex items-center w-full max-w-sm my-4">
                    <div className="flex-grow border-t border-muted-foreground" />
                    <span className="px-2 text-xs uppercase text-muted-foreground bg-transparent">
                        Or continue with
                    </span>
                    <div className="flex-grow border-t border-muted-foreground" />
                </div>

                <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                        setUseQuickConnect(true);
                    }}
                >
                    Use Jellyfin Quick Connect
                </Button>

                <Button type="submit" className="mt-3 flex items-center gap-2">
                    <FontAwesomeIcon icon={faArrowRight} />
                    Log in
                </Button>
            </form>
        </>
    );
}
