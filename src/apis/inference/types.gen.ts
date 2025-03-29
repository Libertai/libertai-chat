// This file is auto-generated by @hey-api/openapi-ts

export type ApiKey = {
    id: string;
    key: string;
    name: string;
    user_address: string;
    created_at: string;
    is_active: boolean;
    monthly_limit?: number | null;
};

export type ApiKeyCreate = {
    name: string;
    monthly_limit?: number | null;
};

export type ApiKeyListResponse = {
    keys: Array<ApiKey>;
};

export type ApiKeyUpdate = {
    name?: string | null;
    is_active?: boolean | null;
    monthly_limit?: number | null;
};

export type AuthLoginRequest = {
    address: string;
    signature: string;
};

export type AuthLoginResponse = {
    access_token: string;
    token_type?: string;
    address: string;
};

export type AuthMessageRequest = {
    address: string;
};

export type AuthMessageResponse = {
    message: string;
};

export type CreditBalanceResponse = {
    address: string;
    balance: number;
};

/**
 * Input and output tokens for a single day.
 */
export type DailyTokens = {
    input_tokens: number;
    output_tokens: number;
};

/**
 * Dashboard statistics for a user.
 */
export type DashboardStats = {
    address: string;
    monthly_usage: {
        [key: string]: number;
    };
    current_month: TokenStats;
};

export type ExpiredCreditTransaction = {
    transaction_hash: string;
    address: string;
    expired_at: string | null;
};

export type ExpiredCreditTransactionsResponse = {
    updated_count: number;
    transactions: Array<ExpiredCreditTransaction>;
};

export type FullApiKey = {
    id: string;
    key: string;
    name: string;
    user_address: string;
    created_at: string;
    is_active: boolean;
    monthly_limit?: number | null;
    full_key: string;
};

export type HttpValidationError = {
    detail?: Array<ValidationError>;
};

export type InferenceCallData = {
    key: string;
    credits_used: number;
    input_tokens: number;
    output_tokens: number;
    model_name: string;
};

export type ThirdwebWebhookPayload = {
    data: {
        [key: string]: unknown;
    };
};

/**
 * Stats about token usage for the current month.
 */
export type TokenStats = {
    inference_calls: number;
    total_tokens: number;
    input_tokens: number;
    output_tokens: number;
    credits_used: number;
};

/**
 * Usage statistics grouped by model or API key.
 */
export type UsageByEntity = {
    name: string;
    calls: number;
    total_tokens: number;
    cost: number;
};

/**
 * Detailed usage statistics for a date range.
 */
export type UsageStats = {
    inference_calls: number;
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
    cost: number;
    daily_usage: {
        [key: string]: DailyTokens;
    };
    usage_by_model: Array<UsageByEntity>;
    usage_by_api_key: Array<UsageByEntity>;
};

export type ValidationError = {
    loc: Array<string | number>;
    msg: string;
    type: string;
};

export type GetAuthMessageAuthMessagePostData = {
    body: AuthMessageRequest;
    path?: never;
    query?: never;
    url: '/auth/message';
};

export type GetAuthMessageAuthMessagePostErrors = {
    /**
     * Validation Error
     */
    422: HttpValidationError;
};

export type GetAuthMessageAuthMessagePostError = GetAuthMessageAuthMessagePostErrors[keyof GetAuthMessageAuthMessagePostErrors];

export type GetAuthMessageAuthMessagePostResponses = {
    /**
     * Successful Response
     */
    200: AuthMessageResponse;
};

export type GetAuthMessageAuthMessagePostResponse = GetAuthMessageAuthMessagePostResponses[keyof GetAuthMessageAuthMessagePostResponses];

export type LoginWithWalletAuthLoginPostData = {
    body: AuthLoginRequest;
    path?: never;
    query?: never;
    url: '/auth/login';
};

export type LoginWithWalletAuthLoginPostErrors = {
    /**
     * Validation Error
     */
    422: HttpValidationError;
};

export type LoginWithWalletAuthLoginPostError = LoginWithWalletAuthLoginPostErrors[keyof LoginWithWalletAuthLoginPostErrors];

export type LoginWithWalletAuthLoginPostResponses = {
    /**
     * Successful Response
     */
    200: AuthLoginResponse;
};

