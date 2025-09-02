import { ReactNode, useEffect, useState } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Link, useRouter } from "@tanstack/react-router";
import ConnectButton from "@/components/ConnectButton";
import { Button } from "@/components/ui/button";
import { Edit } from "lucide-react";
import { ConnectedAccountFooter } from "@/components/ConnectedAccountFooter";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarHeader,
	SidebarInset,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarProvider,
	SidebarTrigger,
	useSidebar,
} from "@/components/ui/sidebar";

// Component that wraps menu items to auto-close sidebar on mobile
function SidebarMenuItemWithAutoClose({
	to,
	tooltip,
	isActive,
	icon,
	label,
	badge,
}: Readonly<{
	to: string;
	tooltip: string;
	isActive: boolean;
	icon: ReactNode;
	label: string;
	badge?: ReactNode;
}>) {
	const { isMobile, setOpenMobile } = useSidebar();

	const handleClick = () => {
		if (isMobile) {
			setOpenMobile(false);
		}
	};

	return (
		<SidebarMenuItem>
			<Link to={to} onClick={handleClick} disabled={isActive}>
				<SidebarMenuButton tooltip={tooltip} isActive={isActive}>
					{icon}
					<span>
						{label} {badge ? <span className="ml-2">{badge}</span> : null}
					</span>
				</SidebarMenuButton>
			</Link>
		</SidebarMenuItem>
	);
}

type SidebarItem = {
	to: string;
	icon: ReactNode;
	label: string;
	badge?: ReactNode;
};

export function Layout({
	children,
	sidebarItems,
}: Readonly<{
	children: ReactNode;
	sidebarItems: SidebarItem[];
}>) {
	const router = useRouter();
	const [currentPath, setCurrentPath] = useState(router.state.location.pathname);

	// Check if we're on a chat page
	const isOnChatPage = currentPath.startsWith("/chat/");

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
		<SidebarProvider defaultOpen={false}>
			<div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row w-full">
				{/* Mobile Header */}
				<header className="fixed z-20 top-0 left-0 right-0 h-16 border-b border-border px-4 flex items-center justify-between md:hidden bg-background">
					<SidebarTrigger />
					<div className="flex items-center gap-2">
						{isOnChatPage && (
							<Link to="/">
								<Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
									<Edit className="h-4 w-4" />
								</Button>
							</Link>
						)}
						<ThemeToggle />
						<ConnectButton />
					</div>
				</header>

				{/* Desktop Sidebar */}
				<Sidebar collapsible="offcanvas">
					<SidebarHeader className="font-bold text-xl h-16 flex items-center justify-between">
						<Link to={"/"}>
							<div>LibertAI</div>
						</Link>
					</SidebarHeader>

					<SidebarContent>
						<SidebarMenu>
							{sidebarItems.map((item) => (
								<SidebarMenuItemWithAutoClose
									to={item.to}
									tooltip={item.label}
									isActive={currentPath === item.to}
									icon={item.icon}
									label={item.label}
									badge={item.badge}
									key={item.to}
								/>
							))}
						</SidebarMenu>
					</SidebarContent>

					<SidebarFooter>
						<ConnectedAccountFooter />
					</SidebarFooter>
				</Sidebar>

				<SidebarInset className="w-full">
					{/* Desktop Header */}
					<header className="h-16 border-b border-border px-4 hidden md:flex items-center justify-between">
						<SidebarTrigger />
						<div className="flex items-center gap-4">
							{isOnChatPage && (
								<Link to="/">
									<Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
										<Edit className="h-4 w-4" />
									</Button>
								</Link>
							)}
							<ThemeToggle />
							<ConnectButton />
						</div>
					</header>

					{/* Main content with padding on mobile for the fixed header */}
					<main className="flex-1 overflow-auto md:pt-0 pt-16 w-full">{children}</main>
				</SidebarInset>
			</div>
		</SidebarProvider>
	);
}
