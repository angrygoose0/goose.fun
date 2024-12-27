
use anchor_lang::{
    prelude::*,
    solana_program::{
        program::invoke_signed,
        system_instruction,
    },
};

use anchor_spl::{
    associated_token::AssociatedToken,
    token::{mint_to, Mint, MintTo, Token, TokenAccount, TransferChecked, transfer_checked},
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

    pub const INITIAL_PRICE: u64 = 250000000; //tokens per sol (mul by 100 temp)
    pub const TOKEN_SUPPLY_BEFORE_BONDING: u64 = 800_000_000_000_000_000;

    pub const MINT_DECIMALS: u8 = 9;
    pub const MINT_SUPPLY: u64 = 1_000_000_000_000_000_000; // 1billion times 10^9

    pub const UNLOCK_FREQUENCY:u8 = 24; //hours
    pub const UNLOCK_AMOUNT:u8 = 10; //%
    

    pub fn init_meme_token(
        ctx: Context<InitToken>,
        metadata: InitTokenParams,
    ) -> Result<()> {
        if metadata.decimals != MINT_DECIMALS {
            return Err(error!(CustomError::InvalidDecimals));
        }
        let seeds = &["mint".as_bytes(), &metadata.symbol.as_bytes(), &metadata.name.as_bytes(), &[ctx.bumps.mint]];
        let signer = [&seeds[..]];

        let token_data: DataV2 = DataV2 {
            symbol: metadata.symbol.clone(),
            name: metadata.name.clone(),
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
            &signer,
        );

        create_metadata_accounts_v3(
            metadata_ctx,
            token_data,
            false,
            true,
            None,
        )?;

        Ok(())
    }

    pub fn mint_meme_token(
        ctx: Context<MintTokens>,
        symbol: String,
        name: String,
    ) -> Result<()> {
        let seeds = &["mint".as_bytes(), &symbol.as_bytes(), &name.as_bytes(), &[ctx.bumps.mint]];
        let signer = [&seeds[..]];

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

        // Create meme_account account
        let meme_account = &mut ctx.accounts.meme_account;
        meme_account.dev = ctx.accounts.signer.key();
        meme_account.mint = ctx.accounts.mint.key();
        meme_account.creation_time = Clock::get()?.unix_timestamp as i64;
        meme_account.locked_amount = 0;
        meme_account.bonded_time = -1;
        meme_account.pool_id = None;

        Ok(())
    }
    
    // after bonding
    pub fn lock_claim(
        ctx:Context<LockUnlockAfterBonding>,
        amount: i64, //amount in SPL lamports.
    ) -> Result<()> {
        let user_account = &mut ctx.accounts.user_account;
        let meme_account = &mut ctx.accounts.meme_account;

        require!(amount != 0, CustomError::InvalidAmount);

        user_account.user = ctx.accounts.signer.key();
        user_account.user = ctx.accounts.mint.key();

        require!(
            meme_account.bonded_time > 0,
            CustomError::NotBonded,
        );

        // wants to lock, amount is SPL lamports
        if amount > 0 {
            user_account.locked_amount = user_account
                .locked_amount
                .checked_add(amount as u64)
                .ok_or(CustomError::Overflow)?;

            meme_account.locked_amount = meme_account
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
                amount as u64, // has to be u64 times by decimal amount.
                MINT_DECIMALS,
            )?;
        } else if amount < 0 {
            // wants to unlock, amount is SPL lamports wanting to take out of treasury.
            let deduction = (-amount) as u64;

            user_account.claimmable = user_account
                .claimmable
                .checked_sub(deduction)
                .ok_or(CustomError::Underflow)?;

            meme_account.locked_amount = meme_account
                .locked_amount
                .checked_sub(deduction)
                .ok_or(CustomError::Underflow)?;
            

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
                (-amount) as u64,
                //spl token lamports.
                MINT_DECIMALS,
            )?;
        }
        Ok(())

    }

    //before bonding
    pub fn buy_sell(
        ctx: Context<BuySellBeforeBonding>,
        amount: i64, // sol lamports
    ) -> Result<()> {
        let user_account = &mut ctx.accounts.user_account;
        let meme_account = &mut ctx.accounts.meme_account;

        require!(amount != 0, CustomError::InvalidAmount);

        user_account.user = ctx.accounts.signer.key();
        user_account.user = ctx.accounts.mint.key();

        require!(
            meme_account.bonded_time < 0,
            CustomError::HasBonded,
        );

        if amount > 0 {
            // token lamport amount
            let mut tokens_owed = (amount as u64) * INITIAL_PRICE;
            let mut sol_sent: u64 = amount as u64;

            // Adjust tokens_owed to fit within TOKEN_SUPPLY_BEFORE_BONDING
            if meme_account.locked_amount + tokens_owed > TOKEN_SUPPLY_BEFORE_BONDING {
                tokens_owed = TOKEN_SUPPLY_BEFORE_BONDING - meme_account.locked_amount;
                sol_sent = tokens_owed / INITIAL_PRICE;
            }

            user_account.locked_amount = user_account
                .locked_amount
                .checked_add(tokens_owed)
                .ok_or(CustomError::Overflow)?;

            meme_account.locked_amount = meme_account
                .locked_amount
                .checked_add(tokens_owed)
                .ok_or(CustomError::Overflow)?;

            //if everything good, user gives sol lamports amount to treasury

            let transfer_instruction = system_instruction::transfer(
                &ctx.accounts.signer.key(),
                &ctx.accounts.treasury.key(),
                sol_sent,
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
        } else if amount < 0 {
            let spl_deduction = (-amount) as u64 * INITIAL_PRICE;
            user_account.locked_amount = user_account
                .locked_amount
                .checked_sub(spl_deduction)
                .ok_or(CustomError::Underflow)?;

            meme_account.locked_amount = meme_account
                .locked_amount
                .checked_sub(spl_deduction)
                .ok_or(CustomError::Underflow)?;

            
            let transfer_instruction = system_instruction::transfer(
                &ctx.accounts.treasury.key(),
                &ctx.accounts.signer.key(),
                (-amount) as u64,
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
        Ok(())
    }

    pub fn bond_to_raydium<'info>(    
        ctx: Context<BondToRaydium>,
        pool_id: Pubkey,
    ) -> Result<()> {
        let meme_account = &mut ctx.accounts.meme_account;

        //require!(meme_account.bonded_time < 0, CustomError::AlreadyBonded);

        meme_account.bonded_time = Clock::get()?.unix_timestamp as i64;
        meme_account.pool_id = Some(pool_id);
        Ok(())
    }



    pub fn unlock_tokens_in_user<'info>(
        ctx: Context<UnlockInUser>,
        _user: Pubkey,
    ) -> Result<()> {
        let meme_account = &mut ctx.accounts.meme_account;
        let user_account = &mut ctx.accounts.user_account;
        Ok(())

    }
    

}



