use anchor_lang::{
    prelude::*,
    solana_program::{
        program::invoke_signed,
        system_instruction,
        pubkey::Pubkey,
    },
};

use anchor_spl::{
    associated_token::{AssociatedToken},
    token::{
        transfer_checked, mint_to, Mint, MintTo, Token, TokenAccount, TransferChecked,
    },
    metadata::{
        mpl_token_metadata::types::DataV2,
        CreateMetadataAccountsV3, Metadata as Metaplex, create_metadata_accounts_v3,
    },
};


// 2. Declare Program ID (SolPG will automatically update this when you deploy)
declare_id!("9nXE1U7FpiuB5V7Bft2sdURwA7QZsnKHpvp8v21RZSub");



#[program]
pub mod meme {
    use super::*;

    pub const TREASURY_PUBLIC_KEY: Pubkey =
        pubkey!("CLTFWDW9qp1sEFXnNhaQBnyzfErZcjmyt2h6RA8QLFj7");
        
    pub const SUPPLY_SOLD_BEFORE_BONDING: u64 = 800_000_000_000_000_000;
    pub const SOL_GOAL_BEFORE_BONDING: u64 = 1_000_000_000; // 100 sol     1 sol temp
    

    pub const MINT_DECIMALS: u8 = 9;
    pub const MINT_SUPPLY: u64 = 1_000_000_000_000_000_000; // 10^9 times 10^9

    pub const UNLOCK_FREQUENCY:u8 = 24; //hours
    pub const UNLOCK_AMOUNT:u64 = 10; //10%


    pub fn init_meme_token(
        ctx: Context<InitToken>,
        metadata: InitTokenParams,
        seed: String,
    ) -> Result<()> {
        if metadata.decimals != MINT_DECIMALS {
            return Err(error!(CustomError::InvalidDecimals));
        }

        require!(
            ctx.accounts.treasury.key() == TREASURY_PUBLIC_KEY,
            CustomError::Unauthorized
        );

        let seeds = &["mint".as_bytes(), seed.as_bytes(), &[ctx.bumps.mint]];
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
        seed: String,
    ) -> Result<()> {
        require!(
            ctx.accounts.treasury.key() == TREASURY_PUBLIC_KEY,
            CustomError::Unauthorized
        );

        let seeds = &["mint".as_bytes(), seed.as_bytes(), &[ctx.bumps.mint]];
        let signer = [&seeds[..]];
        
        mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    authority: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.treasury_token_account.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                },
                &signer
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
    pub fn lock(
        ctx: Context<LockAfterBonding>,
        amount: u64, // amount in SPL lamports
    ) -> Result<()> {

        require!(
            ctx.accounts.treasury.key() == TREASURY_PUBLIC_KEY,
            CustomError::Unauthorized
        );

        let user_account = &mut ctx.accounts.user_account;
        let meme_account = &mut ctx.accounts.meme_account;
    
        require!(amount != 0, CustomError::InvalidAmount);
    
        user_account.user = ctx.accounts.signer.key();
        user_account.mint = ctx.accounts.mint.key();
    
        require!(
            !(meme_account.bonded_time < 0 && meme_account.creation_time >= 0),
            CustomError::NotBonded,
        );


        user_account.locked_amount = user_account
            .locked_amount
            .checked_add(amount)
            .ok_or(CustomError::Overflow)?;

        meme_account.locked_amount = meme_account
            .locked_amount
            .checked_add(amount)
            .ok_or(CustomError::Overflow)?;

        // User sends SPL tokens to treasury

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
            amount, // has to be u64 times by decimal amount
            MINT_DECIMALS,
        )?;     
        Ok(())
    }

    //before bonding
    pub fn buy(
        ctx: Context<BuyBeforeBonding>,
        amount: u64, // sol lamports
    ) -> Result<()> {
        require!(
            ctx.accounts.treasury.key() == TREASURY_PUBLIC_KEY,
            CustomError::Unauthorized
        );

        let user_account = &mut ctx.accounts.user_account;
        let meme_account = &mut ctx.accounts.meme_account;

        require!(amount != 0, CustomError::InvalidAmount);

        user_account.user = ctx.accounts.signer.key();
        user_account.mint = ctx.accounts.mint.key();

        require!(
            (meme_account.bonded_time < 0 && meme_account.creation_time >= 0 ),
            CustomError::HasBonded,
        );

        user_account.locked_amount = user_account
            .locked_amount
            .checked_add(amount)
            .ok_or(CustomError::Overflow)?;

        meme_account.locked_amount = meme_account
            .locked_amount
            .checked_add(amount)
            .ok_or(CustomError::Overflow)?;

        //if everything good, user gives sol lamports amount to treasury
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

        Ok(())
    }

    pub fn bond_to_raydium<'info>(    
        ctx: Context<BondToRaydium>,
        pool_id: Pubkey,
    ) -> Result<()> {
        require!(
            ctx.accounts.treasury.key() == TREASURY_PUBLIC_KEY,
            CustomError::Unauthorized
        );

        let meme_account = &mut ctx.accounts.meme_account;

        require!(
            meme_account.bonded_time < 0 && meme_account.creation_time >= 0,
            CustomError::HasBonded,
        );

        require!(
            meme_account.locked_amount >= SOL_GOAL_BEFORE_BONDING,
            CustomError::NotEnoughSol,
        )

        meme_account.bonded_time = Clock::get()?.unix_timestamp as i64;
        meme_account.pool_id = Some(pool_id);

        let tokens_per_sol: u64 = SUPPLY_SOLD_BEFORE_BONDING / meme_account.locked_amount;

        meme_account.locked_amount *= tokens_per_sol;

        for account in ctx.remaining_accounts.iter() {
            let mut data = account.try_borrow_mut_data()?;
            let mut user_account = UserAccount::try_deserialize(&mut data.as_ref()).expect("Error Deserializing Data");
            
            if user_account.mint != ctx.accounts.mint.key() {
                continue;
            }
            user_account.locked_amount *= tokens_per_sol;
            user_account.try_serialize(&mut data.as_mut())?;
        }

        Ok(())
    }

    
    pub fn unlock_meme_phase<'info>(
        ctx: Context<UnlockPhase>,
        _user: Pubkey,
    ) -> Result<()> {
        require!(
            ctx.accounts.treasury.key() == TREASURY_PUBLIC_KEY,
            CustomError::Unauthorized
        );
    
        let meme_account = &mut ctx.accounts.meme_account;
        let user_account = &mut ctx.accounts.user_account;
    
        require!(
            !(meme_account.bonded_time < 0 && meme_account.creation_time>= 0),
            CustomError::NotBonded,
        );

        require!(meme_account.locked_amount != 0, CustomError::InvalidAmount);
        require!(user_account.locked_amount != 0, CustomError::InvalidAmount);

        let deduction = user_account.locked_amount / UNLOCK_AMOUNT as u64;
        if deduction == 0 {
            user_account.locked_amount = 0;
        } else {
            user_account.locked_amount -= deduction;
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
                deduction,
                MINT_DECIMALS,
            )?;
            meme_account.locked_amount -= deduction;
        }  
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
    seed: String,
)]
pub struct InitToken<'info>{
    /// CHECK: New Metaplex Account being created
    #[account(mut)]
    pub metadata: UncheckedAccount<'info>,

    #[account(
        init_if_needed,
        seeds = [b"mint", seed.as_bytes()],
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
    seed: String,
)]
pub struct MintTokens<'info>{
    #[account(
        mut,
        seeds = [b"mint", seed.as_bytes()],
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
    #[msg("Unathorized")]
    Unauthorized,
    #[msg("Serialization failed")]
    SerializationError,
    #[msg("Deserialization failed")]
    DeserializationError,
    #[msg("Token account not found")]
    TokenAccountNotFound,
    #[msg("SOL goal not reached.")]
    NotEnoughSol,
    
}


