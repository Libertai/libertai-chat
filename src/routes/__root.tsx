import { createRootRoute, Outlet } from "@tanstack/react-router";
import Providers from "@/components/Providers";
import { Layout } from "@/components/Layout";
import WalletSync from "@/components/WalletSync";

export const Route = createRootRoute({
	component: () => (
		<Providers>
			{/* Keeps wallet sessions in sync globally, independent of the header UI */}
			<WalletSync />
			<Layout>
				<Outlet />
			</Layout>
		</Providers>
	),
});