#[derive(AnchorSerialize, AnchorDeserialize, Debug, Clone)]
pub struct InitTokenParams {
    pub symbol: String,
    pub name: String,
    pub uri: String,
    pub decimals: u8,
}

#[derive(Accounts)]
#[instruction(
    params: InitTokenParams,
)]
pub struct InitToken<'info>{
    /// CHECK: New Metaplex Account being created
    #[account(mut)]
    pub metadata: UncheckedAccount<'info>,
    #[account(
        init_if_needed,
        seeds = [b"mint", params.symbol.as_bytes(), params.name.as_bytes()],
        bump,
        payer = signer,
        mint::decimals = params.decimals,
        mint::authority = mint,
    )]
    pub mint: Account<'info, Mint>,
    #[account(mut)]
    pub treasury: SystemAccount<'info>,

    #[account(mut)]
    pub signer: Signer<'info>, // The signer who sends SOL
    pub rent: Sysvar<'info, Rent>,

    pub system_program: Program<'info, System>, // System program
    pub token_program: Program<'info, Token>,
    pub token_metadata_program: Program<'info, Metaplex>,
}

#[derive(Accounts)]
#[instruction(
    symbol: String,
    name: String,
)]
pub struct MintTokens<'info>{
    #[account(
        mut,
        seeds = [b"mint", symbol.as_bytes(), name.as_bytes()],
        bump,
        mint::authority = mint,
    )]
    pub mint: Account<'info, Mint>,

    #[account(mut)]
    pub signer: Signer<'info>, // The signer who sends SOL
    pub rent: Sysvar<'info, Rent>,

    pub system_program: Program<'info, System>, // System program
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,

    #[account(
        init_if_needed,
        payer = signer,
        associated_token::mint = mint,
        associated_token::authority = treasury,
    )]
    pub treasury_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub treasury: SystemAccount<'info>,


    #[account(
        init,
        seeds = [b"meme_account", mint.key().as_ref()],
        bump,
        space = 8 + MemeAccount::INIT_SPACE,
        payer = signer,
    )]
    pub meme_account: Box<Account<'info, MemeAccount>>,   

}