#[account]
#[derive(InitSpace)]
pub struct MemeAccount { //8
    pub dev: Pubkey, //32
    pub mint: Pubkey, //32

    pub locked_amount: u64, //8             billion * billion h
    // when not boned to raydium, this number is SOL, when bonded to raydium, this number is tokens, when

    pub creation_time: i64, // 8 created or first locked token on goose
    pub bonded_time: i64,  //8  -1 for not bonded (this is only when token is created on goose), if from pump, creation = bonded time.
    pub pool_id: Option<Pubkey>, // this is whats used to see if show raydium buy/sell ui
}

#[account]
#[derive(InitSpace)]
pub struct UserAccount { //8
    pub user: Pubkey, //32
    pub mint: Pubkey, //32
    pub locked_amount: u64, //8
}

#[derive(Accounts)]
pub struct LockAfterBonding<'info> {
    #[account(
        init_if_needed,
        payer = signer,
        space = 8 + UserAccount::INIT_SPACE,
        seeds = [b"user_account", mint.key().as_ref(), signer.key().as_ref()],
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
    )]
    pub mint: Account<'info, Mint>,

    #[account(mut)]
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
pub struct BuyBeforeBonding<'info> {
    #[account(
        init_if_needed,
        payer = signer,
        space = 8 + UserAccount::INIT_SPACE,
        seeds = [b"user_account", mint.key().as_ref(), signer.key().as_ref()],
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


    #[account(mut)]
    pub treasury: SystemAccount<'info>,


    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(
    user: Pubkey,
)]
pub struct UnlockPhase<'info> {
    #[account(
        mut,
        seeds = [b"meme_account", mint.key().as_ref()],
        bump,
    )]
    pub meme_account: Account<'info, MemeAccount>,

    #[account(
        mut,
        seeds = [b"user_account", mint.key().as_ref(), user.as_ref()],
        bump,
    )]
    pub user_account: Account<'info, UserAccount>,

    #[account(
        mut,
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
        associated_token::authority = user,
    )]
    pub user_token_account: Account<'info, TokenAccount>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
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

}