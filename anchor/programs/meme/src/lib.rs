// 1. Import dependencies
use anchor_lang::{
    prelude::*,
    solana_program::{
        program::invoke_signed,
        system_instruction,
    },
};

use anchor_spl::{
    associated_token::AssociatedToken,
    token::{mint_to, Mint, MintTo, Token, TokenAccount, TransferChecked},
    metadata::{
        create_metadata_accounts_v3,
        mpl_token_metadata::types::DataV2,
        CreateMetadataAccountsV3, 
        Metadata as Metaplex,
    },
};
use solana_program::system_instruction;

// 2. Declare Program ID (SolPG will automatically update this when you deploy)
declare_id!("5BpjFeNvcyvFWYYQg1G8o2dYpwSbZzi8qbVPAfxPiFbP");


#[program]
pub mod meme {
    use super::*;

    pub const INITIAL_PRICE: u64 = 600; //solana lamports per one token (without decimal)
    pub const MINT_DECIMALS: u64 = 9
    pub const MINT_SUPPLY: u64 = 1_000_000_000_000_000_000


    pub fn create_meme_token(
        ctx: Context<CreateMemeToken>, 
        metadata: InitTokenParams, 
    ) -> Result<()> {
        if metadata.decimals != MINT_DECIMALS {
            return Err(error!(CustomError::InvalidDecimals));
        }

        // Clone the name and symbol for use in `seeds` to avoid moving them
        let name_bytes = metadata.name.clone().into_bytes();
        let symbol_bytes = metadata.symbol.clone().into_bytes();
        let seeds = &[
            b"mint",
            name_bytes.as_slice(),
            symbol_bytes.as_slice(),
            &[ctx.bumps.mint]
        ];
        let signer = [&seeds[..]];

        // Initialize token mint address
        let token_data: DataV2 = DataV2 {
            name: metadata.name.clone(),  // Use cloned name
            symbol: metadata.symbol.clone(), // Use cloned symbol
            uri: metadata.uri.clone(),
            seller_fee_basis_points: 0,
            creators: None,
            collection: None,
            uses: None,
        };

        let metadata_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_metadata_program.to_account_info(),
            CreateMetadataAccountsV3 {
                payer: ctx.accounts.signer.to_account_info(),
                update_authority: ctx.accounts.mint.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                metadata: ctx.accounts.metadata.to_account_info(),
                mint_authority: ctx.accounts.mint.to_account_info(),
                system_program: ctx.accounts.system_program.to_account_info(),
                rent: ctx.accounts.rent.to_account_info(),
            },
            &signer
        );

        create_metadata_accounts_v3(
            metadata_ctx,
            token_data,
            false,
            true,
            None,
        )?;

        mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    authority: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.treasury_token_account.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                },
                &signer,
            ),
            MINT_SUPPLY,
        )?;

        // Create meme_entry account
        let meme_entry = &mut ctx.accounts.meme_entry;
        meme_entry.dev = ctx.accounts.signer.key();
        meme_entry.mint = ctx.accounts.mint.key();
        meme_entry.creation_time = Clock::get()?.unix_timestamp as i64;
        meme_entry.locked_amount = 0;
        meme_entry.bonded_time = None;

        Ok(())
    }

    pub fn update_or_create_user_account(
        ctx: Context<UpdateOrCreateUserAccount>,
        amount: i64, //amount in lamports.
        mint: Pubkey,
    ) -> Result<()> {

        // sending spl token
        transfer_checked(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                TransferChecked {
                    from ctx.accounts.user_token_account.to_account_info(),
                    to: ctx.accounts.treasury_token_account.to_account_info(),
                    authority: ctx.accounts.signer.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                }
            ),
            amount, // has to be u64 times by decimal amount.
        )?;


        // sending sol
        let transfer_instruction = system_instruction::transfer(
        &ctx.accounts.signer.key(),
        &ctx.accounts.treasury.key(),
        amount,
        );

        invoke_signed(
            &transfer_instruction,
            &[
                ctx.accounts.signer.to_account_info(),
                ctx.accounts.treasury.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
            &[],
        )?;


        let user_account = &mut ctx.accounts.user_account;
        let meme_entry = &mut ctx.accounts.meme_entry;

        require!(meme_entry.mint == mint, CustomError::MintMismatch);
        require!(amount >= 0, CustomError::InvalidAmount);

        user_account.user = ctx.accounts.signer.key();
        user_account.meme_entry = MemeEntryState {
        dev: meme_entry.dev,
        mint: meme_entry.mint,
        locked_amount: meme_entry.locked_amount,
        creation_time: meme_entry.creation_time,
        bonded_time: meme_entry.bonded_time,
        };

        // bonded or not
        if let Some(bonded_time) = meme_entry.bonded_time {
            if amount > 0 {
                user_account.locked_amount = user_account
                    .locked_amount
                    .checked_add(amount as u64)
                    .ok_or(CustomError::Overflow)?;

                meme_entry.locked_amount = meme_entry
                    .locked_amount
                    .checked_add(amount as u64)
                    .ok_or(CustomError::Overflow)?;

                //user sends spl tokens to treasury
                transfer_checked(
                    CpiContext::new(
                        ctx.accounts.token_program.to_account_info(),
                        TransferChecked {
                            from: ctx.accounts.user_token_account.to_account_info(),
                            to: ctx.accounts.treasury_token_account.to_account_info(),
                            authority: ctx.accounts.signer.to_account_info(),
                            mint: ctx.accounts.mint.to_account_info(),
                        }
                    ),
                    (amount as u64), // has to be u64 times by decimal amount.
                )?;
            } else if amount < 0 {
                let deduction = (-amount) as u64;

                user_account.claimmable = user_account
                    .claimmable
                    .checked_sub(deduction)
                    .ok_or(CustomError::Underflow)?;

                meme_entry.locked_amount = meme_entry
                    .locked_amount
                    .checked_sub(deduction)
                    .ok_or(CustomError::Underflow)?;
                }

                //user receives spl tokens from treasury
                transfer_checked(
                    CpiContext::new(
                        ctx.accounts.token_program.to_account_info(),
                        TransferChecked {
                            from: ctx.accounts.treasury_token_account.to_account_info(),
                            to: ctx.accounts.user_token_account.to_account_info(),
                            authority: ctx.accounts.treasury.to_account_info(),
                            mint: ctx.accounts.mint.to_account_info(),
                        }
                    ),
                    deduction, // has to be u64 times by decimal amount.
                )?;

        } else {
            //hasnt bonded, so sol lamports
            if amount > 0 {

                let tokens_owed = (amount as u64) / INITIAL_PRICE;

                user_account.locked_amount = user_account
                    .locked_amount
                    .checked_add(tokens_owed)
                    .ok_or(CustomError::Overflow)?;

                meme_entry.locked_amount = meme_entry
                    .locked_amount
                    .checked_add(tokens_owed)
                    .ok_or(CustomError::Overflow)?;

                //if everything good, user gives sol lamports amount to treasury

                let transfer_instruction = system_instruction::transfer(
                    &ctx.accounts.signer.key(),
                    &ctx.accounts.treasury.key(),
                    (amount as u64),
                );

                invoke_signed(
                    &transfer_instruction,
                    &[
                        ctx.accounts.signer.to_account_info(),
                        ctx.accounts.treasury.to_account_info(),
                        ctx.accounts.system_program.to_account_info(),
                    ],
                    &[],
                )?;

                }
            else if amount < 0 {
                let deduction = (-amount) as u64 / INITIAL_PRICE;
                user_account.locked_amount = user_account
                    .locked_amount
                    .checked_sub(deduction)
                    .ok_or(CustomError::Underflow)?;

                meme_entry.locked_amount = meme_entry
                    .locked_amount
                    .checked_sub(deduction)
                    .ok_or(CustomError::Underflow)?;

                //if everything good, user receives amount sol lamports from treasury

                let transfer_instruction = system_instruction::transfer(
                    &ctx.accounts.treasury.key(),
                    &ctx.accounts.signer.key(),
                    deduction,
                );

                invoke_signed(
                    &transfer_instruction,
                    &[
                        ctx.accounts.treasury.to_account_info(),
                        ctx.accounts.signer.to_account_info(),
                        ctx.accounts.system_program.to_account_info(),
                    ],
                    &[],
                )?;
            }
        }
        Ok(())
    }

    pub fn update_meme_entry<'info>(
        
        ctx: Context<UpdateMemeEntry>,
        _mint: Pubkey,
        locked_amount: u64,
        bonded_time: Option<i64>,

    ) -> Result<()> {
        let meme_entry = &mut ctx.accounts.meme_entry;
        meme_entry.locked_amount = locked_amount;
        meme_entry.bonded_time = bonded_time;
        
        // for when i want to derive the treasury_token_account dynamically
        //let treasury_token_account = get_associated_token_address(&treasury, &ctx.accounts.mint.key());
        Ok(())
    }

    

}

