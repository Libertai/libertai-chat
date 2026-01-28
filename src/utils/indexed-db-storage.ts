import { get, set, del } from "idb-keyval";

export const indexedDBStorage = {
	getItem: async (name: string) => (await get(name)) ?? null,
	setItem: async (name: string, value: string) => await set(name, value),
	removeItem: async (name: string) => await del(name),
};