#[derive(Accounts)]
#[instruction(user: Pubkey)]
pub struct UnlockInUser<'info> {
    #[account(
        mut,
        seeds = [b"meme_account", mint.key().as_ref()],
        bump,
    )]
    pub meme_account: Account<'info, MemeAccount>,

    #[account(
        mut,
        seeds = [b"user_account", mint.key().as_ref(), user.key().as_ref()], // PDA seed
        bump,
    )]
    pub user_account:Box<Account<'info, UserAccount>>,

    #[account(mut)]
    pub treasury: SystemAccount<'info>,

    #[account(
        mut,
    )]
    pub mint: Account<'info, Mint>,

    pub system_program: Program<'info, System>,
}

#[error_code]
pub enum CustomError {
    #[msg("Invalid decimals value.")]
    InvalidDecimals,
    #[msg("Mint is mismatched.")]
    MintMismatch,
    #[msg("Underflow")]
    Underflow,
    #[msg("Overflow")]
    Overflow,
    #[msg("Invalid Amount")]
    InvalidAmount,
    #[msg("Has bonded")]
    HasBonded,
    #[msg("Hasn't bonded")]
    NotBonded,
    #[msg("Invalid Bump")]
    InvalidBump,
    #[msg("Already Bonded")]
    AlreadyBonded,
    
}


#[account]
#[derive(InitSpace)]
pub struct MemeAccount { //8
    pub dev: Pubkey, //32
    pub mint: Pubkey, //32

    pub locked_amount: u64, //8             billion * billion

    pub creation_time: i64, // 8
    pub bonded_time: i64,  // -1 for none (8)
    pub pool_id: Option<Pubkey>,
}

#[account]
#[derive(InitSpace)]
pub struct UserAccount { //8
    pub user: Pubkey, //32
    pub mint: Pubkey, //32
    pub locked_amount: u64, //8
    pub claimmable: u64, //8
}

#[derive(Accounts)]
pub struct LockUnlockAfterBonding<'info> {
    #[account(
        init_if_needed,
        payer = signer,
        space = 8 + UserAccount::INIT_SPACE,
        seeds = [b"user_account", mint.key().as_ref(), signer.key().as_ref()], // PDA seed
        bump,
    )]
    pub user_account:Box<Account<'info, UserAccount>>,
    #[account(
        mut,
        seeds = [b"meme_account", mint.key().as_ref()],
        bump,
    )]
    pub meme_account: Box<Account<'info, MemeAccount>>,
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(
        mut,
        mint::authority = mint,
    )]
    pub mint: Account<'info, Mint>,

    #[account(mut, signer)]
    pub treasury: SystemAccount<'info>,


    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = treasury,
    )]
    pub treasury_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = signer,
    )]
    pub user_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct BuySellBeforeBonding<'info> {
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
        seeds = [b"meme_account", mint.key().as_ref()],
        bump,
    )]
    pub meme_account: Account<'info, MemeAccount>,
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(
        mut,
    )]
    pub mint: Account<'info, Mint>,

    #[account(mut, signer)]
    pub treasury: SystemAccount<'info>,


    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct BondToRaydium<'info> {
    #[account(
        mut,
        seeds = [b"meme_account", mint.key().as_ref()],
        bump,
    )]
    pub meme_account: Account<'info, MemeAccount>,

    #[account(
        mut,
    )]
    pub mint: Account<'info, Mint>,

    #[account(mut, signer)]
    pub treasury: SystemAccount<'info>,

    pub system_program: Program<'info, System>,
}