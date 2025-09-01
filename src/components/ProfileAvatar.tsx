interface ProfileAvatarProps {
	src?: string | null;
	address?: string;
	size?: "sm" | "md" | "lg";
}

export function ProfileAvatar({ src, address, size = "md" }: Readonly<ProfileAvatarProps>) {
	const sizeClasses = {
		sm: "w-6 h-6",
		md: "w-8 h-8",
		lg: "w-12 h-12",
	};

	return (
		<img
			src={src ?? `https://avatars.jakerunzer.com/${address}`}
			alt="Profile"
			className={`${sizeClasses[size]} rounded-full object-cover`}
		/>
	);
}
