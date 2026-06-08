import { useEffect, useState } from "react";
import { CircleUser } from "lucide-react";

interface ProfileAvatarProps {
	src?: string | null;
	address?: string;
	size?: "sm" | "md" | "lg";
}

const sizeClasses = {
	sm: "w-6 h-6",
	md: "w-8 h-8",
	lg: "w-12 h-12",
};

export function ProfileAvatar({ src, address, size = "md" }: Readonly<ProfileAvatarProps>) {
	// effigy renders a blockie from an Ethereum address; only usable when we actually have one.
	const addressFallback = address ? `https://effigy.im/a/${address}.svg` : null;
	const initial = src ?? addressFallback;
	const [imgSrc, setImgSrc] = useState<string | null>(initial);

	useEffect(() => {
		setImgSrc(initial);
	}, [initial]);

	// No avatar URL and no wallet address (e.g. an email/OAuth user with no picture) — render a generic
	// icon instead of a broken <img> pointing at effigy with an "undefined" address.
	if (!imgSrc) {
		return <CircleUser className={`${sizeClasses[size]} text-muted-foreground`} />;
	}

	return (
		<img
			src={imgSrc}
			alt="Profile"
			className={`${sizeClasses[size]} rounded-full object-cover`}
			onError={() => setImgSrc(addressFallback)}
		/>
	);
}
