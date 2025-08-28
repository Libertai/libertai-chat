/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/libertai_payment_processor.json`.
 */
export type LibertaiPaymentProcessor = {
	address: "21tHgbgC8Q6hoXyHx5pp3Gtp97B3HxrS2yH832ryeNSw";
	metadata: {
		name: "libertaiPaymentProcessor";
		version: "0.1.0";
		spec: "0.1.0";
		description: "Created with Anchor";
	};
	instructions: [
		{
			name: "addAdmin";
			discriminator: [177, 236, 33, 205, 124, 152, 55, 186];
			accounts: [
				{
					name: "programState";
					writable: true;
					pda: {
						seeds: [
							{
								kind: "const";
								value: [112, 114, 111, 103, 114, 97, 109, 95, 115, 116, 97, 116, 101];
							},
						];
					};
				},
				{
					name: "authority";
					writable: true;
					signer: true;
				},
				{
					name: "systemProgram";
					address: "11111111111111111111111111111111";
				},
			];
			args: [
				{
					name: "newAdmin";
					type: "pubkey";
				},
			];
		},
		{
			name: "changeOwner";
			discriminator: [109, 40, 40, 90, 224, 120, 193, 184];
			accounts: [
				{
					name: "programState";
					writable: true;
					pda: {
						seeds: [
							{
								kind: "const";
								value: [112, 114, 111, 103, 114, 97, 109, 95, 115, 116, 97, 116, 101];
							},
						];
					};
				},
				{
					name: "authority";
					writable: true;
					signer: true;
				},
			];
			args: [
				{
					name: "newOwner";
					type: "pubkey";
				},
			];
		},
		{
			name: "getAdmins";
			discriminator: [176, 241, 136, 78, 150, 43, 109, 38];
			accounts: [
				{
					name: "programState";
					pda: {
						seeds: [
							{
								kind: "const";
								value: [112, 114, 111, 103, 114, 97, 109, 95, 115, 116, 97, 116, 101];
							},
						];
					};
				},
			];
			args: [];
			returns: {
				vec: "pubkey";
			};
		},
		{
			name: "initialize";
			discriminator: [175, 175, 109, 31, 13, 152, 155, 237];
			accounts: [
				{
					name: "programState";
					writable: true;
					pda: {
						seeds: [
							{
								kind: "const";
								value: [112, 114, 111, 103, 114, 97, 109, 95, 115, 116, 97, 116, 101];
							},
						];
					};
				},
				{
					name: "payer";
					writable: true;
					signer: true;
				},
				{
					name: "systemProgram";
					address: "11111111111111111111111111111111";
				},
			];
			args: [
				{
					name: "owner";
					type: "pubkey";
				},
			];
		},
		{
			name: "processPayment";
			discriminator: [189, 81, 30, 198, 139, 186, 115, 23];
			accounts: [
				{
					name: "user";
					writable: true;
					signer: true;
				},
				{
					name: "userTokenAccount";
					writable: true;
				},
				{
					name: "programTokenAccount";
					writable: true;
					pda: {
						seeds: [
							{
								kind: "const";
								value: [
									112,
									114,
									111,
									103,
									114,
									97,
									109,
									95,
									116,
									111,
									107,
									101,
									110,
									95,
									97,
									99,
									99,
									111,
									117,
									110,
									116,
								];
							},
							{
								kind: "account";
								path: "tokenMint";
							},
						];
					};
				},
				{
					name: "tokenMint";
				},
				{
					name: "tokenProgram";
				},
				{
					name: "systemProgram";
					address: "11111111111111111111111111111111";
				},
				{
					name: "rent";
					address: "SysvarRent111111111111111111111111111111111";
				},
			];
			args: [
				{
					name: "amount";
					type: "u64";
				},
			];
		},
		{
			name: "processPaymentSol";
			discriminator: [177, 28, 123, 191, 14, 93, 138, 70];
			accounts: [
				{
					name: "user";
					writable: true;
					signer: true;
				},
				{
					name: "programState";
					writable: true;
					pda: {
						seeds: [
							{
								kind: "const";
								value: [112, 114, 111, 103, 114, 97, 109, 95, 115, 116, 97, 116, 101];
							},
						];
					};
				},
				{
					name: "systemProgram";
					address: "11111111111111111111111111111111";
				},
			];
			args: [
				{
					name: "amount";
					type: "u64";
				},
			];
		},
		{
			name: "removeAdmin";
			discriminator: [74, 202, 71, 106, 252, 31, 72, 183];
			accounts: [
				{
					name: "programState";
					writable: true;
					pda: {
						seeds: [
							{
								kind: "const";
								value: [112, 114, 111, 103, 114, 97, 109, 95, 115, 116, 97, 116, 101];
							},
						];
					};
				},
				{
					name: "authority";
					writable: true;
					signer: true;
				},
				{
					name: "systemProgram";
					address: "11111111111111111111111111111111";
				},
			];
			args: [
				{
					name: "adminToRemove";
					type: "pubkey";
				},
			];
		},
		{
			name: "withdraw";
			discriminator: [183, 18, 70, 156, 148, 109, 161, 34];
			accounts: [
				{
					name: "programState";
					pda: {
						seeds: [
							{
								kind: "const";
								value: [112, 114, 111, 103, 114, 97, 109, 95, 115, 116, 97, 116, 101];
							},
						];
					};
				},
				{
					name: "authority";
					writable: true;
					signer: true;
				},
				{
					name: "programTokenAccount";
					writable: true;
					pda: {
						seeds: [
							{
								kind: "const";
								value: [
									112,
									114,
									111,
									103,
									114,
									97,
									109,
									95,
									116,
									111,
									107,
									101,
									110,
									95,
									97,
									99,
									99,
									111,
									117,
									110,
									116,
								];
							},
							{
								kind: "account";
								path: "tokenMint";
							},
						];
					};
				},
				{
					name: "destinationTokenAccount";
					writable: true;
				},
				{
					name: "tokenMint";
				},
				{
					name: "tokenProgram";
				},
			];
			args: [
				{
					name: "amount";
					type: "u64";
				},
			];
		},
		{
			name: "withdrawSol";
			discriminator: [145, 131, 74, 136, 65, 137, 42, 38];
			accounts: [
				{
					name: "programState";
					writable: true;
					pda: {
						seeds: [
							{
								kind: "const";
								value: [112, 114, 111, 103, 114, 97, 109, 95, 115, 116, 97, 116, 101];
							},
						];
					};
				},
				{
					name: "authority";
					writable: true;
					signer: true;
				},
				{
					name: "destination";
					docs: ["CHECK"];
					writable: true;
				},
			];
			args: [
				{
					name: "amount";
					type: "u64";
				},
			];
		},
	];
	accounts: [
		{
			name: "programState";
			discriminator: [77, 209, 137, 229, 149, 67, 167, 230];
		},
	];
	events: [
		{
			name: "paymentEvent";
			discriminator: [132, 136, 157, 119, 91, 254, 225, 20];
		},
		{
			name: "solPaymentEvent";
			discriminator: [123, 131, 169, 174, 82, 247, 254, 170];
		},
	];
	errors: [
		{
			code: 6000;
			name: "unauthorizedAccess";
			msg: "Unauthorized access - only owner or admin can perform this action";
		},
		{
			code: 6001;
			name: "onlyOwnerCanChangeOwner";
			msg: "Only the owner can change the program owner";
		},
		{
			code: 6002;
			name: "adminAlreadyExists";
			msg: "Admin already exists";
		},
		{
			code: 6003;
			name: "adminNotFound";
			msg: "Admin not found";
		},
		{
			code: 6004;
			name: "insufficientFunds";
			msg: "Insufficient funds in program token account";
		},
		{
			code: 6005;
			name: "invalidTokenMint";
			msg: "Invalid token mint - only mntpN8z1d29f3MWhMD7VqZFpeYmbD88MgwS3Bkz8y7u is accepted";
		},
		{
			code: 6006;
			name: "invalidTokenProgram";
			msg: "Invalid token program - only SPL Token and Token 2022 programs are accepted";
		},
		{
			code: 6007;
			name: "invalidTokenAccount";
			msg: "Invalid token account - account data is malformed or constraints not met";
		},
	];
	types: [
		{
			name: "paymentEvent";
			type: {
				kind: "struct";
				fields: [
					{
						name: "user";
						type: "pubkey";
					},
					{
						name: "amount";
						type: "u64";
					},
					{
						name: "timestamp";
						type: "i64";
					},
					{
						name: "tokenMint";
						type: "pubkey";
					},
				];
			};
		},
		{
			name: "programState";
			type: {
				kind: "struct";
				fields: [
					{
						name: "owner";
						type: "pubkey";
					},
					{
						name: "admins";
						type: {
							vec: "pubkey";
						};
					},
					{
						name: "bump";
						type: "u8";
					},
				];
			};
		},
		{
			name: "solPaymentEvent";
			type: {
				kind: "struct";
				fields: [
					{
						name: "user";
						type: "pubkey";
					},
					{
						name: "amount";
						type: "u64";
					},
					{
						name: "timestamp";
						type: "i64";
					},
				];
			};
		},
	];
};
