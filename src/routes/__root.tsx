import { createRootRoute, Outlet, useRouterState } from "@tanstack/react-router";
import Providers from "@/components/Providers";
import { Layout } from "@/components/Layout";
import WalletSync from "@/components/WalletSync";

// Routes rendered standalone (full page), without the chat sidebar/header chrome.
const CHROMELESS_ROUTES = ["/login"];

function RootComponent() {
	const pathname = useRouterState({ select: (state) => state.location.pathname });
	const chromeless = CHROMELESS_ROUTES.includes(pathname);

	return (
		<Providers>
			{/* Keeps wallet sessions in sync globally, independent of the header UI */}
			<WalletSync />
			{chromeless ? (
				<Outlet />
			) : (
				<Layout>
					<Outlet />
				</Layout>
			)}
		</Providers>
	);
}

export const Route = createRootRoute({
	component: RootComponent,
});
