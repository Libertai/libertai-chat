import Image, { ImageProps } from "next/image";

const SvgIcon = ({
	width = 24,
	height = 24,
	path,
	...props
}: {
	width?: number;
	height?: number;
	path: string;
	props?: ImageProps;
}) => {
	return <Image src={path} width={width} height={height} alt="Icon" {...props} />;
};

export default SvgIcon;
