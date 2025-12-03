use tauri::{command, Manager};
use zingolib::lightclient::LightClient;
use zingolib::config::{ChainType, load_clientconfig};
use zingolib::wallet::{LightWallet, WalletBase, WalletSettings};
use pepper_sync::config::SyncConfig; 
use std::fs; 
use std::path::PathBuf;
use std::num::NonZeroU32;
use zcash_protocol::consensus::BlockHeight;
use zcash_primitives::zip32::AccountId; 
use serde_json::json;

#[command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[command]
async fn sync_wallet(viewing_key: String, is_testnet: bool, birthday: u32) -> Result<String, String> {
    // 1. Config
    let (server_uri_str, data_dir_str, chain_type, confirmations) = if is_testnet {
        ( "https://testnet.zec.rocks:443", "zcash_data_testnet", ChainType::Testnet, 3 )
    } else {
        ( "https://mainnet.lightwalletd.com:9067", "zcash_data_mainnet", ChainType::Mainnet, 10 )
    };

    let server_uri = server_uri_str.parse().unwrap();
    let data_dir = PathBuf::from(data_dir_str);

    // NUCLEAR OPTION: Always clean up to ensure fresh state
    if data_dir.exists() {
        let _ = fs::remove_dir_all(&data_dir);
    }

    let wallet_settings = WalletSettings {
        min_confirmations: NonZeroU32::new(confirmations).unwrap(),
        sync_config: SyncConfig::default(), 
    };
    let monitor_mempool_every = NonZeroU32::new(1).unwrap();
    let config = load_clientconfig(server_uri, Some(data_dir), chain_type, wallet_settings.clone(), monitor_mempool_every, "0.1.0".to_string()).map_err(|e| e.to_string())?;

    let wallet_base = WalletBase::Ufvk(viewing_key);
    let wallet = LightWallet::new(chain_type, wallet_base, BlockHeight::from_u32(birthday), wallet_settings).map_err(|e| e.to_string())?;
    
    // overwrite = true
    let mut client = LightClient::create_from_wallet(wallet, config, true).map_err(|e| e.to_string())?;

    // 3. EXECUTE SCAN (Always wait for it)
    let _ = client.rescan_and_await().await.map_err(|e| e.to_string())?;

    // 4. FETCH RAW DATA
    let account_id = AccountId::try_from(0).unwrap();
    let balance_result = client.account_balance(account_id).await.map_err(|e| e.to_string())?;
    let summaries = client.transaction_summaries(true).await;
    let server_info_str = client.do_info().await;
    let addresses = client.unified_addresses_json().await;

    // 5. CALCULATE TOTALS (For JSON)
    let orchard_bal = balance_result.confirmed_orchard_balance.map(|z| z.into_u64()).unwrap_or(0) 
        + balance_result.unconfirmed_orchard_balance.map(|z| z.into_u64()).unwrap_or(0);
    let sapling_bal = balance_result.confirmed_sapling_balance.map(|z| z.into_u64()).unwrap_or(0) 
        + balance_result.unconfirmed_sapling_balance.map(|z| z.into_u64()).unwrap_or(0);
    let total_balance = orchard_bal + sapling_bal;

    // 6. GENERATE OLD SCHOOL DEBUG LOG
    // We recreate the exact string format you found useful
    let debug_log_string = format!(
        "🔍 DEBUG INFO:\n\n🌍 Server:\n{}\n\n📍 My Address:\n{}\n\n💰 Balance:\n{:?}\n\n📜 Transactions:\n{:?}", 
        server_info_str,
        addresses.pretty(2), 
        balance_result, 
        summaries
    );

    // 7. SEND EVERYTHING
    let json_response = json!({
        "balance_zat": total_balance,
        "balance_zec": (total_balance as f64) / 100_000_000.0,
        "sync_height": server_info_str, 
        "history_raw": format!("{:?}", summaries), // Needed for Parser
        "pretty_log": debug_log_string // Needed for UI "Raw View"
    });

    Ok(json_response.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let _ = rustls::crypto::ring::default_provider().install_default();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet, 
            sync_wallet
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}