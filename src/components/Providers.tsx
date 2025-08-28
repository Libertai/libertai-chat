import { ReactNode, useEffect } from "react";
import { ThirdwebProvider } from "thirdweb/react";
import { ThemeProvider } from "./ThemeProvider";
import { Toaster } from "./ui/sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NuqsAdapter } from "nuqs/adapters/react";
import { SolanaProvider } from "./SolanaProvider";
import { useAccountStore } from "@/stores/account";

type ProvidersProps = {
	children: ReactNode;
};

// Create a client
const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			staleTime: 5 * 60 * 1000, // 5 minutes
		},
	},
});

const QueryClientInitializer = ({ children }: { children: ReactNode }) => {
	const setQueryClient = useAccountStore((state) => state.setQueryClient);

	useEffect(() => {
		setQueryClient(queryClient);
	}, [setQueryClient]);

	return <>{children}</>;
};

const Providers = ({ children }: ProvidersProps) => {
	return (
		<NuqsAdapter>
			<ThemeProvider defaultTheme="system" storageKey="libertai-ui-theme">
				<QueryClientProvider client={queryClient}>
					<QueryClientInitializer>
						<SolanaProvider>
							<ThirdwebProvider>{children}</ThirdwebProvider>
						</SolanaProvider>
					</QueryClientInitializer>
					<Toaster richColors />
				</QueryClientProvider>
			</ThemeProvider>
		</NuqsAdapter>
	);
};

export default Providers;
