import { ApiKey } from "@/apis/inference";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useEffect, useState } from "react";
import { z } from "zod";

interface ApiKeyFormProps {
	mode: "create" | "edit";
	onSubmit: (data: { name: string; monthlyLimit: number | null; isActive?: boolean }) => void;
	onCancel: () => void;
	initialData?: ApiKey;
	isLoading?: boolean;
}

// Define form schema with Zod
const apiKeyFormSchema = z.object({
	name: z.string().min(1, "Key name is required"),
	monthlyLimit: z
		.string()
		.refine((val) => val === "" || (!isNaN(Number(val)) && Number(val) >= 0), {
			message: "Must be a valid positive number",
		})
		.transform((val) => (val === "" ? null : Number(val))),
	isActive: z.boolean().optional(),
});

export function ApiKeyForm({ mode, onSubmit, onCancel, initialData, isLoading = false }: Readonly<ApiKeyFormProps>) {
	const [name, setName] = useState("");
	const [monthlyLimit, setMonthlyLimit] = useState<string>("");
	const [errors, setErrors] = useState<{ name?: string; monthlyLimit?: string }>({});
	const [isActive, setIsActive] = useState(true);
	const isEditMode = mode === "edit";

	// Initialize form values when editing
	useEffect(() => {
		if (initialData && isEditMode) {
			setName(initialData.name);
			setMonthlyLimit(initialData.monthly_limit ? initialData.monthly_limit.toString() : "");
			setIsActive(initialData.is_active);
		}
	}, [initialData, isEditMode]);

	const validateForm = (): boolean => {
		try {
			apiKeyFormSchema.parse({
				name,
				monthlyLimit,
				...(isEditMode && { isActive }),
			});
			setErrors({});
			return true;
		} catch (error) {
			if (error instanceof z.ZodError) {
				const fieldErrors: { name?: string; monthlyLimit?: string } = {};

				error.errors.forEach((err) => {
					const field = err.path[0] as keyof typeof fieldErrors;
					if (field) {
						fieldErrors[field] = err.message;
					}
				});

				setErrors(fieldErrors);
			}
			return false;
		}
	};

	const handleSubmit = () => {
		if (!validateForm()) return;

		onSubmit({
			name: name.trim(),
			monthlyLimit: monthlyLimit.trim() ? parseFloat(monthlyLimit) : null,
			...(isEditMode && { isActive }),
		});
	};

	return (
		<div className="space-y-4">
			<div className="space-y-2">
				<label htmlFor="key-name" className="block text-sm font-medium text-muted-foreground">
					Key Name
				</label>
				<Input
					id="key-name"
					type="text"
					value={name}
					onChange={(e) => setName(e.target.value)}
					placeholder="e.g. Production API Key"
					className={`w-full ${errors.name ? "border-destructive" : ""}`}
					aria-invalid={!!errors.name}
				/>
				{errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
				<p className="text-xs text-muted-foreground">
					Give your API key a memorable name to easily identify its purpose
				</p>
			</div>

			<div className="space-y-2">
				<label htmlFor="monthly-limit" className="block text-sm font-medium text-muted-foreground">
					Monthly Usage Limit (Optional)
				</label>
				<Input
					id="monthly-limit"
					type="text"
					inputMode="decimal"
					value={monthlyLimit}
					onChange={(e) => setMonthlyLimit(e.target.value)}
					placeholder="e.g. 100"
					className={`w-full ${errors.monthlyLimit ? "border-destructive" : ""}`}
					aria-invalid={!!errors.monthlyLimit}
				/>
				{errors.monthlyLimit && <p className="text-xs text-destructive">{errors.monthlyLimit}</p>}
				<p className="text-xs text-muted-foreground">Set a monthly spending limit in USD (leave empty for unlimited)</p>
			</div>

			{isEditMode && (
				<div className="flex items-center justify-between pt-2">
					<div className="space-y-0.5">
						<label htmlFor="key-status" className="text-sm font-medium">
							Key Status
						</label>
						<p className="text-xs text-muted-foreground">Enable or disable this API key</p>
					</div>
					<Switch id="key-status" checked={isActive} onCheckedChange={setIsActive} />
				</div>
			)}

			<div className="flex justify-end gap-3 mt-6">
				<Button variant="outline" onClick={onCancel} disabled={isLoading}>
					Cancel
				</Button>
				<Button onClick={handleSubmit} disabled={isLoading}>
					{isLoading ? (isEditMode ? "Saving..." : "Creating...") : isEditMode ? "Save Changes" : "Create Key"}
				</Button>
			</div>
		</div>
	);
}
