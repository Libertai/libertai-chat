import { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import ConnectButton from "@/components/ConnectButton";
import { FolderOpen, ImageIcon, Plus, Sparkles, SquareTerminal } from "lucide-react";
import { useAccountStore } from "@libertai/auth";
import { ClawIcon } from "@/components/ClawIcon";
import { ConnectedAccountFooter } from "@/components/ConnectedAccountFooter";
import { ChatList } from "@/components/ChatList";
import { ChatSearch } from "@/components/ChatSearch";
import { ProjectDialogs } from "@/components/ProjectDialogs";
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
import { LibertaiLogo } from "@libertai/branding";

// Helper function to read sidebar state from cookie
function getSidebarStateFromCookie(): boolean {
	const cookies = document.cookie.split(";");
	for (const cookie of cookies) {
		const [name, value] = cookie.trim().split("=");
		if (name === "sidebar_state") {
			return value === "true";
		}
	}
	return true; // Default to OPEN on desktop when no cookie yet (mobile uses openMobile, stays closed)
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

// Projects nav link in sidebar
function SidebarProjectsLink() {
	const { isMobile, setOpenMobile } = useSidebar();
	return (
		<div className="px-2 py-1">
			<Link
				to="/projects"
				onClick={() => {
					if (isMobile) setOpenMobile(false);
				}}
				className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg hover:bg-muted transition-colors"
				data-testid="nav-projects"
			>
				<FolderOpen className="h-4 w-4" />
				Projects
			</Link>
		</div>
	);
}

// Products section in the sidebar
function SidebarProducts() {
	const { isMobile, setOpenMobile } = useSidebar();
	const closeOnMobile = () => {
		if (isMobile) setOpenMobile(false);
	};
	const itemClass = "flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg hover:bg-muted transition-colors";

	return (
		<div className="px-2 py-2">
			<h3 className="px-3 mb-2 text-sm font-medium text-muted-foreground">Products</h3>
			<div className="space-y-0.5">
				<Link to="/images" onClick={closeOnMobile} className={itemClass}>
					<ImageIcon className="h-4 w-4" />
					Images
				</Link>
				<a
					href="https://console.libertai.io"
					target="_blank"
					rel="noopener noreferrer"
					onClick={closeOnMobile}
					className={itemClass}
				>
					<SquareTerminal className="h-4 w-4" />
					Console
				</a>
				<a
					href="https://liberclaw.ai"
					target="_blank"
					rel="noopener noreferrer"
					onClick={closeOnMobile}
					className={itemClass}
				>
					<ClawIcon className="h-4 w-4" />
					LiberClaw
				</a>
			</div>
		</div>
	);
}

// "See plans and pricing" — shown only to signed-out visitors (ChatGPT-style). Signed-in users
// reach plans/upgrade via the account menu and the header Upgrade button.
function SidebarPlansLink() {
	const isAuthenticated = useAccountStore((state) => state.isAuthenticated);
	const { isMobile, setOpenMobile } = useSidebar();

	if (isAuthenticated) return null;

	return (
		<div className="px-2 py-1">
			<Link
				to="/plans"
				onClick={() => {
					if (isMobile) setOpenMobile(false);
				}}
				className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg hover:bg-muted transition-colors"
				data-testid="nav-plans"
			>
				<Sparkles className="h-4 w-4" />
				See plans and pricing
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
						<SidebarProjectsLink />
						<ChatSearch />
						<SidebarProducts />
						<ChatList />
					</SidebarContent>

					<SidebarFooter>
						<SidebarPlansLink />
						<ConnectedAccountFooter />
					</SidebarFooter>
				</Sidebar>

				<SidebarInset className="w-full">
					{/* Desktop Header */}
					<DesktopHeader />

					{/* Main content */}
					<main
						className="overflow-auto w-full"
						style={{
							marginTop: "calc(4rem + env(safe-area-inset-top))",
							// Bound the scroll area to the space below the fixed header so it (not the whole
							// document) scrolls. Lets routes use h-full to pin elements like the chat input.
							height: "calc(100svh - 4rem - env(safe-area-inset-top))",
							paddingBottom: "env(safe-area-inset-bottom)",
						}}
					>
						{children}
					</main>
				</SidebarInset>
				<ProjectDialogs />
			</div>
		</SidebarProvider>
	);
}
