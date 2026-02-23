import { useEffect, useRef, useState, RefObject } from "react";
import { ChevronDown, ChevronLeft, LayoutDashboard, Plus } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAssistantStore } from "@/stores/assistant";
import type { Assistant } from "@/stores/assistant";
import { CustomAdvisorForm } from "@/components/CustomAdvisorForm";

interface AssistantSelectorProps {
	assistant: Assistant;
	disabled?: boolean;
	containerRef: RefObject<HTMLDivElement | null>;
}

export function AssistantSelector({ assistant, disabled = false, containerRef }: Readonly<AssistantSelectorProps>) {
	const navigate = useNavigate();
	const triggerRef = useRef<HTMLButtonElement>(null);
	const [dropdownAlignOffset, setDropdownAlignOffset] = useState(0);
	const [showCustomAdvisors, setShowCustomAdvisors] = useState(false);
	const { assistants, customAssistants, setSelectedAssistant } = useAssistantStore();

	useEffect(() => {
		const calculateOffset = () => {
			if (containerRef.current && triggerRef.current) {
				const Rect = containerRef.current.getBoundingClientRect();
				const trigger = triggerRef.current.getBoundingClientRect();
				const offset = -(trigger.left - Rect.left);

				setDropdownAlignOffset(offset);
			}
		};

		calculateOffset();
		window.addEventListener("resize", calculateOffset);
		return () => window.removeEventListener("resize", calculateOffset);
	}, [containerRef]);

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild disabled={disabled}>
				<Button
					ref={triggerRef}
					variant="ghost"
					size="sm"
					className="h-8 rounded-full border border-card dark:border-hover text-foreground px-3 gap-2"
					disabled={disabled}
				>
					<span className="text-sm font-medium">{assistant.title}</span>
					<ChevronDown className="h-3.5 w-3.5" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				align="start"
				side="top"
				sideOffset={56}
				alignOffset={dropdownAlignOffset}
				className="max-h-[400px] overflow-y-auto"
				style={{
					width: containerRef.current?.offsetWidth ? `${containerRef.current.offsetWidth}px` : "auto",
				}}
				onCloseAutoFocus={() => setShowCustomAdvisors(false)}
			>
				{!showCustomAdvisors ? (
					<>
						{assistants
							.filter((a) => !a.hidden)
							.map((item) => {
								const isSelected = assistant.id === item.id;
								return (
									<DropdownMenuItem
										key={item.id}
										onClick={() => !item.disabled && setSelectedAssistant(item.id)}
										className={`p-3 cursor-pointer ${isSelected ? "bg-hover" : ""} ${
											item.disabled ? "opacity-50 cursor-not-allowed" : ""
										}`}
										disabled={item.disabled}
									>
										<div className="flex items-center gap-3 w-full">
											<div
												className={`rounded-full p-2 flex-shrink-0 ${isSelected ? "bg-background" : "bg-hover"}`}
											>
												{item.icon}
											</div>

											<div className="flex-1 min-w-0">
												<div className="font-medium text-sm">{item.title}</div>
												<p className="text-xs text-muted-foreground">{item.subtitle}</p>
											</div>

											{(item.pro || item.badge) && (
												<div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
													{item.pro && (
														<span className="bg-primary text-white text-xs px-2 py-0.5 rounded-full whitespace-nowrap">
															Pro
														</span>
													)}
													{item.badge && (
														<span className="text-foreground text-xs px-2 py-0.5 rounded-full border border-foreground whitespace-nowrap">
															{item.badge}
														</span>
													)}
												</div>
											)}
										</div>
									</DropdownMenuItem>
								);
							})}

						<DropdownMenuSeparator />

						<DropdownMenuItem
							className="p-3 cursor-pointer"
							onClick={() => setShowCustomAdvisors(true)}
							onSelect={(e) => e.preventDefault()}
						>
							<div className="flex items-center gap-3 w-full">
								<div className="rounded-full p-2 flex-shrink-0 bg-hover">
									<LayoutDashboard className="h-6 w-6" />
								</div>

								<div className="flex-1 min-w-0">
									<div className="font-medium text-sm">Custom Advisors</div>
									<p className="text-xs text-muted-foreground">Your very own creations</p>
								</div>
							</div>
						</DropdownMenuItem>
					</>
				) : (
					<>
						<DropdownMenuItem
							className="p-3 cursor-pointer border-b border-border"
							onClick={() => setShowCustomAdvisors(false)}
							onSelect={(e) => e.preventDefault()}
						>
							<div className="flex items-center gap-2">
								<ChevronLeft className="h-5 w-5" />
								<span className="font-medium text-sm">Back</span>
							</div>
						</DropdownMenuItem>

						{customAssistants.map((item) => {
							const isSelected = assistant.id === item.id;
							return (
								<DropdownMenuItem
									key={item.id}
									onClick={() => setSelectedAssistant(item.id)}
									className={`p-3 cursor-pointer ${isSelected ? "bg-hover" : ""}`}
								>
									<div className="flex items-center gap-3 w-full">
										<div
											className={`rounded-full p-2 flex-shrink-0 ${isSelected ? "bg-background" : "bg-hover"} overflow-hidden`}
										>
											{item.imageUrl ? (
												<img src={item.imageUrl} alt={item.title} className="h-6 w-6 object-cover" />
											) : (
												item.icon
											)}
										</div>

										<div className="flex-1 min-w-0">
											<div className="font-medium text-sm">{item.title}</div>
											<p className="text-xs text-muted-foreground truncate">{item.subtitle}</p>
										</div>

										<div className="flex-shrink-0">
											<span className="text-xs text-muted-foreground">{item.model}</span>
										</div>
									</div>
								</DropdownMenuItem>
							);
						})}

						{customAssistants.length === 0 && (
							<div className="p-6 text-center text-sm text-muted-foreground">No custom advisors yet</div>
						)}

						<DropdownMenuSeparator />

						<DropdownMenuItem className="p-3 cursor-pointer" onClick={() => navigate({ to: "/custom-advisors" })}>
							<div className="flex items-center gap-3 w-full">
								<div className="rounded-full p-2 flex-shrink-0 bg-primary/10">
									<Plus className="h-6 w-6 text-primary" />
								</div>
								<div className="flex-1">
									<div className="font-medium text-sm">Create New</div>
								</div>
							</div>
						</DropdownMenuItem>
					</>
				)}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

export function NewCustomAdvisor() {
	return <CustomAdvisorForm />;
}
