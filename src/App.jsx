import React, { useState } from "react";
import { BrowserProvider, Contract, parseEther, formatEther } from "ethers";

// Remplace par ton contrat déployé
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
  const [valuePerTx, setValuePerTx] = useState("0");

  async function connectWallet() {
    if (!window.ethereum) return alert("Wallet non détecté");

    try {
      const provider = new BrowserProvider(window.ethereum);
      await window.ethereum.request({ method: "eth_requestAccounts" });
      const signer = await provider.getSigner();
      const account = await signer.getAddress();

      setProvider(provider);
      setSigner(signer);
      setAccount(account);
    } catch (err) {
      alert("Impossible de se connecter au wallet : " + err.message);
    }
  }

  async function execute15Transactions() {
    if (!signer) return alert("Connectez d’abord votre wallet");
    if (CONTRACT_ADDRESS.includes("<REMPLACEZ"))
      return alert("Remplacez CONTRACT_ADDRESS");

    setRunning(true);
    setLogs([]);

    const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

    // valeur par transaction
    let valueWei = 0n;
    try {
      if (valuePerTx && valuePerTx !== "0") valueWei = BigInt(parseEther(valuePerTx));
    } catch {
      alert("Valeur invalide pour chaque tx");
      setRunning(false);
      return;
    }

    for (let i = 1; i <= 15; i++) {
      try {
        const tx = await contract.ping(i, { value: valueWei });
        setLogs((prev) => [...prev, { index: i, stage: "sent", txHash: tx.hash }]);

        const receipt = await tx.wait(1);

        // décodage event Ping
        let eventInfo = null;
        try {
          for (const log of receipt.logs) {
            const parsed = contract.interface.parseLog(log);
            if (parsed.name === "Ping") {
              eventInfo = {
                sender: parsed.args.sender,
                index: parsed.args.index.toString(),
                value: parsed.args.value.toString()
              };
              break;
            }
          }
        } catch {}

        setLogs((prev) =>
          prev.map((entry) =>
            entry.txHash === tx.hash
              ? { ...entry, stage: "confirmed", receipt, event: eventInfo }
              : entry
          )
        );
      } catch (err) {
        setLogs((prev) => [
          ...prev,
          {
            index: i,
            stage: "failed",
            error: err?.message ?? String(err)
          }
        ]);
      }
    }

    setRunning(false);
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-3xl mx-auto bg-white shadow-md rounded-2xl p-6">
        <h1 className="text-2xl font-bold mb-4">Batch Sender Celo — 15 transactions</h1>

        <div className="mb-4">
          <p className="text-sm text-gray-600">
            Etat wallet: {account || "non connecté"}
          </p>
          <div className="mt-2 flex gap-2">
            <button className="px-4 py-2 rounded-lg border" onClick={connectWallet}>
              Connecter le wallet
            </button>
            <button
              className="px-4 py-2 rounded-lg bg-blue-600 text-white"
              onClick={execute15Transactions}
              disabled={running || !account}
            >
              Exécuter 15 transactions
            </button>
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm">Valeur par transaction (CELO)</label>
          <input
            className="mt-1 p-2 border rounded w-full"
            value={valuePerTx}
            onChange={(e) => setValuePerTx(e.target.value)}
          />
        </div>

        <div className="mt-4">
          <h2 className="text-lg font-semibold">Logs & hash des transactions</h2>
          <div className="mt-2 space-y-2 max-h-96 overflow-auto">
            {logs.length === 0 && (
              <p className="text-sm text-gray-500">
                Aucune transaction pour l'instant.
              </p>
            )}
            {logs.map((l, idx) => (
              <div key={idx} className="p-3 border rounded">
                <div className="flex justify-between">
                  <div>Index: <strong>{l.index}</strong></div>
                  <div>Etat: <strong>{l.stage}</strong></div>
                </div>
                {l.txHash && (
                  <div className="mt-1 break-all">
                    Hash: <code>{l.txHash}</code>
                  </div>
                )}
                {l.stage === "confirmed" && l.event && (
                  <div className="mt-2 text-sm text-gray-700">
                    Event: Ping — sender: {l.event.sender} — index: {l.event.index} — value: {l.event.value}
                  </div>
                )}
                {l.stage === "failed" && (
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
