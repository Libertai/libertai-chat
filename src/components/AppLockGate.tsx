import { LockKeyhole, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppLock } from "@/hooks/use-app-lock";
import { isMobileBetaApp } from "@/lib/mobile-runtime";

export function AppLockGate() {
	const nativeBeta = isMobileBetaApp();
	const { error, isAuthenticating, isLocked, unlock } = useAppLock();

	if (!nativeBeta || !isLocked) return null;

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-background px-6">
			<div className="w-full max-w-sm space-y-6 text-center">
				<div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-border bg-muted">
					<LockKeyhole className="h-6 w-6 text-foreground" />
				</div>
				<div className="space-y-2">
					<h1 className="text-2xl font-semibold tracking-tight">LibertAI is locked</h1>
					<p className="text-sm text-muted-foreground">Use your device unlock to continue.</p>
				</div>
				<Button onClick={() => void unlock()} disabled={isAuthenticating} className="w-full">
					{isAuthenticating && <Loader2 className="h-4 w-4 animate-spin" />}
					Unlock
				</Button>
				{error && <p className="text-sm text-destructive">{error}</p>}
			</div>
		</div>
	);
}
