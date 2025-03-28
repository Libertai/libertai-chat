import { ReactNode } from "react";
import { ThemeToggle } from "./ThemeToggle";
import { Link, useRouter } from "@tanstack/react-router";
import AccountButton from "./AccountButton";
import { Coins, Key, LayoutDashboard, LineChart, PieChart } from "lucide-react";
import {
	Sidebar,
	SidebarContent,
	SidebarHeader,
	SidebarInset,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarProvider,
	SidebarTrigger,
} from "./ui/sidebar";

interface LayoutProps {
	children: ReactNode;
}

export function Layout({ children }: Readonly<LayoutProps>) {
	const router = useRouter();
	const currentPath = router.state.location.pathname;

	return (
		<SidebarProvider defaultOpen={true}>
			<div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row w-full">
				{/* Mobile Header */}
				<header className="fixed z-20 top-0 left-0 right-0 h-16 border-b border-border px-4 flex items-center justify-between md:hidden bg-background">
					<SidebarTrigger />
					<div className="font-bold text-lg">LibertAI</div>
					<div className="flex items-center gap-2">
						<ThemeToggle />
						<AccountButton />
					</div>
				</header>

				{/* Desktop Sidebar */}
				<Sidebar variant="inset">
					<SidebarHeader className="font-bold text-xl h-16 flex items-center justify-between">
						<div>LibertAI</div>
					</SidebarHeader>

					<SidebarContent>
						<SidebarMenu>
							<SidebarMenuItem>
								<Link to="/">
									<SidebarMenuButton tooltip="Home" isActive={currentPath === "/"}>
										<LayoutDashboard className="h-4 w-4" />
										<span>Home</span>
									</SidebarMenuButton>
								</Link>
							</SidebarMenuItem>

							<SidebarMenuItem>
								<Link to="/dashboard">
									<SidebarMenuButton tooltip="Dashboard" isActive={currentPath === "/dashboard"}>
										<PieChart className="h-4 w-4" />
										<span>Dashboard</span>
									</SidebarMenuButton>
								</Link>
							</SidebarMenuItem>

							<SidebarMenuItem>
								<Link to="/api-keys">
									<SidebarMenuButton tooltip="API Keys" isActive={currentPath === "/api-keys"}>
										<Key className="h-4 w-4" />
										<span>API Keys</span>
									</SidebarMenuButton>
								</Link>
							</SidebarMenuItem>

							<SidebarMenuItem>
								<Link to="/usage">
									<SidebarMenuButton tooltip="Usage" isActive={currentPath === "/usage"}>
										<LineChart className="h-4 w-4" />
										<span>Usage</span>
									</SidebarMenuButton>
								</Link>
							</SidebarMenuItem>

							<SidebarMenuItem>
								<Link to="/topup">
									<SidebarMenuButton tooltip="Top Up" isActive={currentPath === "/topup"}>
										<Coins className="h-4 w-4" />
										<span>Top Up</span>
									</SidebarMenuButton>
								</Link>
							</SidebarMenuItem>
						</SidebarMenu>
					</SidebarContent>
				</Sidebar>

				<SidebarInset className="w-full">
					{/* Desktop Header */}
					<header className="h-16 border-b border-border px-4 hidden md:flex items-center justify-end">
						<div className="flex items-center gap-4">
							<ThemeToggle />
							<AccountButton />
						</div>
					</header>

					{/* Main content with padding on mobile for the fixed header */}
					<main className="flex-1 overflow-auto md:pt-0 pt-16 w-full">{children}</main>
				</SidebarInset>
			</div>
		</SidebarProvider>
	);
}
