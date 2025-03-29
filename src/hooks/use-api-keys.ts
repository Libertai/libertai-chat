import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
	ApiKeyCreate,
	createApiKeyApiKeysPost,
	deleteApiKeyApiKeysKeyIdDelete,
	getApiKeysApiKeysGet,
	updateApiKeyApiKeysKeyIdPut,
	ValidationError,
} from "@/apis/inference";
import { useAccountStore } from "@/stores/account";

// Helper function to extract FastAPI error details
const extractFastAPIError = (error?: ValidationError[] | string | undefined): string => {
	// Check for simple error message in detail field
	if (error && typeof error === "string") {
		return error;
	}

	// FastAPI validation errors are in detail array
	if (Array.isArray(error)) {
		const details: ValidationError[] = error;
		// Get the first error message or join multiple messages
		if (details.length > 0) {
			return details.map((d) => d.msg).join(", ");
		}
	}
	return "An unknown error occurred";
};

export function useApiKeys() {
	const queryClient = useQueryClient();
	const account = useAccountStore((state) => state.account);

	// Query for fetching API keys
	const query = useQuery({
		queryKey: ["apiKeys", account?.address],
		queryFn: async () => {
			if (!account) {
				return { keys: [] };
			}

			const response = await getApiKeysApiKeysGet();

			if (response.error) {
				throw new Error(extractFastAPIError(response.error.detail));
			}

			return response.data;
		},
		enabled: !!account, // Only run the query when account exists
	});

	// Mutation for creating a new API key
	const createMutation = useMutation({
		mutationFn: async (keyData: ApiKeyCreate) => {
			if (!account) {
				throw new Error("No account available");
			}

			const response = await createApiKeyApiKeysPost({
				body: keyData,
			});

			if (response.error) {
				throw new Error(extractFastAPIError(response.error.detail));
			}

			return response.data;
		},
		onSuccess: async () => {
			toast.success("API key created successfully");
			await queryClient.invalidateQueries({ queryKey: ["apiKeys", account?.address] });
		},
		onError: (error) => {
			toast.error("Failed to create API key", {
				description: error instanceof Error ? error.message : "An unknown error occurred",
			});
		},
	});

	// Mutation for updating an API key
	const updateMutation = useMutation({
		mutationFn: async ({
			keyId,
			isActive,
			name,
			monthlyLimit,
		}: {
			keyId: string;
			isActive: boolean;
			name?: string | null;
			monthlyLimit?: number | null;
		}) => {
			const response = await updateApiKeyApiKeysKeyIdPut({
				path: {
					key_id: keyId,
				},
				body: {
					is_active: isActive,
					name,
					monthly_limit: monthlyLimit,
				},
			});

			if (response.error) {
				throw new Error(extractFastAPIError(response.error.detail));
			}

			return response.data;
		},
		onSuccess: async () => {
			toast.success("API key updated successfully");
			await queryClient.invalidateQueries({ queryKey: ["apiKeys", account?.address] });
		},
		onError: (error) => {
			toast.error("Failed to update API key", {
				description: error instanceof Error ? error.message : "An unknown error occurred",
			});
		},
	});

	// Mutation for deleting an API key
	const deleteMutation = useMutation({
		mutationFn: async (keyId: string) => {
			const response = await deleteApiKeyApiKeysKeyIdDelete({
				path: {
					key_id: keyId,
				},
			});

			if (response.error) {
				throw new Error(extractFastAPIError(response.error.detail));
			}

			return true;
		},
		onSuccess: async () => {
			toast.success("API key disabled successfully");
			await queryClient.invalidateQueries({ queryKey: ["apiKeys", account?.address] });
		},
		onError: (error) => {
			toast.error("Failed to delete API key", {
				description: error instanceof Error ? error.message : "An unknown error occurred",
			});
		},
	});

	return {
		apiKeys: query.data?.keys || [],
		isLoading: query.isLoading,
		isError: query.isError,
		error: query.error,
		refetch: query.refetch,
		createApiKey: createMutation.mutateAsync,
		updateApiKey: updateMutation.mutateAsync,
		deleteApiKey: deleteMutation.mutateAsync,
		createApiKeyStatus: createMutation.status,
		updateApiKeyStatus: updateMutation.status,
		deleteApiKeyStatus: deleteMutation.status,
	};
}
