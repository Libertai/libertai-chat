import { createRootRoute, Outlet } from "@tanstack/react-router";
import Providers from "@/components/Providers";
import { Layout } from "@/components/Layout";

export const Route = createRootRoute({
	component: () => (
		<Providers>
			<Layout>
				<Outlet />
			</Layout>
		</Providers>
	),
});
