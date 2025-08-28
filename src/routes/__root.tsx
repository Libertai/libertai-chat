import { createRootRoute, Outlet } from "@tanstack/react-router";
import Providers from "@/components/Providers";
import { Layout } from "@/components/Layout";
import { Bot, Coins, CreditCard, Key, LayoutDashboard, LineChart, PieChart, Receipt } from "lucide-react";

const developersSidebarItems = [
	{ to: "/", icon: <LayoutDashboard className="h-4 w-4" />, label: "Home" },
	{ to: "/dashboard", icon: <PieChart className="h-4 w-4" />, label: "Dashboard" },
	{
		to: "/agents",
		icon: <Bot className="h-4 w-4" />,
		label: "Agents",
		badge: (
			<span className="px-1.5 py-0.5 text-[10px] font-medium bg-primary text-primary-foreground rounded-full ml-auto">
				NEW
			</span>
		),
	},
	{ to: "/api-keys", icon: <Key className="h-4 w-4" />, label: "API Keys" },
	{ to: "/usage", icon: <LineChart className="h-4 w-4" />, label: "Usage" },
	{ to: "/subscriptions", icon: <CreditCard className="h-4 w-4" />, label: "Subscriptions" },
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
