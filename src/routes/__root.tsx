import { createRootRoute, Outlet, useRouterState } from "@tanstack/react-router";
import Providers from "@/components/Providers";
import { Layout } from "@/components/Layout";
import WalletSync from "@/components/WalletSync";

// Routes rendered standalone (full page), without the chat sidebar/header chrome.
const CHROMELESS_ROUTES = ["/login"];

function RootComponent() {
	// Derive chrome from the *rendered* matches, not state.location: the location flips to
	// the target as soon as navigation starts, while <Outlet /> keeps rendering the previous
	// route until its lazy chunk loads — keying on location would unmount the Layout around
	// the old page for a frame (first-visit flash when navigating to /login).
	const chromeless = useRouterState({
		select: (state) => state.matches.some((match) => CHROMELESS_ROUTES.includes(match.pathname)),
	});

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
