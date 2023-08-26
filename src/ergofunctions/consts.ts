import { Address } from "@coinbarn/ergo-ts";
import { Currency } from "../interfaces/NftAsset";
import { SupportedCurrenciesInterface } from "../interfaces/SupportedCurrencies";

export const auctionAddress = `5t19JGogcry9DRipPNcLs4mSnHYXQoqazPDMXXcdMixeH2mkgzMvWXjENsHRJzfHAFnTL5FBDHQCzBcnYg4CU1LcJZMmUXAaDcsKdgfBk4sE9BDbLt6Yxkjh6ow65HGCgxkwNAEArMAz8tqZL7GzKx4AvYVkqG3ExKggwDyVrvx7YzN8xeFtEUcnVkDKM8ow7YWW8eee2EidfYArPRd8fxQr5EuZVEiQbzKZ6m4xgtHfhsEptE3pNdt69F94gkytpounxBYpJPqfeZ8hVxLk8qaXTGFiJTDTt2p9D5ue4skZf4AGSLJyuzpMkjdifczQNc784ic1nbTAcjL3FKGHqnkaVwnCxU7go45X9ZFHwdpc6v67vFDoHzAAqypax4UFF1ux84X5G4xK5NFFjMZtvPyjqn2ErNXVgHBs2AkpngBPjnVRiN4sWkhR66NfBNpigU8PaTiB4Rim2FMZSXuyhRySCA1BV8ydVxz45T9VHqHA6WYkXp2ppAHmc29F8MrHX5Ew2x6amraFgvsdgAB3XiiEqEjRc83mhZVL1QgKi5CdeeGNYiXeCkxaRhG3j6r1JdAgzGDAQfN8sdRcEc1aYxbPfbqM1s81NFm7K1UmMUxrfCUp73poGAfV8FvQa2akyascKBaSCqvwuHW2ZP4oMoJHjZjTAgQjQF8cBNF9YLo6wXEtMQT5FYc3bHSgd4xZXCk2oHYjUSACW1Z5e7KZ3Qw1Sa2UvpMdWhbZ5Ncu99WT7v6nHFLJvHEPM7evr41nhCe9Yt3pAq4ee4rKCtEer4vQWq2b5UJSDXDj5VkVepQ5tmeXfXrBc42Yqucy6VeQSE7W66o4hQjwW1iN3yipmdTmpaAEASmbXwCxRSm7g4sNkfA969xo14PZQpBY3QUGqgCWoqJJVFWMhfvD53rzfgJpA4JH5B1fvY99q5iwbsAKdJfZi4fxub9QWZSNQfht4JqXMDmc6XTkWLE4VCxBRQYzF44H2E6mdf5EbZHUrpXj5c2VfC6PZGg9qmrz14aZjafM4M7kRTqMwVB8R9r7kXM1FWidGoprp2fRoJUALAKxKDSTVHX8ejT8zkSKJ5W45dSQjMe3WUDTeKhiy6Fqio2ukV8THaizTp6yZWxMVdu3a15pGBv1kmXZJEnLN9BsxyhnW2iGM7tvwK1jAneXeBH1uVdusR59j5ubCGKeoaS5ToC8Ky6wZ2iCyb2JF5CTvR4sMUg2ksmUm1dk8EoRjJ9i5gkqY`;
export const auctionAddresses = [auctionAddress];

export const auctionTrees = [auctionAddress] // array of trees of all auction addresses until now.
  .map((addr) => new Address(addr).ergoTree);
export const trueAddress = "4MQyML64GnzMxZgm"; // dummy address to get unsigned tx from node, we only care about the boxes though in this case
export const auctionContract = ``;
export let contracts: any = {};
contracts[auctionAddress] = {
  isActive: true,
  extendThreshold: 30 * 60 * 1000,
  extendNum: 40 * 60 * 1000,
  loyalty: true,
  customToken: true,
};
export const auctionNFT =
  "9ebcd694bf34db4ee3e2ccea0087ca42970743b9e019a1e8d145e8560467c60e";
export const txFee = 1000000;
export const listingFee = 30000000;
export const CHANGE_BOX_ASSET_LIMIT = 90;

