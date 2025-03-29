import { ReactNode } from "react";
import { ThirdwebProvider } from "thirdweb/react";
import { ThemeProvider } from "./ThemeProvider";
import { Toaster } from "./ui/sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

type ProvidersProps = {
	children: ReactNode;
};

// Create a client
const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			staleTime: 5 * 60 * 1000, // 5 minutes
			refetchOnWindowFocus: false,
		},
	},
});

const Providers = ({ children }: ProvidersProps) => {
	return (
		<ThemeProvider defaultTheme="system" storageKey="libertai-ui-theme">
			<QueryClientProvider client={queryClient}>
				<ThirdwebProvider>{children}</ThirdwebProvider>
				<Toaster richColors />
			</QueryClientProvider>
		</ThemeProvider>
	);
};

export default Providers;
