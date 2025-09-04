import { ReactNode, useEffect, useState } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Link, useRouter } from "@tanstack/react-router";
import ConnectButton from "@/components/ConnectButton";
import { Button } from "@/components/ui/button";
import { Edit } from "lucide-react";
import { ConnectedAccountFooter } from "@/components/ConnectedAccountFooter";
import { ChatList } from "@/components/ChatList";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarHeader,
	SidebarInset,
	SidebarProvider,
	SidebarTrigger,
} from "@/components/ui/sidebar";
import { LibertaiLogo } from "@/components/LibertaiLogo.tsx";

// Helper function to read sidebar state from cookie
function getSidebarStateFromCookie(): boolean {
	const cookies = document.cookie.split(";");
	for (const cookie of cookies) {
		const [name, value] = cookie.trim().split("=");
		if (name === "sidebar_state") {
			return value === "true";
		}
	}
	return false; // Default to closed if no cookie found
}

export function Layout({ children }: Readonly<{ children: ReactNode }>) {
	const router = useRouter();
	const [currentPath, setCurrentPath] = useState(router.state.location.pathname);

	const defaultOpen = getSidebarStateFromCookie();

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
		<SidebarProvider defaultOpen={defaultOpen}>
			<div className="min-h-[100svh] bg-background text-foreground flex flex-col md:flex-row w-full">
				{/* Mobile Header */}
				<header className="fixed z-20 top-0 left-0 right-0 h-16 border-b border-border px-4 flex items-center justify-between md:hidden bg-background">
					<SidebarTrigger />
					<Link to="/" className="absolute left-1/2 transform -translate-x-1/2">
						<LibertaiLogo className="h-6 w-auto text-foreground" />
					</Link>
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
					<SidebarHeader className="font-bold text-xl h-16 flex items-center justify-center">
						<Link to="/">
							<LibertaiLogo className="h-6 w-auto text-foreground" />
						</Link>
					</SidebarHeader>

					<SidebarContent>
						<ChatList />
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

					{/* Main content */}
					<main className="flex-1 overflow-auto w-full mt-16 md:mt-0">{children}</main>
				</SidebarInset>
			</div>
		</SidebarProvider>
	);
}
