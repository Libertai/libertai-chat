import { useEffect, useState } from "react";
import { thirdwebClient } from "@/config/thirdweb";
import { resolveAvatar, resolveName, resolveText } from "thirdweb/extensions/ens";

interface ENSData {
	name: string | null;
	displayName: string | null;
	avatar: string | null;
	isLoading: boolean;
}

export function useENS(address: string | undefined, chainId?: number): ENSData {
	const [ensData, setENSData] = useState<ENSData>({
		name: null,
		displayName: null,
		avatar: null,
		isLoading: false,
	});

	useEffect(() => {
		if (!address) {
			setENSData({ name: null, displayName: null, avatar: null, isLoading: false });
			return;
		}

		// Only resolve ENS for Ethereum addresses (not Solana)
		// Check if it looks like an Ethereum address (starts with 0x and is 42 chars)
		const isEthAddress = address.startsWith("0x") && address.length === 42;
		if (!isEthAddress) {
			setENSData({ name: null, displayName: null, avatar: null, isLoading: false });
			return;
		}

		const resolveENS = async () => {
			setENSData((prev) => ({ ...prev, isLoading: true }));

			try {
				// Resolve ENS name from address
				const ensName = await resolveName({
					client: thirdwebClient,
					address,
				}).catch(() => null);

				let ensAvatar: string | null = null;
				let displayName: string | null = null;

				if (ensName) {
					// Resolve avatar if ENS name exists
					ensAvatar = await resolveAvatar({
						client: thirdwebClient,
						name: ensName,
					}).catch(() => null);

					// Resolve name text record
					displayName = await resolveText({
						client: thirdwebClient,
						name: ensName,
						key: "name",
					}).catch(() => null);
				}

				setENSData({
					name: ensName,
					displayName: displayName,
					avatar: ensAvatar,
					isLoading: false,
				});
			} catch (error) {
				console.error("Error resolving ENS:", error);
				setENSData({
					name: null,
					displayName: null,
					avatar: null,
					isLoading: false,
				});
			}
		};

		resolveENS();
	}, [address, chainId]);

	return ensData;
}
