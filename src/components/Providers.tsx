"use client";

import { ReactNode } from "react";
import { ThirdwebProvider } from "thirdweb/react";

const WalletProviders = ({ children }: { children: ReactNode }) => {
	return <ThirdwebProvider>{children}</ThirdwebProvider>;
};

export default WalletProviders;
