import { create } from "zustand";
import { Account as ThirdwebAccount } from "thirdweb/wallets";
import env from "@/config/env.ts";
import { base } from "thirdweb/chains";
import {
	checkAuthStatusAuthStatusGet,
	getAuthMessageAuthMessagePost,
	getChatApiKeyApiKeysChatGet,
	loginWithWalletAuthLoginPost,
} from "@/apis/inference/sdk.gen";
import { toast } from "sonner";
import { ethers } from "ethers";
import { WalletContextState as SolanaWalletContextState } from "@solana/wallet-adapter-react";
import { Buffer } from "buffer";
import { QueryClient } from "@tanstack/react-query";

const LTAI_BASE_ADDRESS = env.LTAI_BASE_ADDRESS as `0x${string}`;

type ConnectedAccount = {
	address: string;
} & (
	| {
			chain: "base";
			provider: ThirdwebAccount;
	  }
	| {
			chain: "solana";
			provider: SolanaWalletContextState;
	  }
);

type AccountStoreState = {
	ltaiBalance: number;
	solBalance: number;
	apiCredits: number;
	chatApiKey: string | null;
	formattedLTAIBalance: () => string;
	formattedSOLBalance: () => string;
	formattedAPICredits: () => string;
	account: ConnectedAccount | null;
	isAuthenticated: boolean;
	isAuthenticating: boolean;
	lastTransactionHash: string | null;
	isInitialLoad: boolean;
	queryClient: QueryClient | null;
	setQueryClient: (client: QueryClient) => void;
	onAccountChange: (
		newBaseAccount: ThirdwebAccount | undefined,
		newSolanaAccount: SolanaWalletContextState | undefined,
	) => Promise<void>;
	getLTAIBalance: () => Promise<number>;
	getSOLBalance: () => Promise<number>;
	getAPICredits: () => Promise<number>;
	getChatApiKey: () => Promise<string | null>;
	onDisconnect: () => void;
	authenticate: (
		baseAccount: ThirdwebAccount | undefined,
		solanaAccount: SolanaWalletContextState | undefined,
		showErrors?: boolean,
	) => Promise<boolean>;
	checkAuthStatus: (accountAddress: string) => Promise<boolean>;
	setLastTransactionHash: (hash: string | null) => void;
	setInitialLoadComplete: () => void;
};

