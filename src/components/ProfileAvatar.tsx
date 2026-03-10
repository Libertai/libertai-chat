import { useEffect, useState } from "react";

interface ProfileAvatarProps {
	src?: string | null;
	address?: string;
	size?: "sm" | "md" | "lg";
}

export function ProfileAvatar({ src, address, size = "md" }: Readonly<ProfileAvatarProps>) {
	const fallbackSrc = `https://effigy.im/a/${address}.svg`;
	const [imgSrc, setImgSrc] = useState(src ?? fallbackSrc);

	useEffect(() => {
		setImgSrc(src ?? fallbackSrc);
	}, [src, fallbackSrc]);

	const sizeClasses = {
		sm: "w-6 h-6",
		md: "w-8 h-8",
		lg: "w-12 h-12",
	};

	return (
		<img
			src={imgSrc}
			alt="Profile"
			className={`${sizeClasses[size]} rounded-full object-cover`}
			onError={() => setImgSrc(fallbackSrc)}
		/>
	);
}
