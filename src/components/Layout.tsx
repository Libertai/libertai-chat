import { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import ConnectButton from "@/components/ConnectButton";
import { ImageIcon, Plus } from "lucide-react";
import { ConnectedAccountFooter } from "@/components/ConnectedAccountFooter";
import { ChatList } from "@/components/ChatList";
import { ChatSearch } from "@/components/ChatSearch";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarHeader,
	SidebarInset,
	SidebarProvider,
	SidebarTrigger,
	useSidebar,
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

// Component for sidebar logo that can close sidebar on mobile
function SidebarLogoLink() {
	const { isMobile, setOpenMobile } = useSidebar();

	return (
		<Link
			to="/"
			onClick={() => {
				if (isMobile) setOpenMobile(false);
			}}
		>
			<LibertaiLogo className="h-6 w-auto text-foreground" />
		</Link>
	);
}

// New conversation link in sidebar
function SidebarNewConversationLink() {
	const { isMobile, setOpenMobile } = useSidebar();

	return (
		<div className="px-2 py-1">
			<Link
				to="/"
				onClick={() => {
					if (isMobile) setOpenMobile(false);
				}}
				className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg hover:bg-muted transition-colors"
			>
				<Plus className="h-4 w-4" />
				New conversation
			</Link>
		</div>
	);
}

// Images link in sidebar
function SidebarImagesLink() {
	const { isMobile, setOpenMobile } = useSidebar();

	return (
		<div className="px-2 py-1">
			<Link
				to="/images"
				onClick={() => {
					if (isMobile) setOpenMobile(false);
				}}
				className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg hover:bg-muted transition-colors"
			>
				<ImageIcon className="h-4 w-4" />
				Images
			</Link>
		</div>
	);
}

// Desktop header that adapts its width when the sidebar is open
function DesktopHeader() {
	const { open } = useSidebar();
	const sidebarWidth = "16rem";

	return (
		<header
			className="border-b border-border px-4 hidden md:flex items-center justify-between fixed top-0 bg-background z-20 transition-[width,left] duration-300"
			style={{
				paddingTop: "env(safe-area-inset-top)",
				height: "calc(4rem + env(safe-area-inset-top))",
				left: open ? sidebarWidth : 0,
				width: open ? `calc(100% - ${sidebarWidth})` : "100%",
			}}
		>
			<SidebarTrigger />
			<div className="flex items-center gap-4">
				<ConnectButton />
			</div>
		</header>
	);
}

export function Layout({ children }: Readonly<{ children: ReactNode }>) {
	const defaultOpen = getSidebarStateFromCookie();

	return (
		<SidebarProvider defaultOpen={defaultOpen}>
			<div className="min-h-[100svh] bg-background text-foreground flex flex-col md:flex-row w-full">
				{/* Mobile Header */}
				<header
					className="fixed z-20 top-0 left-0 right-0 border-b border-border px-4 flex items-center justify-between md:hidden bg-background"
					style={{ paddingTop: "env(safe-area-inset-top)", height: "calc(4rem + env(safe-area-inset-top))" }}
				>
					<SidebarTrigger />
					<Link to="/" className="absolute left-1/2 transform -translate-x-1/2">
						<LibertaiLogo className="h-4 w-auto text-foreground" />
					</Link>
					<div className="flex items-center gap-2">
						<ConnectButton />
					</div>
				</header>

				{/* Desktop Sidebar */}
				<Sidebar collapsible="offcanvas">
					<SidebarHeader className="font-bold text-xl flex items-center justify-center h-16">
						<SidebarLogoLink />
					</SidebarHeader>

					<SidebarContent>
						<SidebarNewConversationLink />
						<ChatSearch />
						<SidebarImagesLink />
						<ChatList />
					</SidebarContent>

					<SidebarFooter>
						<ConnectedAccountFooter />
					</SidebarFooter>
				</Sidebar>

				<SidebarInset className="w-full">
					{/* Desktop Header */}
					<DesktopHeader />

					{/* Main content */}
					<main
						className="flex-1 overflow-auto w-full"
						style={{
							marginTop: "calc(4rem + env(safe-area-inset-top))",
							paddingBottom: "env(safe-area-inset-bottom)",
						}}
					>
						{children}
					</main>
				</SidebarInset>
			</div>
		</SidebarProvider>
	);
}