export type LoginWithWalletAuthLoginPostResponse = LoginWithWalletAuthLoginPostResponses[keyof LoginWithWalletAuthLoginPostResponses];

export type ProcessLtaiTransactionsCreditsLtaiProcessPostData = {
    body?: never;
    path?: never;
    query?: never;
    url: '/credits/ltai/process';
};

export type ProcessLtaiTransactionsCreditsLtaiProcessPostResponses = {
    /**
     * Successful Response
     */
    200: Array<string>;
};

export type ProcessLtaiTransactionsCreditsLtaiProcessPostResponse = ProcessLtaiTransactionsCreditsLtaiProcessPostResponses[keyof ProcessLtaiTransactionsCreditsLtaiProcessPostResponses];

export type ThirdwebWebhookCreditsThirdwebWebhookPostData = {
    body: ThirdwebWebhookPayload;
    headers?: {
        'X-Pay-Signature'?: string;
        'X-Pay-Timestamp'?: string;
    };
    path?: never;
    query?: never;
    url: '/credits/thirdweb/webhook';
};

export type ThirdwebWebhookCreditsThirdwebWebhookPostErrors = {
    /**
     * Validation Error
     */
    422: HttpValidationError;
};

export type ThirdwebWebhookCreditsThirdwebWebhookPostError = ThirdwebWebhookCreditsThirdwebWebhookPostErrors[keyof ThirdwebWebhookCreditsThirdwebWebhookPostErrors];

export type ThirdwebWebhookCreditsThirdwebWebhookPostResponses = {
    /**
     * Successful Response
     */
    200: unknown;
};

export type UpdateExpiredCreditTransactionsCreditsUpdateExpiredPostData = {
    body?: never;
    path?: never;
    query?: never;
    url: '/credits/update-expired';
};

export type UpdateExpiredCreditTransactionsCreditsUpdateExpiredPostResponses = {
    /**
     * Successful Response
     */
    200: ExpiredCreditTransactionsResponse;
};

export type UpdateExpiredCreditTransactionsCreditsUpdateExpiredPostResponse = UpdateExpiredCreditTransactionsCreditsUpdateExpiredPostResponses[keyof UpdateExpiredCreditTransactionsCreditsUpdateExpiredPostResponses];

export type GetUserBalanceCreditsBalanceGetData = {
    body?: never;
    path?: never;
    query?: never;
    url: '/credits/balance';
};

export type GetUserBalanceCreditsBalanceGetErrors = {
    /**
     * Validation Error
     */
    422: HttpValidationError;
};

export type GetUserBalanceCreditsBalanceGetError = GetUserBalanceCreditsBalanceGetErrors[keyof GetUserBalanceCreditsBalanceGetErrors];

export type GetUserBalanceCreditsBalanceGetResponses = {
    /**
     * Successful Response
     */
    200: CreditBalanceResponse;
};

export type GetUserBalanceCreditsBalanceGetResponse = GetUserBalanceCreditsBalanceGetResponses[keyof GetUserBalanceCreditsBalanceGetResponses];

export type GetApiKeysApiKeysGetData = {
    body?: never;
    path?: never;
    query?: never;
    url: '/api-keys';
};

export type GetApiKeysApiKeysGetErrors = {
    /**
     * Validation Error
     */
    422: HttpValidationError;
};

export type GetApiKeysApiKeysGetError = GetApiKeysApiKeysGetErrors[keyof GetApiKeysApiKeysGetErrors];

export type GetApiKeysApiKeysGetResponses = {
    /**
     * Successful Response
     */
    200: ApiKeyListResponse;
};

export type GetApiKeysApiKeysGetResponse = GetApiKeysApiKeysGetResponses[keyof GetApiKeysApiKeysGetResponses];

export type CreateApiKeyApiKeysPostData = {
    body: ApiKeyCreate;
    path?: never;
    query?: never;
    url: '/api-keys';
};

export type CreateApiKeyApiKeysPostErrors = {
    /**
     * Validation Error
     */
    422: HttpValidationError;
};

export type CreateApiKeyApiKeysPostError = CreateApiKeyApiKeysPostErrors[keyof CreateApiKeyApiKeysPostErrors];

export type CreateApiKeyApiKeysPostResponses = {
    /**
     * Successful Response
     */
    200: FullApiKey;
};

