import { Bell, Download, Loader2, LockKeyhole, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useAppLock } from "@/hooks/use-app-lock";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import { deleteMobileLocalData, exportMobileLocalData } from "@/lib/mobile-local-data";
import { isMobileBetaApp } from "@/lib/mobile-runtime";

export function MobileBetaSettings() {
	const nativeBeta = isMobileBetaApp();
	const appLock = useAppLock();
	const push = usePushNotifications();

	if (!nativeBeta) return null;

	const handleAppLockChange = async (checked: boolean) => {
		try {
			await appLock.setAppLockEnabled(checked);
			toast.success(checked ? "App lock enabled" : "App lock disabled");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Unable to update app lock.");
		}
	};

	const handlePushChange = async (checked: boolean) => {
		try {
			await push.setPushEnabled(checked);
			toast.success(checked ? "Notifications enabled" : "Notifications disabled");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Unable to update notifications.");
		}
	};

	const handleExport = async () => {
		try {
			await exportMobileLocalData();
			toast.success("Local data export started");
		} catch {
			toast.error("Unable to export local data.");
		}
	};

	const handleDelete = async () => {
		if (!window.confirm("Delete local chats, images, and mobile beta settings from this device?")) return;

		try {
			await deleteMobileLocalData();
			toast.success("Local data deleted");
			window.location.reload();
		} catch {
			toast.error("Unable to delete local data.");
		}
	};

	return (
		<div className="border rounded-lg p-6">
			<div className="mb-4">
				<h2 className="text-lg font-semibold">Mobile Beta</h2>
				<p className="text-sm text-muted-foreground">Native controls for this device.</p>
			</div>
			<div className="divide-y divide-border">
				<div className="flex items-center justify-between gap-4 py-4 first:pt-0">
					<div className="flex items-start gap-3">
						<LockKeyhole className="mt-0.5 h-4 w-4 text-muted-foreground" />
						<div className="space-y-1">
							<div className="text-sm font-medium">App lock</div>
							<p className="text-sm text-muted-foreground">Require device unlock after the app is backgrounded.</p>
							{appLock.error && <p className="text-sm text-destructive">{appLock.error}</p>}
						</div>
					</div>
					<Switch
						checked={appLock.enabled}
						disabled={appLock.isAuthenticating}
						onCheckedChange={(checked) => void handleAppLockChange(checked)}
						aria-label="Toggle app lock"
					/>
				</div>

				<div className="flex items-center justify-between gap-4 py-4">
					<div className="flex items-start gap-3">
						<Bell className="mt-0.5 h-4 w-4 text-muted-foreground" />
						<div className="space-y-1">
							<div className="text-sm font-medium">Notifications</div>
							<p className="text-sm text-muted-foreground">Receive beta notices, account alerts, and limit warnings.</p>
							{push.error && <p className="text-sm text-destructive">{push.error}</p>}
						</div>
					</div>
					<Switch
						checked={push.enabled}
						disabled={push.isUpdating || !push.isAvailable}
						onCheckedChange={(checked) => void handlePushChange(checked)}
						aria-label="Toggle notifications"
					/>
				</div>

				<div className="flex flex-wrap items-center justify-between gap-3 py-4">
					<div className="space-y-1">
						<div className="text-sm font-medium">Local data</div>
						<p className="text-sm text-muted-foreground">Chats and generated images stay on this device.</p>
					</div>
					<div className="flex flex-wrap gap-2">
						<Button variant="outline" size="sm" onClick={() => void handleExport()}>
							<Download className="h-4 w-4" />
							Export
						</Button>
						<Button variant="destructive" size="sm" onClick={() => void handleDelete()}>
							<Trash2 className="h-4 w-4" />
							Delete
						</Button>
					</div>
				</div>

				{(appLock.isAuthenticating || push.isUpdating) && (
					<div className="flex items-center gap-2 pt-4 text-sm text-muted-foreground">
						<Loader2 className="h-4 w-4 animate-spin" />
						Updating native settings
					</div>
				)}
			</div>
		</div>
	);
}
