// 1. Import dependencies
use anchor_lang::prelude::*;
use anchor_lang::solana_program::system_instruction;
use anchor_lang::solana_program::program::invoke;
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
        msg!("started");
        if metadata.decimals != 9 {
            return Err(error!(CustomError::InvalidDecimals));
        }
        
        /*
        // Create the instruction to transfer SOL
        let sending_amount: u64 = 1_000_000_000;
        let ix = system_instruction::transfer(
            &ctx.accounts.payer.key(),   // Signer's public key
            &treasury, // Recipient's public key
            sending_amount, // Amount to transfer (in lamports)
        );
        

        // Execute the instruction
        invoke(
            &ix,
            &[
                ctx.accounts.payer.to_account_info(),
            ],
        )?;

        msg!("transferred to treasury");
        */

        let seeds = &["mint".as_bytes(), &[ctx.bumps.mint]];
        let signer = [&seeds[..]];

        //initialize token mint address
        let token_data: DataV2 = DataV2 {
            name: metadata.name,
            symbol: metadata.symbol,
            uri: metadata.uri,
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

        msg!("init token mint address");

        // create meme_entry account
        let meme_entry = &mut ctx.accounts.meme_entry;
        meme_entry.dev = ctx.accounts.payer.key();
        meme_entry.mint = ctx.accounts.mint.key();
        meme_entry.creation_time = Clock::get()?.unix_timestamp as u64;
        meme_entry.locked_amount = 0;
        meme_entry.unlocked_amount = 0;
        meme_entry.bonded_time = None;

        msg!("edit meme_entry");

        Ok(())
    }

    pub fn update_meme_entry(
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
        seeds = [b"mint"],
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
    pub dev: Pubkey,
    pub mint: Pubkey,

    pub locked_amount: u64,
    pub unlocked_amount: u64,

    pub creation_time: u64,
    pub bonded_time: Option<u64>,
}

#[error_code]
pub enum CustomError {
    #[msg("Invalid decimals value.")]
    InvalidDecimals,
}