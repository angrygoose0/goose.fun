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

    pub fn create_treasury(
        ctx: Context<CreateTreasuryAccount>,
    ) -> Result<()> {
        let treasury_account = &mut ctx.accounts.treasury_account;
        treasury_account.treasury = ctx.accounts.signer.key();
        Ok(())
    }

    pub fn create_meme_token(
        ctx: Context<CreateMemeToken>, 
        metadata: InitTokenParams, 
    ) -> Result<()> {
        if metadata.decimals != 9 {
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
        meme_entry.creation_time = Clock::get()?.unix_timestamp as i64;
        meme_entry.locked_amount = 0;
        meme_entry.unlocked_amount = 0;
        meme_entry.bonded_time = None;

        Ok(())
    }

    pub fn update_or_create_user_account(
        ctx: Context<UpdateOrCreateUserAccount>,
        amount: i64, //amount in lamports.
        mint: Pubkey,
    ) -> Result<()> {

        let user_account = &mut ctx.accounts.user_account;
        let meme_entry = &ctx.accounts.meme_entry;

        require!(meme_entry.mint == mint, CustomError::MintMismatch);

        user_account.user = ctx.accounts.user.key();
        user_account.meme_entry = MemeEntryState {
        dev: meme_entry.dev,
        mint: meme_entry.mint,
        locked_amount: meme_entry.locked_amount,
        unlocked_amount: meme_entry.unlocked_amount,
        creation_time: meme_entry.creation_time,
        bonded_time: meme_entry.bonded_time,
        };

        // bonded or not
        if let Some(bonded_time) = meme_entry.bonded_time {
            // has bonded, so spl token
            
        } else {
            //hasnt bonded, so sol.

            // add to user_account.locked_amount after calculating the spl token price.

            // remove if minus.
            
        }




        Ok(())
    }

    pub fn update_meme_entry<'info>(
        
        ctx: Context<UpdateMemeEntry>,
        _mint: Pubkey,
        locked_amount: u64,
        unlocked_amount: u64,
        bonded_time: Option<i64>,

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
        seeds = [b"mint", params.name.as_bytes(), params.symbol.as_bytes()],
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

    #[account(
        mut,
        seeds = [b"treasury"],
        bump,
    )]
    pub treasury: Account<'info, TreasuryAccount>,

    #[account(
        init,
        seeds = [b"meme_entry", mint.key().as_ref()],
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
        seeds = [b"meme_entry", mint.key().as_ref()],
        bump,
    )]
    pub meme_entry: Account<'info, MemeEntryState>,

    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(
        mut,
        seeds = [b"treasury"],
        bump,
    )]
    pub treasury: Account<'info, TreasuryAccount>,

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
    pub unlocked_amount: u64, //8

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


#[account]
#[derive(InitSpace)]
pub struct TreasuryAccount {
    pub treasury: Pubkey,
}

#[derive(Accounts)]
pub struct CreateTreasuryAccount<'info> {
    #[account(
        init_if_needed,
        payer = signer,
        space = 8 + TreasuryAccount::INIT_SPACE,
        seeds = [b"treasury"], // PDA seed
        bump,
    )]
    pub treasury_account: Account<'info, TreasuryAccount>,
    #[account(mut)]
    pub signer: Signer<'info>, // Payer of the account creation

    pub system_program: Program<'info, System>,

}

#[derive(Accounts)]
#[instruction(mint: Pubkey)]
pub struct UpdateOrCreateUserAccount<'info> {
    #[account(
        init_if_needed,
        payer = user,
        space = 8 + UserAccount::INIT_SPACE,
        seeds = [b"user_account", mint.key().as_ref(), user.key().as_ref()], // PDA seed
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
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}