export interface ContractAddresses {
  rpcUrl: string;
  chainId: number;
  factoryAddress: string;
  recoveryModuleAddress: string;
  mockTokenAddress: string;
}

const DEFAULT_CONFIG: ContractAddresses = {
  rpcUrl: import.meta.env.VITE_RPC_URL || "http://127.0.0.1:8545",
  chainId: Number(import.meta.env.VITE_CHAIN_ID || 31337),
  factoryAddress: import.meta.env.VITE_FACTORY_ADDRESS || "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
  recoveryModuleAddress: import.meta.env.VITE_RECOVERY_MODULE_ADDRESS || "0x5FbDB2315678afecb367f032d93F642f64180aa3",
  mockTokenAddress: import.meta.env.VITE_MOCK_ERC20_ADDRESS || "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0"
};

export function getContractAddresses(): ContractAddresses {
  const custom = localStorage.getItem("recoverid_custom_contracts");
  if (custom) {
    try {
      return { ...DEFAULT_CONFIG, ...JSON.parse(custom) };
    } catch {
      // ignore
    }
  }
  return DEFAULT_CONFIG;
}

export function saveContractAddresses(addresses: Partial<ContractAddresses>): void {
  const current = getContractAddresses();
  localStorage.setItem("recoverid_custom_contracts", JSON.stringify({ ...current, ...addresses }));
}
