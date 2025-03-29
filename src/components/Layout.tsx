import { ReactNode, useEffect, useState } from "react";
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
	useSidebar,
} from "./ui/sidebar";

interface LayoutProps {
	children: ReactNode;
}

// Component that wraps menu items to auto-close sidebar on mobile
function SidebarMenuItemWithAutoClose({
	to,
	tooltip,
	isActive,
	icon,
	label,
}: {
	to: string;
	tooltip: string;
	isActive: boolean;
	icon: React.ReactNode;
	label: string;
}) {
	const { isMobile, setOpenMobile } = useSidebar();

	const handleClick = () => {
		if (isMobile) {
			setOpenMobile(false);
		}
	};

	return (
		<SidebarMenuItem>
			<Link to={to} onClick={handleClick}>
				<SidebarMenuButton tooltip={tooltip} isActive={isActive}>
					{icon}
					<span>{label}</span>
				</SidebarMenuButton>
			</Link>
		</SidebarMenuItem>
	);
}

export function Layout({ children }: Readonly<LayoutProps>) {
	const router = useRouter();
	const [currentPath, setCurrentPath] = useState(router.state.location.pathname);

	// Update the current path whenever the route changes
	useEffect(() => {
		// Initial state
		setCurrentPath(router.state.location.pathname);

		// Subscribe to route changes
		const unsubscribe = router.subscribe("onResolved", () => {
			setCurrentPath(router.state.location.pathname);
		});

		// Cleanup subscription on unmount
		return () => {
			unsubscribe();
		};
	}, [router]);

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
						<Link to={"/"}>
							<div>LibertAI</div>
						</Link>
					</SidebarHeader>

					<SidebarContent>
						<SidebarMenu>
							<SidebarMenuItemWithAutoClose
								to="/"
								tooltip="Home"
								isActive={currentPath === "/"}
								icon={<LayoutDashboard className="h-4 w-4" />}
								label="Home"
							/>

							<SidebarMenuItemWithAutoClose
								to="/dashboard"
								tooltip="Dashboard"
								isActive={currentPath === "/dashboard"}
								icon={<PieChart className="h-4 w-4" />}
								label="Dashboard"
							/>

							<SidebarMenuItemWithAutoClose
								to="/api-keys"
								tooltip="API Keys"
								isActive={currentPath === "/api-keys"}
								icon={<Key className="h-4 w-4" />}
								label="API Keys"
							/>

							<SidebarMenuItemWithAutoClose
								to="/usage"
								tooltip="Usage"
								isActive={currentPath === "/usage"}
								icon={<LineChart className="h-4 w-4" />}
								label="Usage"
							/>

							<SidebarMenuItemWithAutoClose
								to="/topup"
								tooltip="Top Up"
								isActive={currentPath === "/topup"}
								icon={<Coins className="h-4 w-4" />}
								label="Top Up"
							/>
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
