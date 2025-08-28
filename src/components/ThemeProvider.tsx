import { createContext, ReactNode, useContext, useEffect, useState } from "react";

type ThemeProviderProps = {
	children: ReactNode;
	defaultTheme?: "dark" | "light" | "system";
	storageKey?: string;
};

type ThemeProviderState = {
	theme: "dark" | "light";
	setTheme: (theme: "dark" | "light" | "system") => void;
};

const initialState: ThemeProviderState = {
	theme: "light",
	setTheme: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

export function ThemeProvider({
	children,
	defaultTheme = "system",
	storageKey = "libertai-ui-theme",
	...props
}: Readonly<ThemeProviderProps>) {
	const [theme, setTheme] = useState<"light" | "dark">(
		() =>
			(localStorage.getItem(storageKey) as "light" | "dark") ||
			(defaultTheme === "system" ? getSystemTheme() : defaultTheme),
	);

	useEffect(() => {
		const root = window.document.documentElement;
		root.classList.remove("light", "dark");
		root.classList.add(theme);
	}, [theme]);

	useEffect(() => {
		const handleSystemThemeChange = () => {
			if (localStorage.getItem(storageKey) === "system") {
				setTheme(getSystemTheme());
			}
		};

		const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
		mediaQuery.addEventListener("change", handleSystemThemeChange);

		return () => {
			mediaQuery.removeEventListener("change", handleSystemThemeChange);
		};
	}, [storageKey]);

	const value = {
		theme,
		setTheme: (newTheme: "dark" | "light" | "system") => {
			if (newTheme === "system") {
				localStorage.setItem(storageKey, "system");
				setTheme(getSystemTheme());
			} else {
				localStorage.setItem(storageKey, newTheme);
				setTheme(newTheme);
			}
		},
	};

	return (
		<ThemeProviderContext.Provider {...props} value={value}>
			{children}
		</ThemeProviderContext.Provider>
	);
}

function getSystemTheme(): "light" | "dark" {
	return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

// eslint-disable-next-line react-refresh/only-export-components
export const useTheme = () => {
	const context = useContext(ThemeProviderContext);

	if (context === undefined) throw new Error("useTheme must be used within a ThemeProvider");

	return context;
};
