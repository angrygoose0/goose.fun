// 1. Import dependencies
use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{mint_to, Mint, MintTo, Token, TokenAccount},
    metadata::{
        create_metadata_accounts_v3,
        mpl_token_metadata::types::DataV2,
        CreateMetadataAccountsV3, 
        Metadata as Metaplex,
    },
};


// 2. Declare Program ID (SolPG will automatically update this when you deploy)
declare_id!("5BpjFeNvcyvFWYYQg1G8o2dYpwSbZzi8qbVPAfxPiFbP");


#[program]
pub mod meme {
    use super::*;

    pub fn create_meme_token(
        ctx: Context<CreateMemeToken>, 
        metadata: InitTokenParams, 
        _treasury: Pubkey, 
    ) -> Result<()> {
        if metadata.decimals != 9 {
            return Err(error!(CustomError::InvalidDecimals));
        }

        // Clone the name and symbol for use in `seeds` to avoid moving them
        let name_bytes = metadata.name.clone().into_bytes();
        let symbol_bytes = metadata.symbol.clone().into_bytes();
        let seeds = &[name_bytes.as_slice(), symbol_bytes.as_slice(), &[ctx.bumps.mint]];
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
                payer: ctx.accounts.payer.to_account_info(),
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

        let quantity: u64 = 1_000_000_000_000_000_000; // One billion with 9 decimals
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
            quantity,
        )?;

        // Create meme_entry account
        let meme_entry = &mut ctx.accounts.meme_entry;
        meme_entry.dev = ctx.accounts.payer.key();
        meme_entry.mint = ctx.accounts.mint.key();
        meme_entry.creation_time = Clock::get()?.unix_timestamp as u64;
        meme_entry.locked_amount = 0;
        meme_entry.unlocked_amount = 0;
        meme_entry.bonded_time = None;

        Ok(())
    }

    pub fn update_or_create_user_account(
        ctx: Context<UpdateOrCreateUserAccount>,
        want_to_lock: u64,
        want_to_claim: u64,
    ) -> Result<()> {
        let user_account = &mut ctx.accounts.user_account;
        let meme_entry = &ctx.accounts.meme_entry;

        if user_account.is_initialized() {
            // Update logic
            user_account.locked_amount += want_to_lock;
            user_account.claimmable = user_account.claimmable.saturating_add(want_to_claim);

            // Ensure locked amount does not exceed the MemeEntryState locked amount
            require!(
                user_account.locked_amount <= meme_entry.locked_amount,
                CustomError::ExceededLockedAmount
            );
        } else {
            // Initialize new UserAccount
            user_account.user = ctx.accounts.user.key();
            user_account.meme_entry = MemeEntryState {
                dev: meme_entry.dev,
                mint: meme_entry.mint,
                locked_amount: meme_entry.locked_amount,
                unlocked_amount: meme_entry.unlocked_amount,
                creation_time: meme_entry.creation_time,
                bonded_time: meme_entry.bonded_time,
            };
            user_account.locked_amount = want_to_lock;
            user_account.claimmable = want_to_claim;
        }

        Ok(())
    }

    pub fn update_meme_entry<'info>(
        
        ctx: Context<UpdateMemeEntry>,
        _mint: Pubkey,
        locked_amount: u64,
        unlocked_amount: u64,
        bonded_time: Option<u64>,

    ) -> Result<()> {
        let meme_entry = &mut ctx.accounts.meme_entry;
        meme_entry.locked_amount = locked_amount;
        meme_entry.unlocked_amount = unlocked_amount;
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
    treasury: Pubkey,
)]
pub struct CreateMemeToken<'info> {
    #[account(mut)]
    pub payer: Signer<'info>, // The signer who sends SOL
    pub rent: Sysvar<'info, Rent>,

    /// CHECK: New Metaplex Account being created
    #[account(mut)]
    pub metadata: UncheckedAccount<'info>,

    #[account(
        init,
        seeds = [params.name.as_bytes(), params.symbol.as_bytes()],
        bump,
        payer = payer,
        mint::decimals = params.decimals,
        mint::authority = mint,
    )]
    pub mint: Account<'info, Mint>,

    #[account(
        init,
        payer = payer,
        associated_token::mint = mint,
        associated_token::authority = treasury,
    )]
    pub treasury_token_account: Account<'info, TokenAccount>,

    /// CHECK: Treasury account provided from the frontend
    #[account(mut)]
    pub treasury: UncheckedAccount<'info>,

    #[account(
        init,
        seeds = [mint.key().as_ref()],
        bump,
        space = 8 + MemeEntryState::INIT_SPACE,
        payer = payer,
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
        seeds = [mint.key().as_ref()],
        bump,
        realloc = 8 + MemeEntryState::INIT_SPACE,
        realloc::payer = signer,
        realloc::zero = true,
    )]
    pub meme_entry: Account<'info, MemeEntryState>,

    #[account(mut)]
    pub signer: Signer<'info>,

    pub system_program: Program<'info, System>,

}

#[account]
#[derive(InitSpace)]
pub struct MemeEntryState {
    pub dev: Pubkey, //32
    pub mint: Pubkey, //32

    pub locked_amount: u64, //8
    pub unlocked_amount: u64, //8

    pub creation_time: u64,
    pub bonded_time: Option<u64>,
}

#[error_code]
pub enum CustomError {
    #[msg("Invalid decimals value.")]
    InvalidDecimals,
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
pub struct UpdateOrCreateUserAccount<'info> {
    #[account(
        init_if_needed,
        payer = user,
        space = 8 + UserAccount::INIT_SPACE,
        seeds = [b"user-account", user.key().as_ref()], // PDA seed
        bump
    )]
    pub user_account: Account<'info, UserAccount>,

    #[account(mut)]
    pub user: Signer<'info>,

    #[account(mut)]
    pub meme_entry: Account<'info, MemeEntryState>, // Link to a MemeEntryState account

    pub system_program: Program<'info, System>,
}