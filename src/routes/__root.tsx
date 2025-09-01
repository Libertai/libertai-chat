import { createRootRoute, Outlet } from "@tanstack/react-router";
import Providers from "@/components/Providers";
import { Layout } from "@/components/Layout";
import { Coins, LayoutDashboard, Receipt } from "lucide-react";

const developersSidebarItems = [
	{ to: "/", icon: <LayoutDashboard className="h-4 w-4" />, label: "Home" },
	{ to: "/transactions", icon: <Receipt className="h-4 w-4" />, label: "Transactions" },
	{ to: "/top-up", icon: <Coins className="h-4 w-4" />, label: "Top Up" },
];

export const Route = createRootRoute({
	component: () => (
		<Providers>
			<Layout sidebarItems={developersSidebarItems}>
				<Outlet />
			</Layout>
		</Providers>
	),
});
