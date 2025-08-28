// 404 Page Component
import { Button } from "@/components/ui/button.tsx";

export const NotFoundPage = () => {
	return (
		<div className="container flex flex-col items-center justify-center min-h-[80vh] max-w-md text-center mx-auto px-4 py-16">
			<div className="space-y-6">
				<div className="space-y-2">
					<h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl text-primary">404</h1>
					<h2 className="text-2xl font-bold tracking-tight">Page Not Found</h2>
					<p className="text-muted-foreground">
						We couldn't find the page you're looking for. The page may have been moved or deleted.
					</p>
				</div>
				<div className="flex justify-center">
					<Button asChild>
						<a href="/">
							<span className="mr-2">←</span>
							Go back home
						</a>
					</Button>
				</div>
			</div>
		</div>
	);
};