export type CreateApiKeyApiKeysPostResponse = CreateApiKeyApiKeysPostResponses[keyof CreateApiKeyApiKeysPostResponses];

export type DeleteApiKeyApiKeysKeyIdDeleteData = {
    body?: never;
    path: {
        key_id: string;
    };
    query?: never;
    url: '/api-keys/{key_id}';
};

export type DeleteApiKeyApiKeysKeyIdDeleteErrors = {
    /**
     * Validation Error
     */
    422: HttpValidationError;
};

export type DeleteApiKeyApiKeysKeyIdDeleteError = DeleteApiKeyApiKeysKeyIdDeleteErrors[keyof DeleteApiKeyApiKeysKeyIdDeleteErrors];

export type DeleteApiKeyApiKeysKeyIdDeleteResponses = {
    /**
     * Successful Response
     */
    200: unknown;
};

export type UpdateApiKeyApiKeysKeyIdPutData = {
    body: ApiKeyUpdate;
    path: {
        key_id: string;
    };
    query?: never;
    url: '/api-keys/{key_id}';
};

export type UpdateApiKeyApiKeysKeyIdPutErrors = {
    /**
     * Validation Error
     */
    422: HttpValidationError;
};

export type UpdateApiKeyApiKeysKeyIdPutError = UpdateApiKeyApiKeysKeyIdPutErrors[keyof UpdateApiKeyApiKeysKeyIdPutErrors];

export type UpdateApiKeyApiKeysKeyIdPutResponses = {
    /**
     * Successful Response
     */
    200: ApiKey;
};

export type UpdateApiKeyApiKeysKeyIdPutResponse = UpdateApiKeyApiKeysKeyIdPutResponses[keyof UpdateApiKeyApiKeysKeyIdPutResponses];

export type RegisterInferenceCallApiKeysUsagePostData = {
    body: InferenceCallData;
    path?: never;
    query?: never;
    url: '/api-keys/usage';
};

export type RegisterInferenceCallApiKeysUsagePostErrors = {
    /**
     * Validation Error
     */
    422: HttpValidationError;
};

export type RegisterInferenceCallApiKeysUsagePostError = RegisterInferenceCallApiKeysUsagePostErrors[keyof RegisterInferenceCallApiKeysUsagePostErrors];

export type RegisterInferenceCallApiKeysUsagePostResponses = {
    /**
     * Successful Response
     */
    200: unknown;
};

export type GetDashboardStatsStatsDashboardGetData = {
    body?: never;
    path?: never;
    query?: never;
    url: '/stats/dashboard';
};

export type GetDashboardStatsStatsDashboardGetErrors = {
    /**
     * Validation Error
     */
    422: HttpValidationError;
};

export type GetDashboardStatsStatsDashboardGetError = GetDashboardStatsStatsDashboardGetErrors[keyof GetDashboardStatsStatsDashboardGetErrors];

export type GetDashboardStatsStatsDashboardGetResponses = {
    /**
     * Successful Response
     */
    200: DashboardStats;
};

export type GetDashboardStatsStatsDashboardGetResponse = GetDashboardStatsStatsDashboardGetResponses[keyof GetDashboardStatsStatsDashboardGetResponses];

export type GetUsageStatsStatsUsageGetData = {
    body?: never;
    path?: never;
    query: {
        /**
         * Start date in format YYYY-MM-DD
         */
        start_date: string;
        /**
         * End date in format YYYY-MM-DD
         */
        end_date: string;
    };
    url: '/stats/usage';
};

export type GetUsageStatsStatsUsageGetErrors = {
    /**
     * Validation Error
     */
    422: HttpValidationError;
};

export type GetUsageStatsStatsUsageGetError = GetUsageStatsStatsUsageGetErrors[keyof GetUsageStatsStatsUsageGetErrors];

export type GetUsageStatsStatsUsageGetResponses = {
    /**
     * Successful Response
     */
    200: UsageStats;
};

export type GetUsageStatsStatsUsageGetResponse = GetUsageStatsStatsUsageGetResponses[keyof GetUsageStatsStatsUsageGetResponses];

export type ClientOptions = {
    baseURL: 'http://localhost:8000' | (string & {});
};