export const useAccountStore = create<AccountStoreState>((set, get) => ({
	ltaiBalance: 0,
	solBalance: 0,
	apiCredits: 0,
	chatApiKey: null,
	formattedLTAIBalance: () => get().ltaiBalance.toFixed(0),
	formattedSOLBalance: () => get().solBalance.toFixed(0),
	formattedAPICredits: () => get().apiCredits.toFixed(0),
	baseAccount: null,
	solanaAccount: null,
	isAuthenticated: false,
	isAuthenticating: false,
	lastTransactionHash: null,
	isInitialLoad: true,
	account: null,
	queryClient: null,

	setQueryClient: (client: QueryClient) => {
		set({ queryClient: client });
	},

	onAccountChange: async (
		newBaseAccount: ThirdwebAccount | undefined,
		newSolanaAccount: SolanaWalletContextState | undefined,
	) => {
		const state = get();

		// Check if both accounts are undefined/null - this indicates disconnection
		if (newBaseAccount === undefined && (newSolanaAccount === undefined || !newSolanaAccount.publicKey)) {
			// Potential disconnection
			state.onDisconnect();
			return;
		}

		// Check if a Base account is already connected with the same address
		if (state.account !== null && newBaseAccount !== undefined && state.account.address === newBaseAccount.address) {
			// Base account already connected with the same address
			set({ isAuthenticated: true });
			return;
		}

		// Check if a Solana account is already connected with the same address
		if (
			state.account !== null &&
			newSolanaAccount?.publicKey &&
			state.account.address === newSolanaAccount.publicKey.toString()
		) {
			// Solana account already connected with the same address
			set({ isAuthenticated: true });
			return;
		}

		if (state.isAuthenticating) {
			// Prevent multiple simultaneous authentication attempts
			return;
		}

		// Set the account first so UI shows connected state
		if (newBaseAccount !== undefined) {
			set({
				account: { address: newBaseAccount.address, chain: "base", provider: newBaseAccount },
			});
		} else if (newSolanaAccount?.publicKey) {
			set({
				account: { address: newSolanaAccount.publicKey.toString(), chain: "solana", provider: newSolanaAccount },
			});
		}

		// First check if we're already authenticated with this wallet
		set({ isAuthenticating: true });

		try {
			const address = newSolanaAccount?.publicKey?.toString() ?? newBaseAccount?.address ?? "";
			const isAlreadyAuthenticated = await state.checkAuthStatus(address);

			let authSuccess = isAlreadyAuthenticated;
			if (!isAlreadyAuthenticated) {
				// Only try to authenticate if this isn't an initial page load reconnection
				// or if user manually clicked connect
				const shouldShowErrors = !state.isInitialLoad;
				authSuccess = await state.authenticate(newBaseAccount, newSolanaAccount, shouldShowErrors);
			}

			set({
				isAuthenticating: false,
				isAuthenticated: authSuccess,
			});

			if (authSuccess) {
				// Invalidate all queries to refetch with new account
				if (state.queryClient) {
					state.queryClient.invalidateQueries();
				}

				// Get LTAI token balance from blockchain
				const ltaiBalance = await state.getLTAIBalance();
				set({ ltaiBalance: ltaiBalance });
				if (newSolanaAccount?.publicKey) {
					const solBalance = await state.getSOLBalance();
					set({ solBalance: solBalance });
				}

				// Fetch chat API key
				const chatApiKey = await state.getChatApiKey();
				set({ chatApiKey });
			}
		} catch (error) {
			console.error("Account change error:", error);
			set({
				isAuthenticating: false,
				isAuthenticated: false,
			});
		} finally {
			// Mark initial load as complete no matter what
			if (state.isInitialLoad) {
				set({ isInitialLoad: false });
			}
		}
	},
	getLTAIBalance: async (): Promise<number> => {
		const state = get();
		let balance: string = "0";

		if (state.account === null) {
			return 0;
		}

		if (state.account.chain === "base") {
			const address = state.account.address.startsWith("0x") ? state.account.address.slice(2) : state.account.address;
			const paddedAddress = address.padStart(64, "0");
			const hexBalanceOfFunction = "0x70a08231";
			const body = {
				jsonrpc: "2.0",
				method: "eth_call",
				params: [
					{
						to: LTAI_BASE_ADDRESS,
						data: `${hexBalanceOfFunction}${paddedAddress}`,
					},
					"latest",
				],
				id: base.id,
			};

			try {
				const response = await fetch("https://mainnet.base.org", {
					method: "POST",
					body: JSON.stringify(body),
					headers: {
						"Content-Type": "application/json",
					},
				});

				const json = await response.json();
				const weiBalance = ethers.getBigInt(json.result);
				balance = ethers.formatEther(weiBalance);
			} catch (error) {
				console.error("Error fetching balance:", error);
			}
		} else if (state.account.chain === "solana") {
			try {
				const body = {
					jsonrpc: "2.0",
					id: 1,
					method: "getTokenAccountsByOwner",
					params: [
						state.account.address,
						{
							mint: env.LTAI_SOLANA_ADDRESS,
						},
						{
							encoding: "jsonParsed",
						},
					],
				};

				const response = await fetch(env.SOLANA_RPC, {
					method: "POST",
					body: JSON.stringify(body),
					headers: {
						"Content-Type": "application/json",
					},
				});
				const json = await response.json();
				let ltaiBalance = 0.0;

				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				json.result.value.forEach((value: any) => {
					ltaiBalance += value.account.data.parsed.info.tokenAmount.uiAmount;
				});
				balance = String(ltaiBalance);
			} catch (error) {
				console.error("Error fetching Solana balance:", error);
			}
		}
		return Number(balance);
	},
	getSOLBalance: async (): Promise<number> => {
		const state = get();
		let balance: string = "0";

		if (state.account === null) {
			return 0;
		}

		try {
			const body = {
				jsonrpc: "2.0",
				id: 1,
				method: "getBalance",
				params: [
					state.account.address,
					{
						encoding: "jsonParsed",
					},
				],
			};

			const response = await fetch(env.SOLANA_RPC, {
				method: "POST",
				body: JSON.stringify(body),
				headers: {
					"Content-Type": "application/json",
				},
			});
			const json = await response.json();
			if (json.result && json.result.value) {
				balance = String(json.result.value / 1e9);
			}
		} catch (error) {
			console.error("Error fetching Solana balance:", error);
		}
		return Number(balance);
	},
	getAPICredits: async (): Promise<number> => {
		// This would typically come from the API after authentication
		// For now we'll return a placeholder value until we implement the proper endpoint
		return 0;
	},
	getChatApiKey: async (): Promise<string | null> => {
		try {
			const response = await getChatApiKeyApiKeysChatGet();
			return response.data?.key || null;
		} catch (error) {
			console.error("Error fetching chat API key:", error);
			return null;
		}
	},
	checkAuthStatus: async (accountAddress: string): Promise<boolean> => {
		try {
			const response = await checkAuthStatusAuthStatusGet();

			return !!(response.data?.authenticated && response.data.address === accountAddress);
		} catch (error) {
			console.error("Auth status check error:", error);
			return false;
		}
	},
	authenticate: async (
		baseAccount: ThirdwebAccount | undefined,
		solanaAccount: SolanaWalletContextState | undefined,
		showErrors?: boolean,
	): Promise<boolean> => {
		const state = get();

		let address: string;
		let chain: "base" | "solana";
		if (baseAccount !== undefined) {
			address = baseAccount.address;
			chain = "base";
		} else if (solanaAccount?.publicKey) {
			address = solanaAccount.publicKey.toString();
			chain = "solana";
		} else {
			console.error("No account provided for authentication");
			if (showErrors) {
				toast.error("Authentication failed", {
					description: "No wallet connected",
				});
			}
			return false;
		}

		try {
			// Get the message to sign
			const messageResponse = await getAuthMessageAuthMessagePost({
				body: {
					chain: chain,
					address: address,
				},
			});

			if (!messageResponse.data?.message) {
				console.error("No message received from server");
				if (showErrors) {
					toast.error("Authentication failed", {
						description: "Could not get message to sign",
					});
				}
				return false;
			}

			// Sign the message
			let signature: string | undefined;
			if (chain === "base" && baseAccount !== undefined) {
				signature = await baseAccount.signMessage({ message: messageResponse.data.message });
			} else if (chain === "solana" && solanaAccount?.signMessage !== undefined) {
				const messageBytes = new TextEncoder().encode(messageResponse.data.message);
				const raw_signature = await solanaAccount.signMessage(messageBytes);

				if (!raw_signature) {
					console.error("No signature generated");
					if (showErrors) {
						toast.error("Authentication failed", {
							description: "Could not sign message",
						});
					}
					return false;
				}

				// Convert signature to base64 for Solana
				signature = Buffer.from(raw_signature).toString("base64");
			}

			if (!signature) {
				console.error("No signature generated");
				if (showErrors) {
					toast.error("Authentication failed", {
						description: "Could not sign message",
					});
				}
				return false;
			}

			// Login with the signature
			const loginResponse = await loginWithWalletAuthLoginPost({
				body: {
					address: address,
					signature: signature,
					chain: chain,
				},
			});

			if (loginResponse.data?.access_token) {
				// Store the JWT token
				set({ isAuthenticated: true });

				// Update API credits
				const apiCredits = await state.getAPICredits();
				set({ apiCredits });

				// Fetch chat API key
				const chatApiKey = await state.getChatApiKey();
				set({ chatApiKey });

				return true;
			} else {
				console.error("No access token received");
				if (showErrors) {
					toast.error("Authentication failed", {
						description: "Invalid response from server",
					});
				}
				return false;
			}
		} catch (error) {
			console.error("Authentication error:", error);

			// Only show toast if we should show errors
			if (showErrors) {
				toast.error("Authentication failed", {
					description: error instanceof Error ? error.message : "Unknown error",
				});
			}
			return false;
		}
	},
	onDisconnect: () => {
		set({
			isAuthenticated: false,
			ltaiBalance: 0,
			solBalance: 0,
			apiCredits: 0,
			chatApiKey: null,
			lastTransactionHash: null,
			isInitialLoad: true,
			account: null,
		});
	},

	setLastTransactionHash: (hash: string | null) => {
		set({ lastTransactionHash: hash });
	},

	setInitialLoadComplete: () => {
		set({ isInitialLoad: false });
	},
}));
