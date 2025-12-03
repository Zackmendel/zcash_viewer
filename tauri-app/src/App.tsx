import { useState, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";

interface Transaction {
  type: 'received' | 'sent';
  amount: number;
  memo: string;
  txid: string;
  recipient?: string;
  date: string;
}

interface WalletResponse {
  balance_zat: number;
  balance_zec: number;
  sync_height: string;
  history_raw: string;
  pretty_log: string;
}

function App() {
  const [viewingKey, setViewingKey] = useState("");
  const [birthday, setBirthday] = useState("3700000"); 
  const [balance, setBalance] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [debugLog, setDebugLog] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  // RESTORED: Toggle State
  const [isTestnet, setIsTestnet] = useState(true); 
  
  const [expandedTx, setExpandedTx] = useState<string | null>(null);

  const parseRawHistory = (rawString: string): Transaction[] => {
    const txs: Transaction[] = [];
    const receiveRegex = /txid: TxId\("(.*?)"\).*?kind: Received, value: (\d+).*?memo: (Some\("(.*?)"\)|None)/gs;
    const sentRegex = /txid: TxId\("(.*?)"\).*?kind: Sent\(Send\), value: (\d+)/gs;

    const receivedMatches = [...rawString.matchAll(receiveRegex)];
    for (const match of receivedMatches) {
      const txid = match[1];
      const amountZat = parseInt(match[2]);
      const memoRaw = match[3]; 
      const memo = memoRaw.includes("Some") ? match[4] : "No Memo";

      txs.push({
        type: 'received',
        amount: amountZat / 100_000_000,
        memo: memo,
        txid: txid,
        date: "Confirmed"
      });
    }

    const sentMatches = [...rawString.matchAll(sentRegex)];
    for (const match of sentMatches) {
      const txid = match[1];
      const amountZat = parseInt(match[2]);
      const txBlockIndex = rawString.indexOf(txid);
      const recipientMatch = rawString.slice(txBlockIndex).match(/recipient: "(.*?)"/);
      const recipient = recipientMatch ? recipientMatch[1] : "Unknown Recipient";

      txs.push({
        type: 'sent',
        amount: amountZat / 100_000_000,
        memo: "Outgoing",
        txid: txid,
        recipient: recipient,
        date: "Confirmed"
      });
    }
    return txs.reverse();
  };

  const stats = useMemo(() => {
    let totalIn = 0;
    let totalOut = 0;
    transactions.forEach(tx => {
      if (tx.type === 'received') totalIn += tx.amount;
      if (tx.type === 'sent') totalOut += tx.amount;
    });
    return { totalIn, totalOut };
  }, [transactions]);

  async function handleSync() {
    if(!viewingKey) return alert("Please enter a viewing key");
    
    setIsLoading(true);
    setDebugLog("");
    try {
      const response = await invoke<string>("sync_wallet", { 
        viewingKey, 
        isTestnet,
        birthday: parseInt(birthday) 
      });
      
      const data: WalletResponse = JSON.parse(response);
      setBalance(data.balance_zec);
      setDebugLog(data.pretty_log);
      setTransactions(parseRawHistory(data.history_raw));
      
    } catch (error) {
      console.error(error);
      alert("Sync Error: " + error);
    } finally {
      setIsLoading(false);
    }
  }

  if (balance !== null) {
    return (
      <div className="dashboard">
        <div className="header">
          <div className="logo">🛡️ Zcash Viewer <span style={{fontSize: '0.8rem', color: '#666', marginLeft: '10px'}}>({isTestnet ? 'TESTNET' : 'MAINNET'})</span></div>
          <button className="btn-small" onClick={() => setBalance(null)}>Exit Wallet</button>
        </div>

        <div className="card balance-card">
          <div className="balance-title">Shielded Balance</div>
          <div className="balance-amount">
            {balance.toFixed(4)} <span className="currency">ZEC</span>
          </div>
          <div className="stats-row">
            <div className="stat-item">
              <span className="stat-label">Total Inflow</span>
              <span className="stat-val income">+{stats.totalIn.toFixed(4)} ZEC</span>
            </div>
            <div className="stat-divider"></div>
            <div className="stat-item">
              <span className="stat-label">Total Outflow</span>
              <span className="stat-val expense">-{stats.totalOut.toFixed(4)} ZEC</span>
            </div>
          </div>
        </div>

        <h3>Transactions</h3>
        <div className="tx-list">
          {transactions.length === 0 ? (
            <div className="empty-state">No transactions found in this scan range.</div>
          ) : (
            transactions.map((tx) => (
              <div 
                key={tx.txid} 
                className={`tx-item ${tx.type}`}
                onClick={() => setExpandedTx(expandedTx === tx.txid ? null : tx.txid)}
              >
                <div className="tx-summary">
                  <div className="tx-left">
                    <span className="tx-type">{tx.type === 'received' ? '⬇ Received' : '⬆ Sent'}</span>
                    <span className="tx-date">{tx.date}</span>
                  </div>
                  <div className={`tx-amount ${tx.type}`}>
                    {tx.type === 'received' ? '+' : '-'}{tx.amount.toFixed(4)} ZEC
                  </div>
                </div>
                {expandedTx === tx.txid && (
                  <div className="tx-details">
                    <div className="detail-row">
                      <span className="label">TXID:</span>
                      <span className="val value-mono">{tx.txid}</span>
                    </div>
                    {tx.type === 'received' && (
                      <div className="detail-row">
                        <span className="label">Memo:</span>
                        <span className="val">{tx.memo}</span>
                      </div>
                    )}
                    {tx.type === 'sent' && (
                      <div className="detail-row">
                        <span className="label">Sent To:</span>
                        <span className="val value-mono">{tx.recipient}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <div style={{marginTop: '3rem', borderTop: '1px solid #333', paddingTop: '1rem'}}>
          <details>
            <summary style={{cursor: 'pointer', color: '#888'}}>🛠️ Show Developer Logs</summary>
            <div className="debug-container"><pre>{debugLog}</pre></div>
          </details>
        </div>
      </div>
    );
  }

  // --- RESTORED: TOGGLE IN LOGIN SCREEN ---
  return (
    <div className="container login-screen">
      <h1>Zcash Analytics</h1>
      <div className="input-group-vertical">
        
        {/* NETWORK TOGGLE */}
        <div className="network-selector">
          <label className={`network-option ${isTestnet ? 'active' : ''}`}>
            <input 
              type="radio" 
              name="network" 
              checked={isTestnet} 
              onChange={() => setIsTestnet(true)} 
            />
            Testnet
          </label>
          <label className={`network-option ${!isTestnet ? 'active' : ''}`}>
            <input 
              type="radio" 
              name="network" 
              checked={!isTestnet} 
              onChange={() => setIsTestnet(false)} 
            />
            Mainnet
          </label>
        </div>

        <div>
          <label style={{display: 'block', marginBottom: '8px', color: '#aaa'}}>Unified Viewing Key</label>
          <input value={viewingKey} onChange={(e) => setViewingKey(e.target.value)} placeholder={isTestnet ? "uviewtest..." : "uview..."} />
        </div>
        <div className="birthday-row">
          <label>Start Block:</label>
          <input type="number" value={birthday} onChange={(e) => setBirthday(e.target.value)} />
          <span style={{fontSize: '0.8rem', color: '#666'}}>(Default: {isTestnet ? '3700000' : '2000000'})</span>
        </div>
        <button className="btn-primary" onClick={handleSync} disabled={isLoading}>
          {isLoading ? "Syncing Blockchain..." : "Load Dashboard"}
        </button>
      </div>
    </div>
  );
}

export default App;