// React frontend (single-file App.jsx)
// - Uses ethers.js to connect to the wallet (window.ethereum)
// - Sends 15 separate transactions to contract.ping(i)
// - Shows each tx hash and the event log when the tx is confirmed

import React, { useState } from 'react';
import { ethers } from 'ethers';

// Replace with your deployed contract address after deployment
const CONTRACT_ADDRESS = "<REMPLACEZ_PAR_VOTRE_ADRESSE_DE_CONTRACT>";
const CONTRACT_ABI = [
  "event Ping(address indexed sender, uint256 indexed index, uint256 value)",
  "function ping(uint256 index) external payable"
];

export default function App() {
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [account, setAccount] = useState(null);
  const [logs, setLogs] = useState([]);
  const [running, setRunning] = useState(false);
  const [valuePerTx, setValuePerTx] = useState('0'); // in CELO or cUSD depending network

  async function connectWallet() {
    if (!window.ethereum) {
      alert('Aucun wallet détecté. Installez Celo Extension Wallet ou MetaMask compatible.');
      return;
    }
    const web3Provider = new ethers.providers.Web3Provider(window.ethereum);
    await web3Provider.send('eth_requestAccounts', []);
    const signer = web3Provider.getSigner();
    const account = await signer.getAddress();
    setProvider(web3Provider);
    setSigner(signer);
    setAccount(account);
  }

  async function execute15Transactions() {
    if (!signer) {
      alert('Connectez d\u00E9abord votre wallet');
      return;
    }
    if (CONTRACT_ADDRESS.includes('<REMPLACEZ')) {
      alert('Remplacez CONTRACT_ADDRESS par l\'adresse du contrat d\u00E9ploy\u00E9.');
      return;
    }

    setRunning(true);
    setLogs([]);

    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

    // parse value per tx (assume CELO, 18 decimals) - allow 0
    let valueWei = ethers.constants.Zero;
    try {
      if (valuePerTx && valuePerTx !== '0') {
        valueWei = ethers.utils.parseEther(valuePerTx);
      }
    } catch (e) {
      alert('Valeur invalide pour chaque tx');
      setRunning(false);
      return;
    }

    // send 15 sequential transactions
    for (let i = 1; i <= 15; i++) {
      try {
        // Send transaction
        const tx = await contract.ping(i, { value: valueWei });
        // Push hash immediately
        setLogs(prev => [...prev, { index: i, stage: 'sent', txHash: tx.hash }]);

        // Wait for confirmation (1 block)
        const receipt = await tx.wait(1);

        // Try to decode event from receipt
        let eventInfo = null;
        try {
          const iface = new ethers.utils.Interface(CONTRACT_ABI);
          for (const l of receipt.logs) {
            try {
              const parsed = iface.parseLog(l);
              if (parsed && parsed.name === 'Ping') {
                eventInfo = {
                  sender: parsed.args.sender,
                  index: parsed.args.index.toString(),
                  value: parsed.args.value.toString()
                };
                break;
              }
            } catch (e) { /* not our event */ }
          }
        } catch (e) { /* ignore */ }

        setLogs(prev => prev.map(entry => entry.txHash === tx.hash ? { ...entry, stage: 'confirmed', receipt, event: eventInfo } : entry));

      } catch (err) {
        console.error('Tx failed for index', i, err);
        setLogs(prev => [...prev, { index: i, stage: 'failed', error: (err && err.message) ? err.message : String(err) }]);

        // Continue to the next transaction (do not block the loop permanently on failure)
      }
    }

    setRunning(false);
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-3xl mx-auto bg-white shadow-md rounded-2xl p-6">
        <h1 className="text-2xl font-bold mb-4">Batch Sender Celo — 15 transactions</h1>

        <div className="mb-4">
          <p className="text-sm text-gray-600">Etat wallet: {account ? account : 'non connecté'}</p>
          <div className="mt-2 flex gap-2">
            <button className="px-4 py-2 rounded-lg border" onClick={connectWallet}>Connecter le wallet</button>
            <button className="px-4 py-2 rounded-lg bg-blue-600 text-white" onClick={execute15Transactions} disabled={running || !account}>Exécuter 15 transactions</button>
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm">Valeur par transaction (CELO) — laisser 0 pour aucune valeur</label>
          <input className="mt-1 p-2 border rounded w-full" value={valuePerTx} onChange={e => setValuePerTx(e.target.value)} />
        </div>

        <div className="mt-4">
          <h2 className="text-lg font-semibold">Logs & hash des transactions</h2>
          <div className="mt-2 space-y-2 max-h-96 overflow-auto">
            {logs.length === 0 && <p className="text-sm text-gray-500">Aucune transaction enregistrée pour l'instant.</p>}
            {logs.map((l, idx) => (
              <div key={idx} className="p-3 border rounded">
                <div className="flex justify-between">
                  <div>Index: <strong>{l.index}</strong></div>
                  <div>Etat: <strong>{l.stage}</strong></div>
                </div>
                {l.txHash && <div className="mt-1 break-all">Hash: <code>{l.txHash}</code></div>}

                {l.stage === 'confirmed' && l.event && (
                  <div className="mt-2 text-sm text-gray-700">Event: Ping — sender: {l.event.sender} — index: {l.event.index} — value (wei): {l.event.value}</div>
                )}

                {l.stage === 'confirmed' && l.receipt && (
                  <details className="mt-2 text-xs text-gray-600">
                    <summary>Receipt (détails)</summary>
                    <pre className="whitespace-pre-wrap text-xs">{JSON.stringify({ status: l.receipt.status, blockNumber: l.receipt.blockNumber, gasUsed: l.receipt.gasUsed?.toString() }, null, 2)}</pre>
                  </details>
                )}

                {l.stage === 'failed' && (
                  <div className="mt-1 text-red-600 text-sm">Erreur: {l.error}</div>
                )}

              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 text-xs text-gray-500">
          <p>Notes:</p>
          <ul className="list-disc ml-5">
            <li>Vous devez déployer <code>BatchPinger</code> (contrat Solidity fourni) et remplacer <code>CONTRACT_ADDRESS</code> par l'adresse déployée.</li>
            <li>Ce front envoie 15 transactions séparées (une par appel à <code>ping(index)</code>), et attend 1 confirmation pour chaque tx avant d'envoyer la suivante.</li>
            <li>Sur les réseaux publics, envoyez des transactions avec prudence — assurez-vous d'avoir assez de CELO (ou la monnaie du réseau) pour payer le gas.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
