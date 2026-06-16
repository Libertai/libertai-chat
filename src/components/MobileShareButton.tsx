import { Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { isMobileBetaApp } from "@/lib/mobile-runtime";
import { shareCurrentMobilePage } from "@/lib/mobile-share";

export function MobileShareButton() {
	if (!isMobileBetaApp()) return null;

	const handleShare = async () => {
		try {
			await shareCurrentMobilePage();
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Unable to share this view.");
		}
	};

	return (
		<Button variant="ghost" size="icon" onClick={() => void handleShare()} aria-label="Share">
			<Share2 className="h-4 w-4" />
		</Button>
	);
}
