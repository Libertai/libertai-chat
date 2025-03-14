import env from "@/config/env";
import { create } from "zustand";
import { Account } from "thirdweb/wallets";
import { getBalance } from "thirdweb/extensions/erc20";
import { base } from "thirdweb/chains";
import { thirdwebClient } from "@/config/thirdweb";

const LTAI_BASE_ADDRESS = env.LTAI_BASE_ADDRESS as `0x${string}`;

type AccountStoreState = {
	alephStorage: null;
	ltaiBalance: number;
	account: Account | null;

	onAccountChange: (newAccount: Account | undefined) => Promise<void>;
	signMessage: (message: string) => Promise<string>;
	getLTAIBalance: () => Promise<number>;
	onDisconnect: () => void;
};

export const useAccountStore = create<AccountStoreState>((set, get) => ({
	alephStorage: null,
	ltaiBalance: 0,
	account: null,

	onAccountChange: async (newAccount: Account | undefined) => {
		const state = get();

		if (newAccount === undefined) {
			// Potential disconnection
			state.onDisconnect();
			return;
		}
		if (state.account !== null && state.account.address === newAccount.address) {
			// Account already connected with the same address
			return;
		}

		set({ account: newAccount });

		const ltaiBalance = await state.getLTAIBalance();
		set({ ltaiBalance: ltaiBalance });

		// await this.initAlephStorage();
	},
	signMessage: (message: string): Promise<string> => {
		const state = get();

		if (state.account === null) {
			throw Error("No account");
		}

		return state.account.signMessage({ message });
	},
	getLTAIBalance: async (): Promise<number> => {
		const state = get();

		if (state.account === null) {
			return 0;
		}

		const balance = await getBalance({
			address: state.account.address as `0x${string}`,
			contract: {
				address: LTAI_BASE_ADDRESS,
				chain: base,
				client: thirdwebClient,
			},
		});

		return Number(balance.value);
	},
	onDisconnect: () => set({ account: null, alephStorage: null, ltaiBalance: 0 }),
}));

// 		async initAlephStorage() {
// 			const settingsStore = useSettingsStore();
//
// 			if (this.account === null) {
// 				return;
// 			}
//
// 			const hash = settingsStore.signatureHash[this.account.address] ?? (await this.signMessage(LIBERTAI_MESSAGE));
// 			if (settingsStore.isSignatureHashStored) {
// 				settingsStore.signatureHash[this.account.address] = hash;
// 			}
//
// 			const alephStorage = await AlephPersistentStorage.initialize(hash, this.account.chain);
// 			if (!alephStorage) {
// 				return;
// 			}
//
// 			this.alephStorage = alephStorage;
// 			const settingsOnAleph = await this.alephStorage.fetchSettings();
// 			const saveOnAleph = !settingsOnAleph;
// 			await settingsStore.update(settingsOnAleph ?? {}, saveOnAleph);
// 		},