#[derive(AnchorSerialize, AnchorDeserialize, Debug, Clone)]
pub struct InitTokenParams {
    pub name: String,
    pub symbol: String,
    pub uri: String,
    pub decimals: u8,
}


#[derive(Accounts)]
#[instruction(
    params: InitTokenParams,
)]
pub struct CreateMemeToken<'info> {
    #[account(mut)]
    pub signer: Signer<'info>, // The signer who sends SOL
    pub rent: Sysvar<'info, Rent>,

    /// CHECK: New Metaplex Account being created
    #[account(mut)]
    pub metadata: UncheckedAccount<'info>,

    #[account(
        init,
        seeds = [b"mint", params.name.as_bytes(), params.symbol.as_bytes()],
        bump,
        payer = signer,
        mint::decimals = params.decimals,
        mint::authority = mint,
    )]
    pub mint: Account<'info, Mint>,

    #[account(
        init,
        payer = signer,
        associated_token::mint = mint,
        associated_token::authority = treasury,
    )]
    pub treasury_token_account: Account<'info, TokenAccount>,

    #[account(
        init_if_needed,
        seeds = [b"treasury"],
        bump,
    )]
    pub treasury:  AccountInfo<'info>,

    #[account(
        init,
        seeds = [b"meme_entry", mint.key().as_ref()],
        bump,
        space = 8 + MemeEntryState::INIT_SPACE,
        payer = signer,
    )]
    pub meme_entry: Account<'info, MemeEntryState>,

    

    pub system_program: Program<'info, System>, // System program
    pub token_program: Program<'info, Token>,
    pub token_metadata_program: Program<'info, Metaplex>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}




#[derive(Accounts)]
#[instruction(mint: Pubkey)]
pub struct UpdateMemeEntry<'info> {
    #[account(
        mut,
        seeds = [b"meme_entry", mint.key().as_ref()],
        bump,
    )]
    pub meme_entry: Account<'info, MemeEntryState>,

    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(
        init_if_needed,
        seeds = [b"treasury"],
        bump,
    )]
    pub treasury: AccountInfo<'info>,

    pub system_program: Program<'info, System>,

}

#[error_code]
pub enum CustomError {
    #[msg("Invalid decimals value.")]
    InvalidDecimals,
    #[msg("Mint is mismatched.")]
    MintMismatch,
}


#[account]
#[derive(InitSpace)]
pub struct MemeEntryState {
    pub dev: Pubkey, //32
    pub mint: Pubkey, //32

    pub locked_amount: u64, //8

    pub creation_time: i64,
    pub bonded_time: Option<i64>,
}

#[account]
#[derive(InitSpace)]
pub struct UserAccount {
    pub user: Pubkey,
    pub meme_entry: MemeEntryState,
    pub locked_amount: u64,
    pub claimmable: u64,
}

#[derive(Accounts)]
#[instruction(mint: Pubkey)]
pub struct UpdateOrCreateUserAccount<'info> {
    #[account(
        init_if_needed,
        payer = signer,
        space = 8 + UserAccount::INIT_SPACE,
        seeds = [b"user_account", mint.key().as_ref(), signer.key().as_ref()], // PDA seed
        bump,
    )]
    pub user_account: Account<'info, UserAccount>,
    #[account(
        mut,
        seeds = [b"meme_entry", mint.key().as_ref()],
        bump,
    )]
    pub meme_entry: Account<'info, MemeEntryState>,
    #[account(mut)]
    pub signer: Signer<'info>,
    

    #[account(
        mut
        associated_token::mint = mint,
        associated_token::authority = treasury,
    )]
    pub treasury_token_account: Account<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = signer,
        associated_token::mint = mint,
        associated_token::authority = signer,
    )]
    pub user_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}