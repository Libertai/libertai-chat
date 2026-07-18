import { ReactNode } from "react";
import { ThemeProvider } from "./ThemeProvider";
import { Toaster } from "@libertai/ui/sonner";
import { QueryClientProvider } from "@tanstack/react-query";
import { NuqsAdapter } from "nuqs/adapters/react";
import { LibertaiProviders } from "@libertai/auth";
import { queryClient } from "@/lib/query-client";

type ProvidersProps = {
	children: ReactNode;
};

const Providers = ({ children }: ProvidersProps) => {
	return (
		<NuqsAdapter>
			<ThemeProvider defaultTheme="system" storageKey="libertai-ui-theme">
				<QueryClientProvider client={queryClient}>
					<LibertaiProviders>{children}</LibertaiProviders>
					<Toaster richColors />
				</QueryClientProvider>
			</ThemeProvider>
		</NuqsAdapter>
	);
};

export default Providers;
