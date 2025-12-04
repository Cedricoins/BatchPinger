import React, { useState } from 'react';
import { JsonRpcProvider, Contract } from 'ethers';
import { formatEther } from 'ethers/lib/utils.js';
import { MaxUint256 } from 'ethers/lib/constants.js';

// Replace with your deployed contract address
const CONTRACT_ADDRESS = "0xcaF3ba73631773d4a45428AF6505f3BAEF44b945";
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
  const [valuePerTx, setValuePerTx] = useState('0'); // in CELO

  async function connectWallet() {
    if (!window.ethereum) {
      alert('Aucun wallet détecté. Installez Celo Extension Wallet ou MetaMask compatible.');
      return;
    }

    const web3Provider = new JsonRpcProvider(window.ethereum);
    await window.ethereum.request({ method: 'eth_requestAccounts' });
    const signer = web3Provider.getSigner();
    const account = await signer.getAddress();
    setProvider(web3Provider);
    setSigner(signer);
    setAccount(account);
  }

  async function execute15Transactions() {
    if (!signer) {
      alert('Connectez d’abord votre wallet');
      return;
    }
    if (CONTRACT_ADDRESS.includes('<REMPLACEZ')) {
      alert('Remplacez CONTRACT_ADDRESS par l\'adresse du contrat déployé.');
      return;
    }

    setRunning(true);
    setLogs([]);

    const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

    let valueWei = BigInt(0);
    try {
      if (valuePerTx && valuePerTx !== '0') {
        valueWei = BigInt(Math.floor(parseFloat(valuePerTx) * 1e18));
      }
    } catch (e) {
      alert('Valeur invalide pour chaque tx');
      setRunning(false);
      return;
    }

    for (let i = 1; i <= 15; i++) {
      try {
        const tx = await contract.ping(i, { value: valueWei });
        setLogs(prev => [...prev, { index: i, stage: 'sent', txHash: tx.hash }]);
        const receipt = await tx.wait(1);

        // Decode Ping event
        let eventInfo = null;
        try {
          const iface = new ethers.Interface(CONTRACT_ABI);
          for (const l of receipt.logs) {
            try {
              const parsed = iface.parseLog(l);
              if (parsed.name === 'Ping') {
                eventInfo = {
                  sender: parsed.args.sender,
                  index: parsed.args.index.toString(),
                  value: parsed.args.value.toString()
                };
                break;
              }
            } catch {}
          }
        } catch {}

        setLogs(prev =>
          prev.map(entry => entry.txHash === tx.hash ? { ...entry, stage: 'confirmed', receipt, event: eventInfo } : entry)
        );

      } catch (err) {
        setLogs(prev => [...prev, { index: i, stage: 'failed', error: (err && err.message) ? err.message : String(err) }]);
      }
    }

    setRunning(false);
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-3xl mx-auto bg-white shadow-md rounded-2xl p-6">
        <h1 className="text-2xl font-bold mb-4">Batch Sender Celo — 15 transactions</h1>

        <div className="mb-4">
          <p className="text-sm text-gray-600">Etat wallet: {account || 'non connecté'}</p>
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

      </div>
    </div>
  );
}
