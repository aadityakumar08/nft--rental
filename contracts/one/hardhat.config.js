require("dotenv").config();
require("@nomicfoundation/hardhat-toolbox");
require("@nomicfoundation/hardhat-verify");


const NEOX_PK = '';
const NEOX_MAINNET_PK = '';

module.exports = {
  solidity: {
    version: "0.8.26",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
        details: {
          yul: false,
        },
      },
    }
  },
  networks: {
      'neox-t4': {
          url: 'https://neoxt4seed1.ngd.network',
          accounts: [`${NEOX_PK}`],
          gasPrice: 40e9,
          gas: 50e6,
      },
      'neox': {
          url: 'https://mainnet-1.rpc.banelabs.org',
          accounts: [`${NEOX_MAINNET_PK}`],
          gasPrice: 40e9,
      },
  },
  etherscan: {
      apiKey: {
          'neox-t4': 'empty',
          'neox': 'empty'
      },
      customChains: [
          {
              network: 'neox-t4',
              chainId: 12227332,
              urls: {
                  apiURL: 'https://xt4scan.ngd.network/api',
                  browserURL: 'https://neoxt4scan.ngd.network'
              }
          },
          {
              network: 'neox',
              chainId: 47763,
              urls: {
                  apiURL: 'https://xexplorer.neo.org/api',
                  browserURL: 'https://xexplorer.neo.org'
              }
          }
      ]
  }
};