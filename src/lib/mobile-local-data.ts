import { del, get } from "idb-keyval";

export const MOBILE_APP_LOCK_STORAGE_KEY = "libertai-mobile-beta-app-lock";
export const MOBILE_PUSH_STORAGE_KEY = "libertai-mobile-beta-push";

const LOCAL_STORAGE_KEYS = [
	"libertai-chats",
	"libertai-ui-theme",
	MOBILE_APP_LOCK_STORAGE_KEY,
	MOBILE_PUSH_STORAGE_KEY,
] as const;

const INDEXED_DB_KEYS = ["libertai-images"] as const;

type LocalDataExport = {
	version: 1;
	exportedAt: string;
	localStorage: Record<string, string | null>;
	indexedDb: Record<string, unknown>;
};

export async function collectMobileLocalData(): Promise<LocalDataExport> {
	const localStorageData = Object.fromEntries(LOCAL_STORAGE_KEYS.map((key) => [key, localStorage.getItem(key)]));
	const indexedDbDataEntries = await Promise.all(INDEXED_DB_KEYS.map(async (key) => [key, await get(key)] as const));

	return {
		version: 1,
		exportedAt: new Date().toISOString(),
		localStorage: localStorageData,
		indexedDb: Object.fromEntries(indexedDbDataEntries),
	};
}

export async function exportMobileLocalData(): Promise<void> {
	const payload = await collectMobileLocalData();
	const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");

	link.href = url;
	link.download = `libertai-mobile-local-data-${new Date().toISOString().slice(0, 10)}.json`;
	link.style.visibility = "hidden";
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
	URL.revokeObjectURL(url);
}

export async function deleteMobileLocalData(): Promise<void> {
	for (const key of LOCAL_STORAGE_KEYS) {
		localStorage.removeItem(key);
	}
	await Promise.all(INDEXED_DB_KEYS.map((key) => del(key)));
}