export const v1ErgAddress =
  "26tpZU6i6zeBRuzZVo7tr47zjArAxkHP8x7ijiRbbrvLhySvSU84bH8wNPGGG27EwhJfJLe7bvRPv6B1jQFQqrWUQqBX1XJpVGoiNgveance6JFZ4mKv1KkRE8nBSB3jKBGnVJjJF6wR1Z8YXRsUqrTff4bfmtbhaRRjibnDDtKhS71spfjjTBeU1AhhQpitCDg4NFxmTLyV1arE7G2riZKzDryjWnCiEJGzWNxYtVt8uDxd3qNSRE5sHECwcsb98x7rn4q4FyHMvvWrRMPFfVgAQd5wHCAHwhMEdqUrSFQVkmUMavju8CLAgCNcVFjUBKPX4ooEHLUw3QkxS9Jp6fAFAGmzJ6QVD71mAZYMYhoEQnFyUBx1txJjVJjCrcZsW43dimbt5su4ahATJ8qRtWgwat8vTViTVXAcBmUSnqbqhAqTCxcsS5EFS6ApJSfthPHYUyXwtcbTptfdnUx1e5hEiGcwxoQ8ivufNNiZE9xkxi4nsBBrBVBJ7pfSSoHvbodkzLrq91RHYrvuatyLuBSxgJxs198xUQhULqxmWwgthJLrG5VVfVYH";
export const v1SigUsdAddress =
  "qNtfov7o2g1GYShDaD4a1QNv1bSjEXAbnWzVJQA7qVYogTFuxuw659G1WWwonQqA91AsYa9vL7JQLysRvMyNdZ6iLHH5mgx5RKn6tEE5uki3MPNg5cVrnG9rhZuKA3CpyaMbBBus7fxoYQsHgLCShaqJEyjFZsKooWqVJ1nFQeo9hiTCLcWd91B4EeWzrimYswG4cPaJyBwQp9eit1Hq1UtZ8dwo3r7vKsH7aJLzZbq6mky4itWHKueA4bybDQfPwYXoujsChY5jawj6V1YQrrVbzdxm66pBSfCdzr76nWp5VdnPJXbvnN6tHpv2Taivs23JJBPakAeDSpX1TuYx7Ce5KYHutTczNcytPQgbetWXNxTKzDsmzLbEX1bsWdryJnJT5bUHUXEEacWmz6JgUaKRbrJwWNgrpH5V3t6nvUgpZFpwQnNLYnLQs4tVHch3DeifD3f7BX4s5E3qArtDkNMPsY6AgUPd6kLNbfRvyZPf2RDA2CXn9ABmnKmTZdJYfc2bLHG1H7igeBH4g5Tok5fkjux6L8T8Pf7jBiV6WYRjD4y8E6idTTWrBJ9vvPJURnFD6L8jp2f3xt6HvKD1bokKUZyeTiu9hmFm3s9TE8x7ztCXeYUiJq7Lm4FzFsXkyqKgGDRSXXGmqDpwaWSdtH9Pn43kLWr8hRoMkAm1f9e6nhJQfCRu8wAK3Zv74vRfq";

export const allowedCurrencies: Currency[] = ["erg", "sigusd"];

export const supportedCurrencies: SupportedCurrenciesInterface = {
  erg: {
    name: "erg",
    displayName: "ERG",
    id: "",
    decimal: 9,
    minSupported: 10000000,
    initial: 10000000,
    contractAddress: v1ErgAddress,
  },
  sigusd: {
    name: "sigusd",
    displayName: "SigUSD",
    id: "03faf2cb329f2e90d6d23b58d91bbb6c046aa143261cc21f52fbe2824bfcbf04",
    decimal: 2,
    minSupported: 100,
    initial: 1,
    contractAddress: v1SigUsdAddress,
  },
  // SigRSV: {
  //   name: "SigRSV",
  //   id: "003bd19d0187117f130b62e1bcab0939929ff5c7709f843c5c4dd158949285d0",
  //   decimal: 0,
  //   minSupported: 100,
  //   initial: 1,
  // },
  // kushti: {
  //   name: "kushti",
  //   id: "fbbaac7337d051c10fc3da0ccb864f4d32d40027551e1c3ea3ce361f39b91e40",
  //   decimal: 0,
  //   minSupported: 100,
  //   initial: 1,
  // },
};
const assmUrl = "https://assembler.ergoauctions.org/";

const artworkTypes = {
  image: [0x01, 0x01],
  audio: [0x01, 0x02],
  video: [0x01, 0x03],
};

const remFavNotif = 12;

const fakeThreshold = 0.05;
const fakeURL = "https://ergolui.com/nft-check/nfthashcompares/";

const notifCoolOff = 40;

// export const skyHarborApi =  "https://skyharbor-server.net"
export const skyHarborApi = "https://api.skyharbor.io";
