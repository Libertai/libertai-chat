import { create } from "zustand";
import { Account } from "thirdweb/wallets";
import env from "@/config/env.ts";
import { getBalance } from "thirdweb/extensions/erc20";
import { thirdwebClient } from "@/config/thirdweb.ts";
import { base } from "thirdweb/chains";
import { getAuthMessageAuthMessagePost, loginWithWalletAuthLoginPost } from "@/apis/inference/sdk.gen";
import { toast } from "sonner";
import Cookies from "js-cookie";

const LTAI_BASE_ADDRESS = env.LTAI_BASE_ADDRESS as `0x${string}`;
const JWT_COOKIE_NAME = "libertai_auth";

// Determine if we're in development (localhost) or production
const isDevelopment = window.location.hostname === "localhost";

// Cookie options with environment-specific settings
// Note: The backend will set the HttpOnly flag which can't be set via JavaScript
const COOKIE_OPTS = isDevelopment
	? {
			// Development environment (localhost) settings
			secure: false, // Allow HTTP for local development
			sameSite: "lax" as const, // Less strict for local development
			path: "/", // Available across the entire site
			expires: 7, // 7 days expiration
		}
	: {
			// Production environment settings (app.libertai.io and auth.api.libertai.io)
			secure: true, // Only sent over HTTPS
			sameSite: "none" as const, // Allow cross-domain cookies
			domain: ".libertai.io", // Shared top-level domain
			path: "/", // Available across the entire site
			expires: 7, // 7 days expiration
		};

type AccountStoreState = {
	alephStorage: null;
	ltaiBalance: number;
	apiCredits: number;
	formattedLTAIBalance: () => string;
	formattedAPICredits: () => string;
	account: Account | null;
	jwtToken: string | null;

	onAccountChange: (newAccount: Account | undefined) => Promise<void>;
	signMessage: (message: string) => Promise<string>;
	getLTAIBalance: () => Promise<number>;
	getAPICredits: () => Promise<number>;
	onDisconnect: () => void;
	authenticate: () => Promise<boolean>;
	setJWT: (token: string) => void;
	clearJWT: () => void;
};

export const useAccountStore = create<AccountStoreState>((set, get) => ({
	alephStorage: null,
	ltaiBalance: 0,
	apiCredits: 0,
	formattedLTAIBalance: () => get().ltaiBalance.toFixed(0),
	formattedAPICredits: () => get().apiCredits.toFixed(0),
	account: null,
	jwtToken: null,

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

		// Authenticate with the API and get API credits
		const authSuccess = await state.authenticate();

		if (!authSuccess) {
			// set({ account: null });
			return;
		}

		// Get LTAI token balance from blockchain
		const ltaiBalance = await state.getLTAIBalance();
		set({ ltaiBalance: ltaiBalance });
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
			contract: { address: LTAI_BASE_ADDRESS, client: thirdwebClient, chain: base },
			address: state.account.address,
		});

		return Number(balance.displayValue);
	},
	getAPICredits: async (): Promise<number> => {
		// This would typically come from the API after authentication
		// For now we'll return a placeholder value until we implement the proper endpoint
		return 0;
	},
	authenticate: async (): Promise<boolean> => {
		const state = get();

		if (state.account === null) {
			return false;
		}

		try {
			// Get the message to sign
			const messageResponse = await getAuthMessageAuthMessagePost({
				body: {
					address: state.account.address,
				},
			});

			if (!messageResponse.data) {
				toast.error("Authentication failed", {
					description: "Could not get message to sign",
				});
				return false;
			}

			// Sign the message
			let signature = "";
			if (isDevelopment) {
				const storedSignature = localStorage.getItem(`libertai_dev_signature_${state.account.address}`);
				if (storedSignature == null) {
					signature = await state.signMessage(messageResponse.data.message);
					localStorage.setItem(`libertai_dev_signature_${state.account.address}`, signature);
				} else {
					signature = storedSignature;
				}
			} else {
				signature = await state.signMessage(messageResponse.data.message);
			}

			// Login with the signature
			const loginResponse = await loginWithWalletAuthLoginPost({
				body: {
					address: state.account.address,
					signature: signature,
				},
			});

			if (loginResponse.data?.access_token) {
				// Store the JWT token
				state.setJWT(loginResponse.data.access_token);

				// Update API credits
				const apiCredits = await state.getAPICredits();
				set({ apiCredits });

				return true;
			} else {
				toast.error("Authentication failed", {
					description: "Invalid response from server",
				});
				return false;
			}
		} catch (error) {
			console.error("Authentication error:", error);
			toast.error("Authentication failed", {
				description: error instanceof Error ? error.message : "Unknown error",
			});
			return false;
		}
	},
	setJWT: (token: string) => {
		// Store JWT in a secure cookie with cross-domain settings
		Cookies.set(JWT_COOKIE_NAME, token, COOKIE_OPTS);

		set({ jwtToken: token });
	},
	clearJWT: () => {
		// Remove JWT cookie with same environment-specific settings
		Cookies.remove(
			JWT_COOKIE_NAME,
			isDevelopment
				? { path: "/" }
				: {
						domain: ".libertai.io",
						path: "/",
					},
		);

		// Update state
		set({ jwtToken: null });
	},
	onDisconnect: () => {
		const state = get();
		state.clearJWT();
		set({ account: null, alephStorage: null, ltaiBalance: 0, apiCredits: 0 });
	},
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
